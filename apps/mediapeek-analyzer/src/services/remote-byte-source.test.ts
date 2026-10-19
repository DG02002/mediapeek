import { beforeEach, describe, expect, it, vi } from "vitest"

import { createRemoteByteSource } from "./remote-byte-source"
import type { safeMediaFetch } from "./safe-media-fetch.server"

const REMOTE_RANGE_CHUNK_SIZE = 2 * 1024 * 1024

const mockedSafeMediaFetch = vi.fn<typeof safeMediaFetch>()

interface SeekFetchDiagnostics {
  seekFetchCount?: number
  seekBytesFetched?: number
}

const createDeferred = <Value>() => {
  let resolveDeferred: ((value: Value | PromiseLike<Value>) => void) | undefined

  const promise = new Promise<Value>((resolve) => {
    resolveDeferred = resolve
  })

  return {
    promise,
    resolve: (value: Value) => resolveDeferred?.(value),
  }
}

const mockRangeResponse = async (_input: string | URL, init?: RequestInit) => {
  const range = new Headers(init?.headers).get("range")
  const match = /^bytes=(\d+)-(\d+)$/.exec(range ?? "")

  if (!match) {
    throw new Error("Expected a byte range request.")
  }

  const start = Number(match[1])
  const end = Number(match[2])
  const body = new Uint8Array(end - start + 1)
  body.fill(start % 256)

  return new Response(body, { status: 206 })
}

describe("createRemoteByteSource", () => {
  beforeEach(() => {
    mockedSafeMediaFetch.mockReset()
    mockedSafeMediaFetch.mockImplementation(mockRangeResponse)
  })

  it("aligns remote spans to chunk boundaries", async () => {
    const initialBuffer = new Uint8Array(7)

    const remoteChunkStart =
      initialBuffer.byteLength + 2 * REMOTE_RANGE_CHUNK_SIZE

    const source = createRemoteByteSource(
      {
        url: "https://example.com/media.mp4",
        initialBuffer,
        fileSize: 10 * REMOTE_RANGE_CHUNK_SIZE,
        diagnostics: {},
      },
      { safeMediaFetch: mockedSafeMediaFetch }
    )

    await source.readChunk(3, remoteChunkStart + 9)

    expect(mockedSafeMediaFetch).toHaveBeenCalledTimes(1)
    const [, init] = mockedSafeMediaFetch.mock.calls[0] ?? []
    expect(new Headers(init?.headers).get("range")).toBe(
      `bytes=${String(remoteChunkStart)}-${String(remoteChunkStart + REMOTE_RANGE_CHUNK_SIZE - 1)}`
    )
  })

  it("evicts the least recently used cached chunk at the 32 MB cap", async () => {
    const initialBuffer = new Uint8Array(4)

    const diagnostics = {}

    const source = createRemoteByteSource(
      {
        url: "https://example.com/media.mp4",
        initialBuffer,
        fileSize: initialBuffer.byteLength + 17 * REMOTE_RANGE_CHUNK_SIZE,
        diagnostics,
      },
      { safeMediaFetch: mockedSafeMediaFetch }
    )

    const initialChunkReads = Array.from({ length: 16 }).reduce<Promise<void>>(
      (previousRead, _unused, chunkIndex) =>
        previousRead.then(() =>
          source
            .readChunk(
              1,
              initialBuffer.byteLength +
                chunkIndex * REMOTE_RANGE_CHUNK_SIZE +
                1
            )
            .then(() => undefined)
        ),
      Promise.resolve()
    )

    await initialChunkReads

    await source.readChunk(1, initialBuffer.byteLength + 1)
    await source.readChunk(
      1,
      initialBuffer.byteLength + 16 * REMOTE_RANGE_CHUNK_SIZE + 1
    )
    await source.readChunk(1, initialBuffer.byteLength + 1)

    expect(mockedSafeMediaFetch).toHaveBeenCalledTimes(17)

    await source.readChunk(
      1,
      initialBuffer.byteLength + REMOTE_RANGE_CHUNK_SIZE + 1
    )

    expect(mockedSafeMediaFetch).toHaveBeenCalledTimes(18)
  })

  it("accounts for remote seek requests and bytes", async () => {
    const diagnostics = {} satisfies SeekFetchDiagnostics

    const source = createRemoteByteSource(
      {
        url: "https://example.com/media.mp4",
        initialBuffer: new Uint8Array(4),
        fileSize: 20,
        diagnostics,
      },
      { safeMediaFetch: mockedSafeMediaFetch }
    )

    await source.readChunk(5, 10)

    expect(diagnostics).toEqual({ seekFetchCount: 1, seekBytesFetched: 16 })
  })

  it("propagates cancellation to an active range request", async () => {
    const controller = new AbortController()
    const abortError = new Error("The read was cancelled.")
    const fetchStarted = createDeferred<AbortSignal>()

    mockedSafeMediaFetch.mockImplementation((_input, init) => {
      const signal = init?.signal

      if (!signal) {
        throw new Error("Expected a cancellation signal.")
      }

      fetchStarted.resolve(signal)

      return new Promise<Response>((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), {
          once: true,
        })
      })
    })

    const source = createRemoteByteSource(
      {
        url: "https://example.com/media.mp4",
        initialBuffer: new Uint8Array(4),
        fileSize: 20,
        diagnostics: {},
        signal: controller.signal,
      },
      { safeMediaFetch: mockedSafeMediaFetch }
    )

    const read = source.readChunk(1, 10)
    const requestSignal = await fetchStarted.promise

    expect(requestSignal.aborted).toBe(false)
    controller.abort(abortError)

    await expect(read).rejects.toBe(abortError)
  })
})
