import type { ArchiveEntryInspection } from "@mediapeek/shared/archive-inspection"
import { Schema } from "effect"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  MediaInfoResultSchema,
  type JsonMediaInfo,
  type MediaInfoResult,
} from "../lib/media-utils"
import { fetchMediaChunk } from "./media-fetch.server"
import type { MediaInfoInstance } from "./mediainfo-factory.server"
import {
  analyzeMediaBuffer,
  CpuBudgetExceededError,
  type AnalyzeMediaBufferOptions,
} from "./mediainfo.server"

let mockAnalyzeDataResult: JsonMediaInfo = {
  media: {
    track: [{ "@type": "General" }],
  },
}

const mockInformResult = "General\n"

const createMockMediaInfo = async (): Promise<MediaInfoInstance> => ({
  options: {
    chunkSize: 0,
    coverData: false,
    format: "object",
    full: true,
  },
  reset() {},
  async analyzeData() {
    return mockAnalyzeDataResult
  },
  inform() {
    return mockInformResult
  },
  close() {},
})

const analyzeWithMockMediaInfo = (
  options: Omit<AnalyzeMediaBufferOptions, "dependencies">
) =>
  analyzeMediaBuffer({
    ...options,
    dependencies: { createMediaInfo: createMockMediaInfo },
  })

const parseMediaInfoResultJson = (json: string): MediaInfoResult =>
  Schema.decodeUnknownSync(MediaInfoResultSchema)(JSON.parse(json))

const makeResponse = (
  body: Uint8Array | null,
  init: { status: number; headers?: Record<string, string> }
) => new Response(body ? new Uint8Array(body).buffer : null, init)

const concatenateBuffers = (buffers: Uint8Array[]) => {
  const result = new Uint8Array(
    buffers.reduce((total, buffer) => total + buffer.length, 0)
  )

  let offset = 0

  for (const buffer of buffers) {
    result.set(buffer, offset)
    offset += buffer.length
  }

  return result
}

const createMockZipEntry = (name: string, content: Uint8Array) => {
  const nameBytes = new TextEncoder().encode(name)
  const header = new Uint8Array(30 + nameBytes.length)
  const view = new DataView(header.buffer)

  view.setUint32(0, 0x04034b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(8, 0, true)
  view.setUint32(18, content.length, true)
  view.setUint32(22, content.length, true)
  view.setUint16(26, nameBytes.length, true)
  view.setUint16(28, 0, true)
  header.set(nameBytes, 30)

  return concatenateBuffers([header, content])
}

const createMockZip = (name: string): Uint8Array =>
  createMockZipEntry(name, new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]))

const createMockZipWithDirectory = (): Uint8Array => {
  const directory = createMockZipEntry("Folder/", new Uint8Array(0))
  const file = createMockZip("Folder/inner-video.mkv")

  return concatenateBuffers([directory, file])
}

describe("fetchMediaChunk filename fallback", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("uses Content-Disposition from the ranged GET when HEAD has none", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        makeResponse(null, {
          status: 200,
          headers: {
            "content-type": "video/mp4",
            "content-length": "4",
          },
        })
      )
      .mockResolvedValueOnce(
        makeResponse(new Uint8Array([0, 1, 2, 3]), {
          status: 206,
          headers: {
            "content-type": "video/mp4",
            "content-disposition": 'attachment; filename="from-get.mp4"',
            "content-range": "bytes 0-3/4",
          },
        })
      )

    const result = await fetchMediaChunk({
      initialUrl: "https://example.com/token",
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.filename).toBe("from-get.mp4")
    expect(result.filenameSource).toBe("content-disposition-get")
    expect(result.diagnostics.resolvedFilename).toBe("from-get.mp4")
    expect(result.diagnostics.resolvedFilenameSource).toBe(
      "content-disposition-get"
    )
  })

  it("keeps the HEAD filename when both HEAD and GET expose Content-Disposition", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        makeResponse(null, {
          status: 200,
          headers: {
            "content-type": "video/mp4",
            "content-length": "4",
            "content-disposition": 'attachment; filename="from-head.mp4"',
          },
        })
      )
      .mockResolvedValueOnce(
        makeResponse(new Uint8Array([0, 1, 2, 3]), {
          status: 206,
          headers: {
            "content-type": "video/mp4",
            "content-disposition": 'attachment; filename="from-get.mp4"',
            "content-range": "bytes 0-3/4",
          },
        })
      )

    const result = await fetchMediaChunk({
      initialUrl: "https://example.com/token",
    })

    expect(result.filename).toBe("from-head.mp4")
    expect(result.filenameSource).toBe("content-disposition-head")
    expect(result.diagnostics.resolvedFilenameSource).toBe(
      "content-disposition-head"
    )
  })

  it("falls back to the URL token when neither HEAD nor GET expose a filename", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        makeResponse(null, {
          status: 200,
          headers: {
            "content-type": "video/mp4",
            "content-length": "4",
          },
        })
      )
      .mockResolvedValueOnce(
        makeResponse(new Uint8Array([0, 1, 2, 3]), {
          status: 206,
          headers: {
            "content-type": "video/mp4",
            "content-range": "bytes 0-3/4",
          },
        })
      )

    const result = await fetchMediaChunk({
      initialUrl: "https://example.com/url-token",
    })

    expect(result.filename).toBe("url-token")
    expect(result.filenameSource).toBe("url")
    expect(result.diagnostics.resolvedFilenameSource).toBe("url")
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

  it("uses the first real archive entry size for stored zip analysis", async () => {
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
    expect(result.diagnostics.resolvedFilename).toBe("Folder/inner-video.mkv")
  })
})

describe("MediaInfo diagnostics and CPU budget", () => {
  it("preserves the WASM and factory creation durations", async () => {
    const mediaInfo = await createMockMediaInfo()

    const result = await analyzeMediaBuffer({
      fileBuffer: new Uint8Array([1]),
      filename: "video.mp4",
      requestedFormats: ["json"],
      dependencies: {
        createMediaInfo: async () => ({
          ...mediaInfo,
          wasmLoadTimeMs: 7,
          factoryCreateTimeMs: 3,
        }),
      },
    })

    expect(result.diagnostics).toMatchObject({
      wasmLoadTimeMs: 7,
      factoryCreateTimeMs: 3,
    })
  })

  it("propagates CPU budget errors instead of returning a format error", async () => {
    const mediaInfo = await createMockMediaInfo()
    const cpuError = new CpuBudgetExceededError()
    mediaInfo.analyzeData = async () => {
      throw cpuError
    }

    await expect(
      analyzeMediaBuffer({
        fileBuffer: new Uint8Array([1]),
        filename: "video.mp4",
        requestedFormats: ["json"],
        dependencies: { createMediaInfo: async () => mediaInfo },
      })
    ).rejects.toMatchObject({
      name: "DiagnosticsError",
      message: "CPU budget exceeded",
      cause: cpuError,
    })
  })
})

describe("analyzeMediaBuffer filename fallback", () => {
  it("uses General.Title when the incoming filename only came from the URL", async () => {
    mockAnalyzeDataResult = {
      media: {
        track: [
          {
            "@type": "General",
            Title: "placeholder-title-token",
          },
        ],
      },
    }

    const result = await analyzeWithMockMediaInfo({
      fileBuffer: new Uint8Array([0, 1, 2, 3]),
      fileSize: 4,
      filename: "url-token",
      filenameSource: "url",
      requestedFormats: ["json"],
    })

    const json = parseMediaInfoResultJson(result.results.json)

    const generalTrack = json.media?.track?.find(
      (t) => t["@type"] === "General"
    )

    expect(result.resolvedFilename).toBe("placeholder-title-token")
    expect(result.resolvedFilenameSource).toBe("mediainfo-title")
    expect(generalTrack?.CompleteName).toBe("placeholder-title-token")
    expect(generalTrack?.Archive_Name).toBeUndefined()
  })

  it("falls back to General.Movie when Title is not usable", async () => {
    mockAnalyzeDataResult = {
      media: {
        track: [
          {
            "@type": "General",
            Title: "   ",
            Movie: "placeholder-movie-token",
          },
        ],
      },
    }

    const result = await analyzeWithMockMediaInfo({
      fileBuffer: new Uint8Array([0, 1, 2, 3]),
      fileSize: 4,
      filename: "url-token",
      filenameSource: "url",
      requestedFormats: ["json"],
    })

    expect(result.resolvedFilename).toBe("placeholder-movie-token")
    expect(result.resolvedFilenameSource).toBe("mediainfo-movie")
  })

  it("does not let Title override a header-derived filename", async () => {
    mockAnalyzeDataResult = {
      media: {
        track: [
          {
            "@type": "General",
            Title: "Should.Not.Win",
          },
        ],
      },
    }

    const result = await analyzeWithMockMediaInfo({
      fileBuffer: new Uint8Array([0, 1, 2, 3]),
      fileSize: 4,
      filename: "from-head.mp4",
      filenameSource: "content-disposition-head",
      requestedFormats: ["json"],
    })

    const json = parseMediaInfoResultJson(result.results.json)

    const generalTrack = json.media?.track?.find(
      (t) => t["@type"] === "General"
    )

    expect(result.resolvedFilename).toBe("from-head.mp4")
    expect(result.resolvedFilenameSource).toBe("content-disposition-head")
    expect(generalTrack?.CompleteName).toBe("from-head.mp4")
  })

  it("keeps archive inner filenames ahead of MediaInfo metadata and sets Archive_Name", async () => {
    mockAnalyzeDataResult = {
      media: {
        track: [
          {
            "@type": "General",
            Title: "Wrong.Title",
          },
        ],
      },
    }

    const result = await analyzeWithMockMediaInfo({
      fileBuffer: createMockZip("inner-video.mkv"),
      fileSize: 64,
      filename: "outer.zip",
      filenameSource: "content-disposition-get",
      requestedFormats: ["json"],
    })

    const json = parseMediaInfoResultJson(result.results.json)

    const generalTrack = json.media?.track?.find(
      (t) => t["@type"] === "General"
    )

    expect(result.resolvedFilename).toBe("inner-video.mkv")
    expect(result.resolvedFilenameSource).toBe("archive-inner")
    expect(result.diagnostics.archiveFilename).toBe("outer.zip")
    expect(generalTrack?.CompleteName).toBe("inner-video.mkv")
    expect(generalTrack?.Archive_Name).toBe("outer.zip")
  })

  it("adds archive sizing warnings when the inner archive size is estimated", async () => {
    mockAnalyzeDataResult = {
      media: {
        track: [{ "@type": "General" }],
      },
    }

    const archiveEntry: ArchiveEntryInspection = {
      name: "inner-video.mkv",
      archiveKind: "zip",
      compression: "deflate",
      dataOffset: 0,
      sizeStatus: "estimated",
      sizeSource: "unknown",
    }

    const result = await analyzeWithMockMediaInfo({
      fileBuffer: new Uint8Array([0, 1, 2, 3]),
      fileSize: 999,
      filename: "outer.zip",
      filenameSource: "content-disposition-get",
      requestedFormats: ["json"],
      archiveEntry,
    })

    const json = parseMediaInfoResultJson(result.results.json)

    const generalTrack = json.media?.track?.find(
      (t) => t["@type"] === "General"
    )

    expect(generalTrack?.Archive_Name).toBe("outer.zip")
    expect(generalTrack?.Archive_Sizing_Status).toBe("estimated")
    expect(generalTrack?.Archive_Sizing_Source).toBe("unknown")
    expect(generalTrack?.Archive_Sizing_Warning).toContain("may be inaccurate")
  })
})
