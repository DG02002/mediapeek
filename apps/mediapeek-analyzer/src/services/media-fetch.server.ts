import type { AnalyzeProgressReporter } from "@mediapeek/shared/analyze-progress"
import {
  type ArchiveEntryInspection,
  inspectArchiveEntry,
} from "@mediapeek/shared/archive-inspection"
import { readStreamBytesWithinLimit } from "@mediapeek/shared/bounded-stream-read"
import {
  type FilenameSource,
  parseContentDispositionFilename,
} from "@mediapeek/shared/filename-resolution"

import {
  AnalyzerReadTimeoutError,
  RateLimitedError,
  UpstreamFetchError,
  ValidationFailureError,
  DiagnosticsError,
} from "../lib/error-utils"
import {
  extractFilenameFromUrl,
  getEmulationHeaders,
  isArchiveExtension,
  validateUrl,
} from "../lib/server-utils"
import { resolveSource } from "../lib/source-resolver"
import {
  assertByteFetchStatus,
  createExternalReadSignal,
  createRemoteByteSource,
  getExternalReadError,
  MAX_INITIAL_READ_BYTES,
  readResponseBodyWithinLimit,
  type MediaByteSource,
} from "./remote-byte-source"
import { safeMediaFetch } from "./safe-media-fetch.server"

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
const ZIP_TAIL_INSPECTION_BYTES = 128 * 1024

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

export interface FetchMediaChunkOptions {
  initialUrl: string
  chunkSize?: number
  reportProgress?: AnalyzeProgressReporter
  signal?: AbortSignal
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

const readFirstChunkWithTimeout = async (
  sourceReader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number
) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new AnalyzerReadTimeoutError())
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

const readStreamIntoBuffer = async (options: {
  readonly reader: ReadableStreamDefaultReader<Uint8Array>
  readonly firstChunk: Uint8Array | null
  readonly limit: number
  readonly signal: AbortSignal
}) => {
  try {
    return (
      (await readStreamBytesWithinLimit({
        reader: options.reader,
        maxBytes: options.limit,
        firstChunk: options.firstChunk,
        overflow: "truncate",
        signal: options.signal,
      })) ?? new Uint8Array(0)
    )
  } catch (cause) {
    throw getExternalReadError(cause, options.signal)
  }
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

    return readCompressedPrefix(compressedPrefix, MAX_INITIAL_READ_BYTES)
  }

  return null
}

const fetchZipTailBuffer = async (
  url: string,
  totalSize: number,
  signal?: AbortSignal
): Promise<Uint8Array | null> => {
  if (!Number.isFinite(totalSize) || totalSize <= 0) {
    return null
  }

  const start = Math.max(0, totalSize - ZIP_TAIL_INSPECTION_BYTES)
  const readSignal = createExternalReadSignal(signal)

  const response = await safeMediaFetch(url, {
    headers: getEmulationHeaders(
      `bytes=${String(start)}-${String(totalSize - 1)}`
    ),
    redirect: "follow",
    signal: readSignal,
  })

  if (response.status !== 200 && response.status !== 206) {
    return null
  }

  return readResponseBodyWithinLimit(
    response,
    MAX_INITIAL_READ_BYTES,
    readSignal
  )
}

type ProbeResult = {
  url: string
  isGoogleDrive: boolean
  htmlResponseMessage: string
  htmlResponseKind: "rate-limited" | "validation"
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
  signal: AbortSignal
}

type InitialReadResult = {
  response: Response
  reader: ReadableStreamDefaultReader<Uint8Array>
  firstChunk: Uint8Array | null
  timeoutRetries: number
  strategy: InitialResponseRead["strategy"]
  signal: AbortSignal
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

const fetchHeaderProbe = async (url: string, signal?: AbortSignal) => {
  let method = "HEAD"
  let readSignal = createExternalReadSignal(signal)

  let response = await safeMediaFetch(url, {
    method: "HEAD",
    headers: getEmulationHeaders(),
    redirect: "follow",
    signal: readSignal,
  })

  if (response.status === 405) {
    method = "GET"
    readSignal = createExternalReadSignal(signal)
    response = await safeMediaFetch(url, {
      method: "GET",
      headers: getEmulationHeaders("bytes=0-0"),
      redirect: "follow",
      signal: readSignal,
    })
  }

  return { method, response }
}

const assertProbeStatus = (response: Response) => {
  if (response.ok) {
    return
  }

  if (response.status === 404) {
    throw new ValidationFailureError("Media file not found. Check the URL.")
  }

  if (response.status === 403) {
    throw new ValidationFailureError(
      "Access denied. The link may have expired or requires authentication."
    )
  }

  throw new UpstreamFetchError(
    "Unable to access file (HTTP " + String(response.status) + ")."
  )
}

const probeRemoteSource = async (
  initialUrl: string,
  reportProgress?: AnalyzeProgressReporter,
  signal?: AbortSignal
): Promise<ProbeResult> => {
  const source = resolveSource(initialUrl)

  if (source.status === "unsupported") {
    throw new ValidationFailureError(source.message)
  }

  const url = source.targetUrl
  const isGoogleDrive = source.provider === "google-drive"
  validateUrl(url)
  await reportProgress?.(
    "source_probe_started",
    "Checking Source Headers",
    "Sending an initial probe request to inspect the source response."
  )

  const probeStart = performance.now()
  const { method, response } = await fetchHeaderProbe(url, signal)
  const probeDurationMs = Math.round(performance.now() - probeStart)
  assertProbeStatus(response)

  const filename = extractFilenameFromUrl(url)

  const headerFilename = parseContentDispositionFilename(
    response.headers.get("content-disposition")
  )

  return {
    url,
    isGoogleDrive,
    htmlResponseMessage: source.htmlResponseMessage,
    htmlResponseKind: isGoogleDrive ? "rate-limited" : "validation",
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
  reportProgress?: AnalyzeProgressReporter
  signal?: AbortSignal
  fileSize?: number
  waitingMessage: string
  receivedMessage: string
}): Promise<InitialResponseRead> => {
  const readSignal = createExternalReadSignal(options.signal)

  const response = await safeMediaFetch(options.url, {
    headers: options.headers,
    redirect: "follow",
    signal: readSignal,
  })

  if (response.status === 416 && options.fileSize === 0) {
    throw new ValidationFailureError("The media source is empty.")
  }

  assertByteFetchStatus(response)

  const reader = response.body?.getReader()

  if (!reader) {
    throw new UpstreamFetchError("Failed to retrieve response body stream.")
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
    signal: readSignal,
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
    fileSize?: number
    reportProgress?: AnalyzeProgressReporter
    signal?: AbortSignal
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
      signal: options.signal,
      fileSize: options.fileSize,
      waitingMessage:
        "The source accepted the request but has not started sending media bytes yet.",
      receivedMessage:
        "Initial media bytes arrived. Continuing the fetch and inspection step.",
    })

    return { initialRead, timeoutRetries: attempt }
  } catch (error) {
    const timedOut = error instanceof AnalyzerReadTimeoutError

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
  fileSize?: number
  reportProgress?: AnalyzeProgressReporter
  signal?: AbortSignal
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
      signal: options.signal,
      fileSize: options.fileSize,
      waitingMessage:
        "Waiting for the source to start sending bytes for the fallback request.",
      receivedMessage: "Initial media bytes arrived from the fallback request.",
    })
  } catch (error) {
    const timedOut = error instanceof AnalyzerReadTimeoutError

    if (!timedOut) {
      throw error
    }

    const message = options.didRangeTimeout
      ? "Fetch stream read timed out after " +
        String(options.timeoutRetries) +
        " range attempt(s) and no-range fallback"
      : "Fetch stream read timed out during no-range fallback"

    throw new UpstreamFetchError(message, error)
  }
}

const fetchInitialResponse = async (options: {
  url: string
  fetchEnd: number
  fileSize?: number
  diagnostics: FetchDiagnostics
  reportProgress?: AnalyzeProgressReporter
  signal?: AbortSignal
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
    fileSize: options.fileSize,
    reportProgress: options.reportProgress,
    signal: options.signal,
  })

  const didRangeTimeout = rangedResult.timeoutRetries > 0

  const initialRead =
    rangedResult.initialRead ??
    (await fetchNoRangeFallback({
      url: options.url,
      timeoutRetries: rangedResult.timeoutRetries,
      didRangeTimeout,
      fileSize: options.fileSize,
      reportProgress: options.reportProgress,
      signal: options.signal,
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

const assertMediaResponse = (options: {
  readonly response: Response
  readonly reader: ReadableStreamDefaultReader<Uint8Array>
  readonly htmlResponseMessage: string
  readonly htmlResponseKind: "rate-limited" | "validation"
}) => {
  if (!isHtmlResponse(options.response)) {
    return
  }

  void options.reader.cancel()

  throw options.htmlResponseKind === "rate-limited"
    ? new RateLimitedError(options.htmlResponseMessage)
    : new ValidationFailureError(options.htmlResponseMessage)
}

const resolveInitialMetadata = (options: {
  response: Response
  fileSize?: number
  filename: string
  filenameSource: FilenameSource
  diagnostics: FetchDiagnostics
}) => {
  const fileSize = resolveResponseFileSize(options.response) ?? options.fileSize

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
  signal: AbortSignal
}): Promise<Uint8Array> => {
  try {
    return await readStreamIntoBuffer({
      reader: options.reader,
      firstChunk: options.firstChunk,
      limit: MAX_INITIAL_READ_BYTES,
      signal: options.signal,
    })
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
  reportProgress?: AnalyzeProgressReporter
  signal?: AbortSignal
}) => {
  const fetchEnd =
    options.probe.fileSize !== undefined
      ? Math.max(0, Math.min(options.chunkSize - 1, options.probe.fileSize - 1))
      : options.chunkSize - 1

  const initialRead = await fetchInitialResponse({
    url: options.probe.url,
    fetchEnd,
    fileSize: options.probe.fileSize,
    diagnostics: options.diagnostics,
    reportProgress: options.reportProgress,
    signal: options.signal,
  })

  assertMediaResponse({
    response: initialRead.response,
    reader: initialRead.reader,
    htmlResponseMessage: options.probe.htmlResponseMessage,
    htmlResponseKind: options.probe.htmlResponseKind,
  })

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
    signal: initialRead.signal,
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
  signal?: AbortSignal
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

  const tailBuffer = await fetchZipTailBuffer(
    options.url,
    options.fileSize,
    options.signal
  )

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
  reportProgress?: AnalyzeProgressReporter
  signal?: AbortSignal
}): MediaFetchResult => {
  let byteSource: MediaByteSource | undefined

  if (!options.archiveEntry && options.initial.supportsRemoteSeekReads) {
    byteSource = createRemoteByteSource({
      url: options.probe.url,
      initialBuffer: options.initial.rawBuffer,
      fileSize: options.content.fileSize,
      diagnostics: options.diagnostics,
      reportProgress: options.reportProgress,
      signal: options.signal,
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

export async function fetchMediaChunk({
  initialUrl,
  chunkSize = MAX_INITIAL_READ_BYTES,
  reportProgress,
  signal,
}: FetchMediaChunkOptions): Promise<MediaFetchResult> {
  signal?.throwIfAborted()
  const startedAt = performance.now()
  const diagnostics = createFetchDiagnostics()
  const probe = await probeRemoteSource(initialUrl, reportProgress, signal)
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
    signal,
  })

  const archiveEntry = await inspectFetchedArchive({
    rawBuffer: initial.rawBuffer,
    filename: initial.filename,
    fileSize: initial.fileSize,
    isGoogleDrive: probe.isGoogleDrive,
    supportsRemoteSeekReads: initial.supportsRemoteSeekReads,
    url: probe.url,
    signal,
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
    signal,
  })

  return result
}
