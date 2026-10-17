import {
  type ArchiveEntryInspection,
  inspectArchiveEntry,
} from "@mediapeek/shared/archive-inspection"
import {
  type FilenameSource,
  parseContentDispositionFilename,
} from "@mediapeek/shared/filename-resolution"

import { DiagnosticsError } from "~/lib/error-utils"
import {
  extractFilenameFromUrl,
  getEmulationHeaders,
  isArchiveExtension,
  resolveGoogleDriveUrl,
  validateUrl,
} from "~/lib/server-utils"
import { mediaPeekEmitter } from "~/services/event-bus.server"

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
  streamCloseError?: string
}

const FIRST_BYTE_READ_TIMEOUT_MS = 15_000
const MAX_FIRST_BYTE_READ_RETRIES = 1
const NO_RANGE_FALLBACK_TIMEOUT_MS = 25_000
const SAFE_LIMIT = 10 * 1024 * 1024
const ZIP_TAIL_INSPECTION_BYTES = 128 * 1024

export interface MediaFetchResult {
  buffer: Uint8Array
  filename: string
  filenameSource: FilenameSource
  fileSize?: number
  diagnostics: FetchDiagnostics
  hash?: string
  innerFilename?: string
  archiveEntry?: ArchiveEntryInspection
}

interface ResolvedFilename {
  filename: string
  filenameSource: FilenameSource
}

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

interface InitialRangeRead {
  response: Response | null
  reader: ReadableStreamDefaultReader<Uint8Array> | null
  firstChunk: Uint8Array | null
  timeoutRetries: number
  timedOut: boolean
}

const fetchInitialRange = async (options: {
  targetUrl: string
  fetchEnd: number
  attempt?: number
}): Promise<InitialRangeRead> => {
  const attempt = options.attempt ?? 0

  const response = await fetch(options.targetUrl, {
    headers: getEmulationHeaders(`bytes=0-${String(options.fetchEnd)}`),
    redirect: "follow",
  })

  assertByteFetchStatus(response)

  const reader = response.body?.getReader()

  if (!reader) {
    throw new Error("Failed to retrieve response body stream")
  }

  try {
    const firstChunk = await readFirstChunkWithTimeout(
      reader,
      FIRST_BYTE_READ_TIMEOUT_MS
    )

    return {
      response,
      reader,
      firstChunk,
      timeoutRetries: attempt,
      timedOut: false,
    }
  } catch (error) {
    if (
      !(error instanceof Error) ||
      error.message !== "Fetch stream read timed out"
    ) {
      throw error
    }

    void reader.cancel()

    if (attempt < MAX_FIRST_BYTE_READ_RETRIES) {
      return fetchInitialRange({ ...options, attempt: attempt + 1 })
    }

    return {
      response: null,
      reader: null,
      firstChunk: null,
      timeoutRetries: attempt + 1,
      timedOut: true,
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
    await readReaderIntoBuffer({ reader, buffer: tempBuffer, position, limit })
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

interface FetchSetup {
  targetUrl: string
  isGoogleDrive: boolean
  fileSize: number | undefined
  filename: string
  filenameSource: FilenameSource
  diagnostics: FetchDiagnostics
}

const requestHead = async (targetUrl: string) => {
  const start = performance.now()
  let probeMethod = "HEAD"

  let response = await fetch(targetUrl, {
    method: "HEAD",
    headers: getEmulationHeaders(),
    redirect: "follow",
  })

  if (response.status === 405) {
    probeMethod = "GET"
    response = await fetch(targetUrl, {
      method: "GET",
      headers: getEmulationHeaders("bytes=0-0"),
      redirect: "follow",
    })
  }

  return {
    response,
    probeMethod,
    durationMs: Math.round(performance.now() - start),
  }
}

const assertHeadResponse = (response: Response) => {
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

  throw new Error(`Unable to access file (HTTP ${String(response.status)}).`)
}

const resolveHeadFilename = (
  response: Response,
  targetUrl: string
): { filename: string; filenameSource: FilenameSource } => {
  const headFilename = parseContentDispositionFilename(
    response.headers.get("content-disposition")
  )

  return headFilename
    ? { filename: headFilename, filenameSource: "content-disposition-head" }
    : { filename: extractFilenameFromUrl(targetUrl), filenameSource: "url" }
}

const resolveFetchSetup = async (initialUrl: string): Promise<FetchSetup> => {
  const { url: targetUrl, isGoogleDrive } = resolveGoogleDriveUrl(initialUrl)
  validateUrl(targetUrl)

  const head = await requestHead(targetUrl)
  assertHeadResponse(head.response)

  const { filename, filenameSource } = resolveHeadFilename(
    head.response,
    targetUrl
  )

  const diagnostics: FetchDiagnostics = {
    headRequestDurationMs: head.durationMs,
    fetchRequestDurationMs: 0,
    totalDurationMs: 0,
    isGoogleDrive,
    resolvedFilename: filename,
    resolvedFilenameSource: filenameSource,
    responseStatus: 0,
    probeMethod: head.probeMethod,
  }

  return {
    targetUrl,
    isGoogleDrive,
    fileSize: resolveResponseFileSize(head.response),
    filename,
    filenameSource,
    diagnostics,
  }
}

const fetchNoRangeFallback = async (options: {
  targetUrl: string
  rangeTimedOut: boolean
  timeoutRetries: number
}): Promise<{
  response: Response
  reader: ReadableStreamDefaultReader<Uint8Array>
  firstChunk: Uint8Array | null
}> => {
  const response = await fetch(options.targetUrl, {
    headers: getEmulationHeaders(),
    redirect: "follow",
  })

  assertByteFetchStatus(response)

  const reader = response.body?.getReader()

  if (!reader) {
    throw new Error("Failed to retrieve response body stream")
  }

  try {
    const firstChunk = await readFirstChunkWithTimeout(
      reader,
      NO_RANGE_FALLBACK_TIMEOUT_MS
    )

    return { response, reader, firstChunk }
  } catch (cause) {
    if (
      cause instanceof Error &&
      cause.message === "Fetch stream read timed out"
    ) {
      void reader.cancel()
      throw new Error(
        options.rangeTimedOut
          ? `Fetch stream read timed out after ${String(options.timeoutRetries)} range attempt(s) and no-range fallback`
          : "Fetch stream read timed out during no-range fallback",
        { cause }
      )
    }

    throw cause
  }
}

const fetchInitialResponse = async (options: {
  targetUrl: string
  fetchEnd: number
  diagnostics: FetchDiagnostics
}): Promise<{
  response: Response
  reader: ReadableStreamDefaultReader<Uint8Array>
  firstChunk: Uint8Array | null
}> => {
  const start = performance.now()

  const rangeRead = await fetchInitialRange({
    targetUrl: options.targetUrl,
    fetchEnd: options.fetchEnd,
  })

  let { response, reader, firstChunk } = rangeRead
  let readStrategy: FetchDiagnostics["firstByteReadStrategy"] = "range"

  if (response) {
    options.diagnostics.responseStatus = response.status
  }

  if (!response || !reader) {
    const fallback = await fetchNoRangeFallback({
      targetUrl: options.targetUrl,
      rangeTimedOut: rangeRead.timedOut,
      timeoutRetries: rangeRead.timeoutRetries,
    })

    const {
      response: fallbackResponse,
      reader: fallbackReader,
      firstChunk: fallbackFirstChunk,
    } = fallback

    response = fallbackResponse
    reader = fallbackReader
    firstChunk = fallbackFirstChunk
    options.diagnostics.responseStatus = fallback.response.status
    readStrategy = "no_range_fallback"
  }

  if (!response || !reader) {
    throw new Error("Failed to retrieve response body stream")
  }

  Object.assign(options.diagnostics, {
    fetchRequestDurationMs: Math.round(performance.now() - start),
    firstByteReadTimeoutMs: FIRST_BYTE_READ_TIMEOUT_MS,
    firstByteReadRetries: rangeRead.timeoutRetries,
    firstByteReadStrategy: readStrategy,
  })

  return { response, reader, firstChunk }
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

const resolveGetFilename = ({
  response,
  filename,
  filenameSource,
  diagnostics,
}: {
  response: Response
  filename: string
  filenameSource: FilenameSource
  diagnostics: FetchDiagnostics
}): ResolvedFilename => {
  if (filenameSource !== "url") {
    return { filename, filenameSource }
  }

  const getFilename = parseContentDispositionFilename(
    response.headers.get("content-disposition")
  )

  if (!getFilename) {
    return { filename, filenameSource }
  }

  diagnostics.resolvedFilename = getFilename
  diagnostics.resolvedFilenameSource = "content-disposition-get"

  return {
    filename: getFilename,
    filenameSource: "content-disposition-get",
  }
}

const readMediaBuffer = async (options: {
  reader: ReadableStreamDefaultReader<Uint8Array>
  firstChunk: Uint8Array | null
  diagnostics: FetchDiagnostics
  startTime: number
}) => {
  try {
    return await readStreamIntoBuffer(
      options.reader,
      options.firstChunk,
      SAFE_LIMIT
    )
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    options.diagnostics.streamCloseError = message
    options.diagnostics.totalDurationMs = Math.round(
      performance.now() - options.startTime
    )

    throw new DiagnosticsError(
      `Stream reading failed: ${message}`,
      options.diagnostics,
      cause
    )
  }
}

const findArchiveEntry = async (options: {
  rawBuffer: Uint8Array
  filename: string
  isGoogleDrive: boolean
  targetUrl: string
  fileSize: number | undefined
  supportsRemoteSeekReads: boolean
}) => {
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
    archiveEntry?.archiveKind === "zip" &&
    archiveEntry.sizeStatus === "estimated" &&
    options.fileSize !== undefined &&
    options.supportsRemoteSeekReads
  ) {
    const tailBuffer = await fetchZipTailBuffer(
      options.targetUrl,
      options.fileSize
    )

    const tailEntry = tailBuffer
      ? inspectArchiveEntry(options.rawBuffer, { tailBuffer })
      : null

    if (tailEntry) {
      archiveEntry = tailEntry
    }
  }

  return archiveEntry
}

const buildArchiveAnalysis = async (options: {
  rawBuffer: Uint8Array
  archiveEntry: ArchiveEntryInspection | undefined
  fileSize: number | undefined
  diagnostics: FetchDiagnostics
}) => {
  let analysisBuffer = options.rawBuffer
  let { fileSize } = options

  if (!options.archiveEntry) {
    return { analysisBuffer, fileSize }
  }

  options.diagnostics.resolvedFilename = options.archiveEntry.name
  options.diagnostics.resolvedFilenameSource = "archive-inner"

  const extractedPrefix = await extractArchivePrefix(
    options.rawBuffer,
    options.archiveEntry
  )

  if (extractedPrefix && extractedPrefix.byteLength > 0) {
    analysisBuffer = extractedPrefix
  }

  if (
    options.archiveEntry.sizeStatus === "verified" &&
    options.archiveEntry.uncompressedSize !== undefined
  ) {
    fileSize = options.archiveEntry.uncompressedSize
  }

  return { analysisBuffer, fileSize }
}

const finishMediaFetch = (options: {
  startTime: number
  buffer: Uint8Array
  filename: string
  filenameSource: FilenameSource
  fileSize: number | undefined
  archiveEntry: ArchiveEntryInspection | undefined
  diagnostics: FetchDiagnostics
}): MediaFetchResult => {
  options.diagnostics.totalDurationMs = Math.round(
    performance.now() - options.startTime
  )

  const result: MediaFetchResult = {
    buffer: options.buffer,
    filename: options.filename,
    filenameSource: options.filenameSource,
    fileSize: options.fileSize,
    diagnostics: options.diagnostics,
    innerFilename:
      options.diagnostics.resolvedFilename === options.filename
        ? undefined
        : options.diagnostics.resolvedFilename,
    archiveEntry: options.archiveEntry,
  }

  mediaPeekEmitter.emit("fetch:complete", {
    diagnostics: result.diagnostics,
    fileSize: result.fileSize,
    filename: result.filename,
    hash: result.hash,
  })

  return result
}

export async function fetchMediaChunk(
  initialUrl: string,
  chunkSize: number = SAFE_LIMIT
): Promise<MediaFetchResult> {
  const tStart = performance.now()
  const setup = await resolveFetchSetup(initialUrl)

  const fetchEnd =
    setup.fileSize !== undefined
      ? Math.min(chunkSize - 1, setup.fileSize - 1)
      : chunkSize - 1

  const initialResponse = await fetchInitialResponse({
    targetUrl: setup.targetUrl,
    fetchEnd,
    diagnostics: setup.diagnostics,
  })

  assertMediaResponse(
    initialResponse.response,
    initialResponse.reader,
    setup.isGoogleDrive
  )

  let { fileSize } = setup

  if (!fileSize) {
    fileSize = resolveResponseFileSize(initialResponse.response)
  }

  const filenameResolution = resolveGetFilename({
    response: initialResponse.response,
    filename: setup.filename,
    filenameSource: setup.filenameSource,
    diagnostics: setup.diagnostics,
  })

  const rawBuffer = await readMediaBuffer({
    reader: initialResponse.reader,
    firstChunk: initialResponse.firstChunk,
    diagnostics: setup.diagnostics,
    startTime: tStart,
  })

  const archiveEntry = await findArchiveEntry({
    rawBuffer,
    filename: filenameResolution.filename,
    isGoogleDrive: setup.isGoogleDrive,
    targetUrl: setup.targetUrl,
    fileSize,
    supportsRemoteSeekReads: didHonorRangeRequest(initialResponse.response),
  })

  const archiveAnalysis = await buildArchiveAnalysis({
    rawBuffer,
    archiveEntry,
    fileSize,
    diagnostics: setup.diagnostics,
  })

  return finishMediaFetch({
    startTime: tStart,
    buffer: archiveAnalysis.analysisBuffer,
    filename: filenameResolution.filename,
    filenameSource: filenameResolution.filenameSource,
    fileSize: archiveAnalysis.fileSize,
    archiveEntry,
    diagnostics: setup.diagnostics,
  })
}
