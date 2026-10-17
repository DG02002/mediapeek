import type { AnalyzeProgressStage } from "@mediapeek/shared/analyze-progress"
import {
  type ArchiveEntryInspection,
  inspectArchiveEntry,
} from "@mediapeek/shared/archive-inspection"
import {
  type FilenameSource,
  parseContentDispositionFilename,
} from "@mediapeek/shared/filename-resolution"

import { DiagnosticsError } from "../lib/error-utils"
import {
  extractFilenameFromUrl,
  getEmulationHeaders,
  isArchiveExtension,
  resolveGoogleDriveUrl,
  validateUrl,
} from "../lib/server-utils"
import { mediaPeekEmitter } from "./event-bus.server"

export interface FetchDiagnostics {
  headRequestDurationMs: number
  fetchRequestDurationMs: number
  totalDurationMs: number
  isGoogleDrive: boolean
  resolvedFilename: string
  resolvedFilenameSource: FilenameSource
  responseStatus: number
  probeMethod: string
  firstByteReadTimeoutMs?: number
  firstByteReadRetries?: number
  firstByteReadStrategy?: "range" | "no_range_fallback"
  seekFetchCount?: number
  seekBytesFetched?: number
  streamCloseError?: string
}

const FIRST_BYTE_READ_TIMEOUT_MS = 15_000
const MAX_FIRST_BYTE_READ_RETRIES = 1
const NO_RANGE_FALLBACK_TIMEOUT_MS = 25_000
const SAFE_LIMIT = 10 * 1024 * 1024
const REMOTE_RANGE_CHUNK_SIZE = 2 * 1024 * 1024
const REMOTE_RANGE_FETCH_LIMIT = 8 * 1024 * 1024
const REMOTE_RANGE_CACHE_LIMIT = 32 * 1024 * 1024
const ZIP_TAIL_INSPECTION_BYTES = 128 * 1024

interface MediaByteSource {
  initialBuffer: Uint8Array
  readChunk: (size: number, offset: number) => Promise<Uint8Array>
}

export interface MediaFetchResult {
  buffer: Uint8Array
  byteSource?: MediaByteSource
  filename: string
  filenameSource: FilenameSource
  fileSize?: number
  diagnostics: FetchDiagnostics
  hash?: string
  innerFilename?: string
  archiveEntry?: ArchiveEntryInspection
}

export type FetchProgressReporter = (
  stage: AnalyzeProgressStage,
  title: string,
  message: string
) => Promise<void> | void

const resolveResponseFileSize = (response: Response): number | undefined => {
  const contentRange = response.headers.get("content-range")

  if (contentRange) {
    const match = /\/(\d+)$/.exec(contentRange)

    if (match) {
      return parseInt(match[1], 10)
    }
  }

  if (response.status === 206) {
    return undefined
  }

  const contentLength = response.headers.get("content-length")

  if (!contentLength) {
    return undefined
  }

  return parseInt(contentLength, 10)
}

const isHtmlResponse = (response: Response) =>
  response.headers.get("content-type")?.toLowerCase().includes("text/html") ??
  false

const didHonorRangeRequest = (response: Response) =>
  response.status === 206 || response.headers.has("content-range")

const assertByteFetchStatus = (res: Response) => {
  if (res.status === 200 || res.status === 206) {
    return
  }

  if (res.status === 404) {
    throw new Error("Media file not found. Check the URL.")
  }

  if (res.status === 403) {
    throw new Error(
      "Access denied while fetching media bytes. The link may have expired or may block server-side requests."
    )
  }

  throw new Error(
    `Unable to retrieve media bytes (HTTP ${String(res.status)}).`
  )
}

const readFirstChunkWithTimeout = async (
  sourceReader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number
) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Fetch stream read timed out"))
    }, timeoutMs)
  })

  try {
    const { done, value } = await Promise.race([
      sourceReader.read(),
      timeoutPromise,
    ])

    return done ? null : value
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}

const readStreamIntoBuffer = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  firstChunk: Uint8Array | null,
  limit: number
): Promise<Uint8Array> => {
  const tempBuffer = new Uint8Array(limit)
  const position = { offset: 0 }

  if (firstChunk) {
    const initialSize = Math.min(firstChunk.byteLength, limit)
    tempBuffer.set(firstChunk.subarray(0, initialSize), position.offset)
    position.offset += initialSize

    if (position.offset >= limit) {
      await reader.cancel()

      return tempBuffer.subarray(0, position.offset)
    }
  }

  await readReaderIntoBuffer({ reader, buffer: tempBuffer, position, limit })

  return tempBuffer.subarray(0, position.offset)
}

const readReaderIntoBuffer = async (options: {
  reader: ReadableStreamDefaultReader<Uint8Array>
  buffer: Uint8Array
  position: { offset: number }
  limit: number
}): Promise<void> => {
  if (options.position.offset >= options.limit) {
    return
  }

  const { done, value } = await options.reader.read()

  if (done) {
    return
  }

  const bytesToCopy = Math.min(
    value.byteLength,
    options.limit - options.position.offset
  )

  options.buffer.set(value.subarray(0, bytesToCopy), options.position.offset)
  options.position.offset += bytesToCopy

  if (bytesToCopy < value.byteLength) {
    await options.reader.cancel()

    return
  }

  await readReaderIntoBuffer(options)
}

const readCompressedPrefix = async (
  compressedData: Uint8Array,
  limit: number
): Promise<Uint8Array> => {
  const inputStream = new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(new Uint8Array(compressedData))
      controller.close()
    },
  })

  const decompressor = new DecompressionStream("deflate-raw")

  const reader = inputStream.pipeThrough(decompressor).getReader()

  const tempBuffer = new Uint8Array(limit)
  const position = { offset: 0 }

  try {
    await readReaderIntoBuffer({
      reader,
      buffer: tempBuffer,
      position,
      limit,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (
      position.offset === 0 ||
      (!message.includes("incomplete data") &&
        !message.includes("unexpected end of file"))
    ) {
      throw error
    }
  }

  return tempBuffer.subarray(0, position.offset)
}

const extractArchivePrefix = async (
  rawBuffer: Uint8Array,
  archiveEntry: ArchiveEntryInspection
): Promise<Uint8Array | null> => {
  if (
    archiveEntry.dataOffset === undefined ||
    archiveEntry.dataOffset >= rawBuffer.byteLength
  ) {
    return null
  }

  if (
    archiveEntry.archiveKind === "tar" ||
    archiveEntry.compression === "stored"
  ) {
    const availableEnd =
      archiveEntry.compressedSize !== undefined
        ? Math.min(
            rawBuffer.byteLength,
            archiveEntry.dataOffset + archiveEntry.compressedSize
          )
        : rawBuffer.byteLength

    return rawBuffer.subarray(archiveEntry.dataOffset, availableEnd)
  }

  if (archiveEntry.compression === "deflate") {
    const compressedEnd =
      archiveEntry.compressedSize !== undefined
        ? Math.min(
            rawBuffer.byteLength,
            archiveEntry.dataOffset + archiveEntry.compressedSize
          )
        : rawBuffer.byteLength

    const compressedPrefix = rawBuffer.subarray(
      archiveEntry.dataOffset,
      compressedEnd
    )

    if (compressedPrefix.byteLength === 0) {
      return null
    }

    return readCompressedPrefix(compressedPrefix, SAFE_LIMIT)
  }

  return null
}

const fetchZipTailBuffer = async (
  url: string,
  totalSize: number
): Promise<Uint8Array | null> => {
  if (!Number.isFinite(totalSize) || totalSize <= 0) {
    return null
  }

  const start = Math.max(0, totalSize - ZIP_TAIL_INSPECTION_BYTES)

  const response = await fetch(url, {
    headers: getEmulationHeaders(
      `bytes=${String(start)}-${String(totalSize - 1)}`
    ),
    redirect: "follow",
  })

  if (response.status !== 200 && response.status !== 206) {
    return null
  }

  return new Uint8Array(await response.arrayBuffer())
}

type RemoteByteSourceOptions = {
  url: string
  initialBuffer: Uint8Array
  fileSize?: number
  diagnostics: FetchDiagnostics
  reportProgress?: FetchProgressReporter
}

type RemoteCacheEntry = { bytes: Uint8Array; lastUsed: number }

const storeRemoteSpanChunks = (options: {
  body: Uint8Array
  responseStart: number
  spanStart: number
  spanEnd: number
  setChunk: (chunkStart: number, bytes: Uint8Array) => void
}) => {
  for (
    let chunkStart = options.spanStart;
    chunkStart < options.spanEnd;
    chunkStart += REMOTE_RANGE_CHUNK_SIZE
  ) {
    const sliceStart = chunkStart - options.responseStart

    if (sliceStart < 0 || sliceStart >= options.body.byteLength) {
      break
    }

    const sliceEnd = Math.min(
      sliceStart + REMOTE_RANGE_CHUNK_SIZE,
      options.body.byteLength
    )

    const chunkBytes = options.body.slice(sliceStart, sliceEnd)

    if (chunkBytes.byteLength === 0) {
      break
    }

    options.setChunk(chunkStart, chunkBytes)
  }
}

const createRemoteByteSource = ({
  url,
  initialBuffer,
  fileSize,
  diagnostics,
  reportProgress,
}: RemoteByteSourceOptions): MediaByteSource => {
  const cache = new Map<number, RemoteCacheEntry>()
  const remoteBaseOffset = initialBuffer.byteLength
  let cacheBytes = 0
  let accessCounter = 0
  let didReportRemoteSeekFetch = false

  const getRemoteChunkStart = (offset: number) => {
    const delta = offset - remoteBaseOffset

    return (
      remoteBaseOffset +
      Math.floor(delta / REMOTE_RANGE_CHUNK_SIZE) * REMOTE_RANGE_CHUNK_SIZE
    )
  }

  const getRemoteSpanEnd = (chunkStart: number, requestedEnd: number) => {
    const desiredEnd = Math.max(
      chunkStart + REMOTE_RANGE_CHUNK_SIZE,
      requestedEnd
    )

    const boundedEnd = Math.min(
      desiredEnd,
      chunkStart + REMOTE_RANGE_FETCH_LIMIT
    )

    return fileSize === undefined ? boundedEnd : Math.min(fileSize, boundedEnd)
  }

  const touchChunk = (chunkStart: number) => {
    const cached = cache.get(chunkStart)

    if (cached) {
      cached.lastUsed = ++accessCounter
    }
  }

  const setChunk = (chunkStart: number, bytes: Uint8Array) => {
    const existing = cache.get(chunkStart)

    if (existing) {
      cacheBytes -= existing.bytes.byteLength
    }

    cache.set(chunkStart, { bytes, lastUsed: ++accessCounter })
    cacheBytes += bytes.byteLength

    while (cacheBytes > REMOTE_RANGE_CACHE_LIMIT && cache.size > 0) {
      let oldestKey: number | null = null
      let oldestAccess = Number.POSITIVE_INFINITY

      for (const [key, value] of cache.entries()) {
        if (value.lastUsed < oldestAccess) {
          oldestKey = key
          oldestAccess = value.lastUsed
        }
      }

      if (oldestKey === null) {
        break
      }

      const removed = cache.get(oldestKey)

      if (!removed) {
        break
      }

      cache.delete(oldestKey)
      cacheBytes -= removed.bytes.byteLength
    }
  }

  const fetchRemoteSpan = async (offset: number, requestedEnd: number) => {
    const spanStart = getRemoteChunkStart(offset)
    const spanEnd = getRemoteSpanEnd(spanStart, requestedEnd)

    if (spanEnd <= spanStart) {
      return
    }

    if (!didReportRemoteSeekFetch) {
      didReportRemoteSeekFetch = true
      await reportProgress?.(
        "remote_seek_fetch_started",
        "Requesting Additional Bytes",
        "The analyzer requested more bytes from the source to inspect later parts of the container."
      )
    }

    const response = await fetch(url, {
      headers: getEmulationHeaders(
        "bytes=" + String(spanStart) + "-" + String(spanEnd - 1)
      ),
      redirect: "follow",
    })

    assertByteFetchStatus(response)

    const body = new Uint8Array(await response.arrayBuffer())
    diagnostics.seekFetchCount = (diagnostics.seekFetchCount ?? 0) + 1
    diagnostics.seekBytesFetched =
      (diagnostics.seekBytesFetched ?? 0) + body.byteLength
    let responseStart = spanStart

    if (response.status === 200 && spanStart > 0) {
      if (body.byteLength <= spanStart) {
        throw new Error("Origin ignored byte-range seek request.")
      }

      responseStart = 0
    }

    storeRemoteSpanChunks({
      body,
      responseStart,
      spanStart,
      spanEnd,
      setChunk,
    })
  }

  const copyRemoteChunk = async (options: {
    result: Uint8Array
    requestedEnd: number
    cursor: number
    writeOffset: number
  }) => {
    const chunkStart = getRemoteChunkStart(options.cursor)
    let cached = cache.get(chunkStart)

    if (!cached) {
      await fetchRemoteSpan(options.cursor, options.requestedEnd)
      cached = cache.get(chunkStart)
    }

    if (!cached || cached.bytes.byteLength === 0) {
      return null
    }

    touchChunk(chunkStart)

    const chunkOffset = options.cursor - chunkStart

    if (chunkOffset >= cached.bytes.byteLength) {
      return null
    }

    const available = cached.bytes.subarray(chunkOffset)

    const bytesToCopy = Math.min(
      available.byteLength,
      options.requestedEnd - options.cursor
    )

    options.result.set(available.subarray(0, bytesToCopy), options.writeOffset)

    return {
      cursor: options.cursor + bytesToCopy,
      writeOffset: options.writeOffset + bytesToCopy,
    }
  }

  const fillRemoteRead = async (options: {
    result: Uint8Array
    requestedEnd: number
    cursor: number
    writeOffset: number
  }): Promise<number> => {
    if (options.cursor >= options.requestedEnd) {
      return options.writeOffset
    }

    if (options.cursor < initialBuffer.byteLength) {
      const prefixEnd = Math.min(options.requestedEnd, initialBuffer.byteLength)
      const prefixSlice = initialBuffer.subarray(options.cursor, prefixEnd)

      options.result.set(prefixSlice, options.writeOffset)

      return fillRemoteRead({
        ...options,
        cursor: prefixEnd,
        writeOffset: options.writeOffset + prefixSlice.byteLength,
      })
    }

    const next = await copyRemoteChunk(options)

    if (!next) {
      return options.writeOffset
    }

    return fillRemoteRead({
      ...options,
      ...next,
    })
  }

  return {
    initialBuffer,
    async readChunk(size: number, offset: number) {
      if (size <= 0 || offset < 0) {
        return new Uint8Array(0)
      }

      const requestedEnd =
        fileSize === undefined
          ? offset + size
          : Math.min(fileSize, offset + size)

      if (requestedEnd <= offset) {
        return new Uint8Array(0)
      }

      if (requestedEnd <= initialBuffer.byteLength) {
        return initialBuffer.subarray(offset, requestedEnd)
      }

      const result = new Uint8Array(requestedEnd - offset)

      const writeOffset = await fillRemoteRead({
        result,
        requestedEnd,
        cursor: offset,
        writeOffset: 0,
      })

      return writeOffset === result.byteLength
        ? result
        : result.subarray(0, writeOffset)
    },
  }
}

type ProbeResult = {
  url: string
  isGoogleDrive: boolean
  fileSize?: number
  filename: string
  filenameSource: FilenameSource
  probeMethod: string
  probeDurationMs: number
}

type InitialResponseRead = {
  response: Response
  reader: ReadableStreamDefaultReader<Uint8Array>
  firstChunk: Uint8Array | null
  strategy: "range" | "no_range_fallback"
}

type InitialReadResult = {
  response: Response
  reader: ReadableStreamDefaultReader<Uint8Array>
  firstChunk: Uint8Array | null
  timeoutRetries: number
  strategy: InitialResponseRead["strategy"]
}

const createFetchDiagnostics = (): FetchDiagnostics => ({
  headRequestDurationMs: 0,
  fetchRequestDurationMs: 0,
  totalDurationMs: 0,
  isGoogleDrive: false,
  resolvedFilename: "",
  resolvedFilenameSource: "url",
  responseStatus: 0,
  probeMethod: "HEAD",
})

const fetchHeaderProbe = async (url: string) => {
  let method = "HEAD"

  let response = await fetch(url, {
    method: "HEAD",
    headers: getEmulationHeaders(),
    redirect: "follow",
  })

  if (response.status === 405) {
    method = "GET"
    response = await fetch(url, {
      method: "GET",
      headers: getEmulationHeaders("bytes=0-0"),
      redirect: "follow",
    })
  }

  return { method, response }
}

const assertProbeStatus = (response: Response) => {
  if (response.ok) {
    return
  }

  if (response.status === 404) {
    throw new Error("Media file not found. Check the URL.")
  }

  if (response.status === 403) {
    throw new Error(
      "Access denied. The link may have expired or requires authentication."
    )
  }

  throw new Error(
    "Unable to access file (HTTP " + String(response.status) + ")."
  )
}

const probeRemoteSource = async (
  initialUrl: string,
  reportProgress?: FetchProgressReporter
): Promise<ProbeResult> => {
  const { url, isGoogleDrive } = resolveGoogleDriveUrl(initialUrl)
  validateUrl(url)
  await reportProgress?.(
    "source_probe_started",
    "Checking Source Headers",
    "Sending an initial probe request to inspect the source response."
  )

  const probeStart = performance.now()
  const { method, response } = await fetchHeaderProbe(url)
  const probeDurationMs = Math.round(performance.now() - probeStart)
  assertProbeStatus(response)

  const filename = extractFilenameFromUrl(url)

  const headerFilename = parseContentDispositionFilename(
    response.headers.get("content-disposition")
  )

  return {
    url,
    isGoogleDrive,
    fileSize: resolveResponseFileSize(response),
    filename: headerFilename ?? filename,
    filenameSource: headerFilename ? "content-disposition-head" : "url",
    probeMethod: method,
    probeDurationMs,
  }
}

const createInitialResponseRead = async (options: {
  url: string
  headers: Headers
  timeoutMs: number
  strategy: InitialResponseRead["strategy"]
  reportProgress?: FetchProgressReporter
  waitingMessage: string
  receivedMessage: string
}): Promise<InitialResponseRead> => {
  const response = await fetch(options.url, {
    headers: options.headers,
    redirect: "follow",
  })

  assertByteFetchStatus(response)

  const reader = response.body?.getReader()

  if (!reader) {
    throw new Error("Failed to retrieve response body stream")
  }

  let firstChunk: Uint8Array | null

  try {
    await options.reportProgress?.(
      "waiting_for_first_byte",
      "Waiting for First Byte",
      options.waitingMessage
    )
    firstChunk = await readFirstChunkWithTimeout(reader, options.timeoutMs)
  } catch (error) {
    void reader.cancel()
    throw error
  }

  if (firstChunk && firstChunk.byteLength > 0) {
    await options.reportProgress?.(
      "first_byte_received",
      "First Bytes Received",
      options.receivedMessage
    )
  }

  return {
    response,
    reader,
    firstChunk,
    strategy: options.strategy,
  }
}

type RangedAttemptResult = {
  initialRead?: InitialResponseRead
  timeoutRetries: number
}

const fetchRangedInitialBytes = async (
  options: {
    url: string
    fetchEnd: number
    reportProgress?: FetchProgressReporter
  },
  attempt = 0
): Promise<RangedAttemptResult> => {
  await options.reportProgress?.(
    "initial_fetch_started",
    "Requesting Initial Bytes",
    "Fetching the first chunk needed to inspect the media container."
  )

  try {
    const initialRead = await createInitialResponseRead({
      url: options.url,
      headers: getEmulationHeaders("bytes=0-" + String(options.fetchEnd)),
      timeoutMs: FIRST_BYTE_READ_TIMEOUT_MS,
      strategy: "range",
      reportProgress: options.reportProgress,
      waitingMessage:
        "The source accepted the request but has not started sending media bytes yet.",
      receivedMessage:
        "Initial media bytes arrived. Continuing the fetch and inspection step.",
    })

    return { initialRead, timeoutRetries: attempt }
  } catch (error) {
    const timedOut =
      error instanceof Error && error.message === "Fetch stream read timed out"

    if (!timedOut) {
      throw error
    }

    if (attempt < MAX_FIRST_BYTE_READ_RETRIES) {
      return fetchRangedInitialBytes(options, attempt + 1)
    }

    return { timeoutRetries: attempt + 1 }
  }
}

const fetchNoRangeFallback = async (options: {
  url: string
  timeoutRetries: number
  didRangeTimeout: boolean
  reportProgress?: FetchProgressReporter
}): Promise<InitialResponseRead> => {
  await options.reportProgress?.(
    "no_range_fallback_started",
    "Retrying Without Range",
    "The initial ranged read timed out, so the analyzer is retrying without a Range header."
  )

  try {
    return await createInitialResponseRead({
      url: options.url,
      headers: getEmulationHeaders(),
      timeoutMs: NO_RANGE_FALLBACK_TIMEOUT_MS,
      strategy: "no_range_fallback",
      reportProgress: options.reportProgress,
      waitingMessage:
        "Waiting for the source to start sending bytes for the fallback request.",
      receivedMessage: "Initial media bytes arrived from the fallback request.",
    })
  } catch (error) {
    const timedOut =
      error instanceof Error && error.message === "Fetch stream read timed out"

    if (!timedOut) {
      throw error
    }

    const message = options.didRangeTimeout
      ? "Fetch stream read timed out after " +
        String(options.timeoutRetries) +
        " range attempt(s) and no-range fallback"
      : "Fetch stream read timed out during no-range fallback"

    throw new Error(message, { cause: error })
  }
}

const fetchInitialResponse = async (options: {
  url: string
  fetchEnd: number
  diagnostics: FetchDiagnostics
  reportProgress?: FetchProgressReporter
}): Promise<InitialReadResult> => {
  const fetchStart = performance.now()
  await options.reportProgress?.(
    "source_probe_completed",
    "Source Probe Complete",
    "Source probe finished using " +
      options.diagnostics.probeMethod +
      ". Requesting the initial media bytes now."
  )

  const rangedResult = await fetchRangedInitialBytes({
    url: options.url,
    fetchEnd: options.fetchEnd,
    reportProgress: options.reportProgress,
  })

  const didRangeTimeout = rangedResult.timeoutRetries > 0

  const initialRead =
    rangedResult.initialRead ??
    (await fetchNoRangeFallback({
      url: options.url,
      timeoutRetries: rangedResult.timeoutRetries,
      didRangeTimeout,
      reportProgress: options.reportProgress,
    }))

  options.diagnostics.responseStatus = initialRead.response.status
  options.diagnostics.fetchRequestDurationMs = Math.round(
    performance.now() - fetchStart
  )
  options.diagnostics.firstByteReadTimeoutMs = FIRST_BYTE_READ_TIMEOUT_MS
  options.diagnostics.firstByteReadRetries = rangedResult.timeoutRetries
  options.diagnostics.firstByteReadStrategy = initialRead.strategy

  return {
    ...initialRead,
    timeoutRetries: rangedResult.timeoutRetries,
  }
}

const assertMediaResponse = (
  response: Response,
  reader: ReadableStreamDefaultReader<Uint8Array>,
  isGoogleDrive: boolean
) => {
  if (!isHtmlResponse(response)) {
    return
  }

  void reader.cancel()

  if (isGoogleDrive) {
    throw new Error("Google Drive file is rate-limited. Try again in 24 hours.")
  }

  throw new Error(
    "URL links to a webpage, not a media file. Provide a direct link."
  )
}

const resolveInitialMetadata = (options: {
  response: Response
  fileSize?: number
  filename: string
  filenameSource: FilenameSource
  diagnostics: FetchDiagnostics
}) => {
  const fileSize = options.fileSize || resolveResponseFileSize(options.response)

  const getFilename =
    options.filenameSource === "url"
      ? parseContentDispositionFilename(
          options.response.headers.get("content-disposition")
        )
      : null

  const filename = getFilename ?? options.filename

  const filenameSource = getFilename
    ? "content-disposition-get"
    : options.filenameSource

  options.diagnostics.resolvedFilename = filename
  options.diagnostics.resolvedFilenameSource = filenameSource

  return { fileSize, filename, filenameSource }
}

const readInitialBody = async (options: {
  reader: ReadableStreamDefaultReader<Uint8Array>
  firstChunk: Uint8Array | null
  diagnostics: FetchDiagnostics
  startedAt: number
}): Promise<Uint8Array> => {
  try {
    return await readStreamIntoBuffer(
      options.reader,
      options.firstChunk,
      SAFE_LIMIT
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    options.diagnostics.streamCloseError = message
    options.diagnostics.totalDurationMs = Math.round(
      performance.now() - options.startedAt
    )
    throw new DiagnosticsError(
      "Stream reading failed: " + message,
      options.diagnostics,
      error
    )
  }
}

const fetchInitialSegment = async (options: {
  probe: ProbeResult
  chunkSize: number
  diagnostics: FetchDiagnostics
  startedAt: number
  reportProgress?: FetchProgressReporter
}) => {
  const fetchEnd =
    options.probe.fileSize !== undefined
      ? Math.min(options.chunkSize - 1, options.probe.fileSize - 1)
      : options.chunkSize - 1

  const initialRead = await fetchInitialResponse({
    url: options.probe.url,
    fetchEnd,
    diagnostics: options.diagnostics,
    reportProgress: options.reportProgress,
  })

  assertMediaResponse(
    initialRead.response,
    initialRead.reader,
    options.probe.isGoogleDrive
  )

  const metadata = resolveInitialMetadata({
    response: initialRead.response,
    fileSize: options.probe.fileSize,
    filename: options.probe.filename,
    filenameSource: options.probe.filenameSource,
    diagnostics: options.diagnostics,
  })

  const supportsRemoteSeekReads = didHonorRangeRequest(initialRead.response)

  if (!supportsRemoteSeekReads) {
    await options.reportProgress?.(
      "source_range_unsupported",
      "Source Ignored Range Requests",
      "The source did not honor byte-range requests, so analysis will continue without remote seek reads."
    )
  }

  await options.reportProgress?.(
    "initial_segment_reading",
    "Reading Initial Segment",
    "The source started responding. MediaPeek is reading the first 10 MB needed before analysis can begin."
  )

  const rawBuffer = await readInitialBody({
    reader: initialRead.reader,
    firstChunk: initialRead.firstChunk,
    diagnostics: options.diagnostics,
    startedAt: options.startedAt,
  })

  return { ...metadata, rawBuffer, supportsRemoteSeekReads }
}

const inspectFetchedArchive = async (options: {
  rawBuffer: Uint8Array
  filename: string
  fileSize?: number
  isGoogleDrive: boolean
  supportsRemoteSeekReads: boolean
  url: string
}): Promise<ArchiveEntryInspection | undefined> => {
  const shouldCheckArchive =
    options.rawBuffer.byteLength > 0 &&
    (!options.filename ||
      isArchiveExtension(options.filename) ||
      options.isGoogleDrive)

  if (!shouldCheckArchive) {
    return undefined
  }

  let archiveEntry = inspectArchiveEntry(options.rawBuffer) ?? undefined

  if (
    archiveEntry?.archiveKind !== "zip" ||
    archiveEntry.sizeStatus !== "estimated" ||
    options.fileSize === undefined ||
    !options.supportsRemoteSeekReads
  ) {
    return archiveEntry
  }

  const tailBuffer = await fetchZipTailBuffer(options.url, options.fileSize)

  if (tailBuffer) {
    archiveEntry =
      inspectArchiveEntry(options.rawBuffer, { tailBuffer }) ?? archiveEntry
  }

  return archiveEntry
}

const extractAnalysisBuffer = async (options: {
  rawBuffer: Uint8Array
  fileSize?: number
  archiveEntry?: ArchiveEntryInspection
  diagnostics: FetchDiagnostics
}) => {
  if (!options.archiveEntry) {
    return { buffer: options.rawBuffer, fileSize: options.fileSize }
  }

  options.diagnostics.resolvedFilename = options.archiveEntry.name
  options.diagnostics.resolvedFilenameSource = "archive-inner"

  const extractedPrefix = await extractArchivePrefix(
    options.rawBuffer,
    options.archiveEntry
  )

  const buffer =
    extractedPrefix && extractedPrefix.byteLength > 0
      ? extractedPrefix
      : options.rawBuffer

  const fileSize =
    options.archiveEntry.sizeStatus === "verified" &&
    options.archiveEntry.uncompressedSize !== undefined
      ? options.archiveEntry.uncompressedSize
      : options.fileSize

  return { buffer, fileSize }
}

const createMediaFetchResult = (options: {
  content: { buffer: Uint8Array; fileSize?: number }
  initial: {
    rawBuffer: Uint8Array
    filename: string
    filenameSource: FilenameSource
    supportsRemoteSeekReads: boolean
  }
  probe: ProbeResult
  archiveEntry?: ArchiveEntryInspection
  diagnostics: FetchDiagnostics
  reportProgress?: FetchProgressReporter
}): MediaFetchResult => {
  let byteSource: MediaByteSource | undefined

  if (!options.archiveEntry && options.initial.supportsRemoteSeekReads) {
    byteSource = createRemoteByteSource({
      url: options.probe.url,
      initialBuffer: options.initial.rawBuffer,
      fileSize: options.content.fileSize,
      diagnostics: options.diagnostics,
      reportProgress: options.reportProgress,
    })
  }

  const innerFilename =
    options.diagnostics.resolvedFilename === options.initial.filename
      ? undefined
      : options.diagnostics.resolvedFilename

  return {
    buffer: options.content.buffer,
    byteSource,
    filename: options.initial.filename,
    filenameSource: options.initial.filenameSource,
    fileSize: options.content.fileSize,
    diagnostics: options.diagnostics,
    innerFilename,
    archiveEntry: options.archiveEntry,
  }
}

export async function fetchMediaChunk(
  initialUrl: string,
  chunkSize: number = SAFE_LIMIT,
  reportProgress?: FetchProgressReporter
): Promise<MediaFetchResult> {
  const startedAt = performance.now()
  const diagnostics = createFetchDiagnostics()
  const probe = await probeRemoteSource(initialUrl, reportProgress)
  diagnostics.isGoogleDrive = probe.isGoogleDrive
  diagnostics.headRequestDurationMs = probe.probeDurationMs
  diagnostics.probeMethod = probe.probeMethod
  diagnostics.resolvedFilename = probe.filename
  diagnostics.resolvedFilenameSource = probe.filenameSource

  const initial = await fetchInitialSegment({
    probe,
    chunkSize,
    diagnostics,
    startedAt,
    reportProgress,
  })

  const archiveEntry = await inspectFetchedArchive({
    rawBuffer: initial.rawBuffer,
    filename: initial.filename,
    fileSize: initial.fileSize,
    isGoogleDrive: probe.isGoogleDrive,
    supportsRemoteSeekReads: initial.supportsRemoteSeekReads,
    url: probe.url,
  })

  const content = await extractAnalysisBuffer({
    rawBuffer: initial.rawBuffer,
    fileSize: initial.fileSize,
    archiveEntry,
    diagnostics,
  })

  diagnostics.totalDurationMs = Math.round(performance.now() - startedAt)

  const result = createMediaFetchResult({
    content,
    initial,
    probe,
    archiveEntry,
    diagnostics,
    reportProgress,
  })

  mediaPeekEmitter.emit("fetch:complete", {
    diagnostics: result.diagnostics,
    fileSize: result.fileSize,
    filename: result.filename,
    hash: result.hash,
  })

  return result
}
