import type { AnalyzeProgressReporter } from "@mediapeek/shared/analyze-progress"
import { readStreamBytesWithinLimit } from "@mediapeek/shared/bounded-stream-read"

import { UpstreamFetchError, ValidationFailureError } from "../lib/error-utils"
import { getEmulationHeaders } from "../lib/server-utils"
import { safeMediaFetch } from "./safe-media-fetch.server"

const EXTERNAL_READ_TIMEOUT_MS = 30_000
export const MAX_INITIAL_READ_BYTES = 10 * 1024 * 1024
const REMOTE_RANGE_CHUNK_SIZE = 2 * 1024 * 1024
const REMOTE_RANGE_FETCH_LIMIT = 8 * 1024 * 1024
const REMOTE_RANGE_CACHE_LIMIT = 32 * 1024 * 1024

export interface MediaByteSource {
  initialBuffer: Uint8Array
  readChunk: (size: number, offset: number) => Promise<Uint8Array>
}

interface RemoteByteSourceDiagnostics {
  seekFetchCount?: number
  seekBytesFetched?: number
}

interface RemoteByteSourceDependencies {
  safeMediaFetch: typeof safeMediaFetch
}

export const createExternalReadSignal = (signal?: AbortSignal) => {
  const timeoutSignal = AbortSignal.timeout(EXTERNAL_READ_TIMEOUT_MS)

  return signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal
}

export const getExternalReadError = (cause: unknown, signal?: AbortSignal) => {
  if (!signal?.aborted) {
    return cause
  }

  if (signal.reason instanceof Error && signal.reason.name === "TimeoutError") {
    return new UpstreamFetchError("Media source read timed out.", cause)
  }

  return signal.reason ?? cause
}

export const readResponseBodyWithinLimit = async (
  response: Response,
  maxBytes: number,
  signal?: AbortSignal
): Promise<Uint8Array | null> => {
  const reader = response.body?.getReader()

  if (!reader) {
    return new Uint8Array(0)
  }

  try {
    return await readStreamBytesWithinLimit({
      reader,
      maxBytes,
      overflow: "reject",
      signal,
    })
  } catch (cause) {
    throw getExternalReadError(cause, signal)
  } finally {
    reader.releaseLock()
  }
}

const readRemoteSpanBody = async (
  response: Response,
  signal: AbortSignal
): Promise<Uint8Array> => {
  assertByteFetchStatus(response)

  const body = await readResponseBodyWithinLimit(
    response,
    MAX_INITIAL_READ_BYTES,
    signal
  )

  if (body === null) {
    throw new UpstreamFetchError(
      "Remote media response exceeded the maximum read size."
    )
  }

  return body
}

export const assertByteFetchStatus = (res: Response) => {
  if (res.status === 200 || res.status === 206) {
    return
  }

  if (res.status === 404) {
    throw new ValidationFailureError("Media file not found. Check the URL.")
  }

  if (res.status === 403) {
    throw new ValidationFailureError(
      "Access denied while fetching media bytes. The link may have expired or may block server-side requests."
    )
  }

  throw new UpstreamFetchError(
    `Unable to retrieve media bytes (HTTP ${String(res.status)}).`
  )
}

type RemoteByteSourceOptions = {
  url: string
  initialBuffer: Uint8Array
  fileSize?: number
  diagnostics: RemoteByteSourceDiagnostics
  reportProgress?: AnalyzeProgressReporter
  signal?: AbortSignal
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

const assertRemoteSpanResponse = (options: {
  response: Response
  body: Uint8Array
  spanStart: number
  spanEnd: number
  fileSize?: number
}) => {
  if (options.response.status !== 206) {
    return
  }

  const contentRange = options.response.headers.get("content-range")

  if (contentRange !== null) {
    const match = /^bytes (\d+)-(\d+)\/(\d+|\*)$/i.exec(contentRange)

    if (!match || Number(match[1]) !== options.spanStart) {
      throw new UpstreamFetchError("Origin returned a shifted byte range.")
    }
  }

  if (
    options.fileSize !== undefined &&
    options.body.byteLength < options.spanEnd - options.spanStart &&
    options.spanEnd < options.fileSize
  ) {
    throw new UpstreamFetchError("Origin returned fewer bytes than requested.")
  }
}

export const createRemoteByteSource = (
  options: RemoteByteSourceOptions,
  dependencies: RemoteByteSourceDependencies = { safeMediaFetch }
): MediaByteSource => {
  const { url, initialBuffer, fileSize, diagnostics, reportProgress, signal } =
    options

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
    signal?.throwIfAborted()
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

    const readSignal = createExternalReadSignal(signal)

    const response = await dependencies.safeMediaFetch(url, {
      headers: getEmulationHeaders(
        "bytes=" + String(spanStart) + "-" + String(spanEnd - 1)
      ),
      redirect: "follow",
      signal: readSignal,
    })

    const body = await readRemoteSpanBody(response, readSignal)
    assertRemoteSpanResponse({ body, fileSize, response, spanEnd, spanStart })

    diagnostics.seekFetchCount = (diagnostics.seekFetchCount ?? 0) + 1
    diagnostics.seekBytesFetched =
      (diagnostics.seekBytesFetched ?? 0) + body.byteLength
    let responseStart = spanStart

    if (response.status === 200 && spanStart > 0) {
      if (body.byteLength <= spanStart) {
        throw new UpstreamFetchError("Origin ignored byte-range seek request.")
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

  const copyRemoteChunk = async (readState: {
    result: Uint8Array
    requestedEnd: number
    cursor: number
    writeOffset: number
  }) => {
    const chunkStart = getRemoteChunkStart(readState.cursor)
    let cached = cache.get(chunkStart)

    if (!cached) {
      await fetchRemoteSpan(readState.cursor, readState.requestedEnd)
      cached = cache.get(chunkStart)
    }

    if (!cached || cached.bytes.byteLength === 0) {
      return null
    }

    touchChunk(chunkStart)

    const chunkOffset = readState.cursor - chunkStart

    if (chunkOffset >= cached.bytes.byteLength) {
      return null
    }

    const available = cached.bytes.subarray(chunkOffset)

    const bytesToCopy = Math.min(
      available.byteLength,
      readState.requestedEnd - readState.cursor
    )

    readState.result.set(
      available.subarray(0, bytesToCopy),
      readState.writeOffset
    )

    return {
      cursor: readState.cursor + bytesToCopy,
      writeOffset: readState.writeOffset + bytesToCopy,
    }
  }

  const fillRemoteRead = async (readState: {
    result: Uint8Array
    requestedEnd: number
    cursor: number
    writeOffset: number
  }): Promise<number> => {
    signal?.throwIfAborted()

    if (readState.cursor >= readState.requestedEnd) {
      return readState.writeOffset
    }

    if (readState.cursor < initialBuffer.byteLength) {
      const prefixEnd = Math.min(
        readState.requestedEnd,
        initialBuffer.byteLength
      )

      const prefixSlice = initialBuffer.subarray(readState.cursor, prefixEnd)

      readState.result.set(prefixSlice, readState.writeOffset)

      return fillRemoteRead({
        ...readState,
        cursor: prefixEnd,
        writeOffset: readState.writeOffset + prefixSlice.byteLength,
      })
    }

    const next = await copyRemoteChunk(readState)

    if (!next) {
      return readState.writeOffset
    }

    return fillRemoteRead({
      ...readState,
      ...next,
    })
  }

  return {
    initialBuffer,
    async readChunk(size: number, offset: number) {
      signal?.throwIfAborted()

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
