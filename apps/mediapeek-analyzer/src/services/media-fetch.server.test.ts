import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { UpstreamFetchError, ValidationFailureError } from "../lib/error-utils"
import { fetchMediaChunk } from "./media-fetch.server"

const makeResponse = (
  body: Uint8Array | null,
  init: { status: number; headers?: Record<string, string> }
) => new Response(body ? new Uint8Array(body).buffer : null, init)

const createOversizedResponseBody = () => {
  const cancel = vi.fn()

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(10 * 1024 * 1024 + 1))
    },
    cancel,
  })

  return { body, cancel }
}

const createZipDirectoryHeader = () => {
  const name = new TextEncoder().encode("Folder/")
  const header = new Uint8Array(30 + name.length)
  const view = new DataView(header.buffer)

  view.setUint32(0, 0x04034b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(8, 0, true)
  view.setUint32(18, 0, true)
  view.setUint32(22, 0, true)
  view.setUint16(26, name.length, true)
  view.setUint16(28, 0, true)
  header.set(name, 30)

  return header
}

const createZipFileHeader = (dataDescriptor = false) => {
  const name = new TextEncoder().encode("Folder/inner-video.mkv")
  const header = new Uint8Array(30 + name.length + 4)
  const view = new DataView(header.buffer)

  view.setUint32(0, 0x04034b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(6, dataDescriptor ? 0x08 : 0, true)
  view.setUint16(8, 0, true)
  view.setUint32(18, dataDescriptor ? 0 : 4, true)
  view.setUint32(22, dataDescriptor ? 0 : 4, true)
  view.setUint16(26, name.length, true)
  view.setUint16(28, 0, true)
  header.set(name, 30)
  header.set(new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]), 30 + name.length)

  return header
}

const createMockZipWithDirectory = (): Uint8Array => {
  const directoryHeader = createZipDirectoryHeader()
  const fileHeader = createZipFileHeader()
  const buffer = new Uint8Array(directoryHeader.length + fileHeader.length)

  buffer.set(directoryHeader, 0)
  buffer.set(fileHeader, directoryHeader.length)

  return buffer
}

describe("fetchMediaChunk", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("uses Content-Range from the ranged GET when HEAD hides the real file size", async () => {
    const proxiedFilename = "proxy-media-sample.mkv"
    const proxiedUrl = "https://proxy.example.test/r/opaque-token"

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        makeResponse(null, {
          status: 200,
          headers: {
            "content-type": "text/plain;charset=UTF-8",
            "content-length": "1256",
          },
        })
      )
      .mockResolvedValueOnce(
        makeResponse(new Uint8Array([0, 1, 2, 3]), {
          status: 206,
          headers: {
            "content-type": "application/octet-stream",
            "content-range": "bytes 0-3/4373212360",
            "content-disposition": `attachment; filename="${proxiedFilename}"`,
          },
        })
      )

    const result = await fetchMediaChunk({ initialUrl: proxiedUrl })

    expect(result.fileSize).toBe(4_373_212_360)
    expect(result.filename).toBe(proxiedFilename)
    expect(result.filenameSource).toBe("content-disposition-get")
  })

  it("does not reject a direct media URL just because the HEAD probe returns HTML", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        makeResponse(null, {
          status: 200,
          headers: {
            "content-type": "text/html; charset=UTF-8",
          },
        })
      )
      .mockResolvedValueOnce(
        makeResponse(new Uint8Array([0, 1, 2, 3]), {
          status: 206,
          headers: {
            "content-type": "application/octet-stream",
            "content-range": "bytes 0-3/4",
            "content-disposition": 'attachment; filename="from-get.mp4"',
          },
        })
      )

    const result = await fetchMediaChunk({
      initialUrl: "https://example.com/tokenized-media",
    })

    expect(result.fileSize).toBe(4)
    expect(result.filename).toBe("from-get.mp4")
    expect(result.filenameSource).toBe("content-disposition-get")
  })

  it("uses a valid range for an empty file and classifies its 416 response", async () => {
    let rangeHeader: string | null = null

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        makeResponse(null, {
          status: 200,
          headers: {
            "content-type": "application/octet-stream",
            "content-length": "0",
          },
        })
      )
      .mockImplementationOnce(async (_input, init) => {
        rangeHeader = new Headers(init?.headers).get("range")

        return makeResponse(null, { status: 416 })
      })

    await expect(
      fetchMediaChunk({ initialUrl: "https://example.com/empty.mp4" })
    ).rejects.toBeInstanceOf(ValidationFailureError)
    expect(rangeHeader).toMatch(/^bytes=0-\d+$/)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("uses verified inner archive size for stored zip entries", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        makeResponse(null, {
          status: 200,
          headers: {
            "content-type": "application/octet-stream",
            "content-length": "999",
            "content-disposition": 'attachment; filename="outer.zip"',
          },
        })
      )
      .mockResolvedValueOnce(
        makeResponse(createMockZipWithDirectory(), {
          status: 206,
          headers: {
            "content-type": "application/octet-stream",
            "content-range": "bytes 0-255/999",
          },
        })
      )

    const result = await fetchMediaChunk({
      initialUrl: "https://example.com/archive",
    })

    expect(result.fileSize).toBe(4)
    expect(Array.from(result.buffer)).toEqual([0xaa, 0xbb, 0xcc, 0xdd])
    expect(result.archiveEntry).toMatchObject({
      name: "Folder/inner-video.mkv",
      sizeStatus: "verified",
      sizeSource: "zip-local-header",
    })
  })

  it("fetches additional byte ranges when reads seek past the initial prefix", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    fetchSpy
      .mockResolvedValueOnce(
        makeResponse(null, {
          status: 200,
          headers: {
            "content-type": "application/octet-stream",
            "content-length": "30",
            "accept-ranges": "bytes",
            "content-disposition": 'attachment; filename="sample.m4a"',
          },
        })
      )
      .mockResolvedValueOnce(
        makeResponse(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), {
          status: 206,
          headers: {
            "content-type": "application/octet-stream",
            "content-range": "bytes 0-9/30",
          },
        })
      )
      .mockResolvedValueOnce(
        makeResponse(
          new Uint8Array([
            10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26,
            27, 28, 29,
          ]),
          {
            status: 206,
            headers: {
              "content-type": "application/octet-stream",
              "content-range": "bytes 10-29/30",
            },
          }
        )
      )

    const result = await fetchMediaChunk({
      initialUrl: "https://example.com/audio",
    })

    expect(result.byteSource).toBeDefined()
    await expect(result.byteSource?.readChunk(4, 2)).resolves.toEqual(
      new Uint8Array([2, 3, 4, 5])
    )
    await expect(result.byteSource?.readChunk(4, 20)).resolves.toEqual(
      new Uint8Array([20, 21, 22, 23])
    )
    await expect(result.byteSource?.readChunk(4, 24)).resolves.toEqual(
      new Uint8Array([24, 25, 26, 27])
    )

    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(result.diagnostics.seekFetchCount).toBe(1)
    expect(result.diagnostics.seekBytesFetched).toBe(20)
  })

  it("does not expose a remote seek reader when the origin ignores the range request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    fetchSpy
      .mockResolvedValueOnce(
        makeResponse(null, {
          status: 200,
          headers: {
            "content-type": "application/octet-stream",
            "content-length": "30",
            "content-disposition": 'attachment; filename="sample.mkv"',
          },
        })
      )
      .mockResolvedValueOnce(
        makeResponse(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), {
          status: 200,
          headers: {
            "content-type": "application/octet-stream",
            "content-length": "30",
          },
        })
      )

    const result = await fetchMediaChunk({
      initialUrl: "https://example.com/non-range",
    })

    expect(result.byteSource).toBeUndefined()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it("cancels an oversized zip tail response and keeps the estimated size", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const oversized = createOversizedResponseBody()
    const zipHeader = createZipFileHeader(true)

    fetchSpy
      .mockResolvedValueOnce(
        makeResponse(null, {
          status: 200,
          headers: {
            "content-length": "999",
            "accept-ranges": "bytes",
            "content-disposition": 'attachment; filename="outer.zip"',
          },
        })
      )
      .mockResolvedValueOnce(
        makeResponse(zipHeader, {
          status: 206,
          headers: {
            "content-range": `bytes 0-${String(zipHeader.byteLength - 1)}/999`,
          },
        })
      )
      .mockResolvedValueOnce(new Response(oversized.body, { status: 206 }))

    const result = await fetchMediaChunk({
      initialUrl: "https://example.com/archive.zip",
    })

    expect(fetchSpy).toHaveBeenCalledTimes(3)
    expect(oversized.cancel).toHaveBeenCalledOnce()
    expect(result.archiveEntry).toMatchObject({ sizeStatus: "estimated" })
  })

  it("cancels an oversized remote range response", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const oversized = createOversizedResponseBody()

    fetchSpy
      .mockResolvedValueOnce(
        makeResponse(null, {
          status: 200,
          headers: {
            "content-length": "30",
            "accept-ranges": "bytes",
            "content-disposition": 'attachment; filename="sample.mkv"',
          },
        })
      )
      .mockResolvedValueOnce(
        makeResponse(new Uint8Array(10), {
          status: 206,
          headers: { "content-range": "bytes 0-9/30" },
        })
      )
      .mockResolvedValueOnce(new Response(oversized.body, { status: 206 }))

    const result = await fetchMediaChunk({
      initialUrl: "https://example.com/media",
    })

    await expect(result.byteSource?.readChunk(4, 20)).rejects.toThrow(
      "Remote media response exceeded the maximum read size."
    )
    expect(oversized.cancel).toHaveBeenCalledOnce()
    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })

  it("fails an additional range read after its deadline expires", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const originalTimeout = AbortSignal.timeout.bind(AbortSignal)

    let timeoutCall = 0

    const deadlineError = new DOMException(
      "The operation timed out.",
      "TimeoutError"
    )

    vi.spyOn(AbortSignal, "timeout").mockImplementation((milliseconds) => {
      timeoutCall += 1

      return timeoutCall === 3
        ? AbortSignal.abort(deadlineError)
        : originalTimeout(milliseconds)
    })

    fetchSpy
      .mockResolvedValueOnce(
        makeResponse(null, {
          status: 200,
          headers: {
            "content-length": "30",
            "accept-ranges": "bytes",
            "content-disposition": 'attachment; filename="sample.mkv"',
          },
        })
      )
      .mockResolvedValueOnce(
        makeResponse(new Uint8Array(10), {
          status: 206,
          headers: { "content-range": "bytes 0-9/30" },
        })
      )
      .mockResolvedValueOnce(
        makeResponse(new Uint8Array(10), {
          status: 206,
          headers: { "content-range": "bytes 10-19/30" },
        })
      )

    const result = await fetchMediaChunk({
      initialUrl: "https://example.com/media",
    })

    await expect(result.byteSource?.readChunk(4, 20)).rejects.toBeInstanceOf(
      UpstreamFetchError
    )
    expect(timeoutCall).toBe(3)

    expect(fetchSpy).toHaveBeenCalledTimes(3)
  })
})
