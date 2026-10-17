import { beforeEach, describe, expect, it, vi } from "vitest"

import { createAnalysisExecutor } from "./analysis-execution.server"
import type { fetchMediaChunk } from "./media-fetch.server"
import type { analyzeMediaBuffer } from "./mediainfo.server"

const fetchMediaChunkMock = vi.fn<typeof fetchMediaChunk>()
const analyzeMediaBufferMock = vi.fn<typeof analyzeMediaBuffer>()

const executeAnalysis = createAnalysisExecutor({
  fetchMediaChunk: fetchMediaChunkMock,
  analyzeMediaBuffer: analyzeMediaBufferMock,
})

describe("analysis execution", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMediaChunkMock.mockResolvedValue({
      buffer: new Uint8Array([1, 2, 3]),
      byteSource: undefined,
      fileSize: 3,
      filename: "video.mp4",
      filenameSource: "url",
      diagnostics: {
        headRequestDurationMs: 0,
        fetchRequestDurationMs: 1,
        totalDurationMs: 1,
        isGoogleDrive: false,
        resolvedFilename: "video.mp4",
        resolvedFilenameSource: "url",
        responseStatus: 206,
        probeMethod: "range",
      },
      archiveEntry: undefined,
    })
    analyzeMediaBufferMock.mockResolvedValue({
      results: { json: '{"media":{}}' },
      diagnostics: {
        wasmLoadTimeMs: 0,
        factoryCreateTimeMs: 0,
        formatGenerationTimes: { json: 1 },
        totalAnalysisTimeMs: 7,
        formatErrors: {},
      },
      resolvedFilename: "video.mp4",
      resolvedFilenameSource: "url",
    })
  })

  it("returns one terminal outcome and preserves progress ordering", async () => {
    const progress: string[] = []

    const result = await executeAnalysis({
      url: "https://example.com/video.mp4",
      formats: ["json"],
      cpuBudgetMs: 25_000,
      signal: new AbortController().signal,
      reportProgress: (stage) => {
        progress.push(stage)
      },
    })

    expect(result).toMatchObject({
      fileSize: 3,
      results: { json: '{"media":{}}' },
      resolvedFilename: "video.mp4",
      resolvedFilenameSource: "url",
      cpuBudgetRemainingMs: 24_993,
      diagnostics: { fetch: {}, analysis: { totalAnalysisTimeMs: 7 } },
    })
    expect(progress[0]).toBe("request_received")
  })

  it("propagates cancellation before source acquisition", async () => {
    const controller = new AbortController()
    controller.abort()

    await expect(
      executeAnalysis({
        url: "https://example.com/video.mp4",
        formats: ["json"],
        cpuBudgetMs: 25_000,
        signal: controller.signal,
      })
    ).rejects.toHaveProperty("name", "AbortError")
    expect(fetchMediaChunkMock).not.toHaveBeenCalled()
  })

  it("keeps archive and range handoff facts inside execution", async () => {
    const readChunk =
      vi.fn<(size: number, offset: number) => Promise<Uint8Array>>()

    const archiveEntry = {
      name: "inner.mkv",
      archiveKind: "zip" as const,
      compression: "stored" as const,
      uncompressedSize: 42,
      sizeStatus: "verified" as const,
      sizeSource: "zip-central-directory" as const,
    }

    fetchMediaChunkMock.mockResolvedValue({
      buffer: new Uint8Array([1]),
      byteSource: { initialBuffer: new Uint8Array([1]), readChunk },
      fileSize: 42,
      filename: "outer.zip",
      filenameSource: "url",
      diagnostics: {
        headRequestDurationMs: 0,
        fetchRequestDurationMs: 1,
        totalDurationMs: 1,
        isGoogleDrive: false,
        resolvedFilename: "inner.mkv",
        resolvedFilenameSource: "archive-inner",
        responseStatus: 206,
        probeMethod: "range",
      },
      archiveEntry,
    })

    await executeAnalysis({
      url: "https://example.com/outer.zip",
      formats: ["json"],
      cpuBudgetMs: 25_000,
      signal: new AbortController().signal,
    })

    expect(analyzeMediaBufferMock).toHaveBeenCalledWith({
      fileBuffer: expect.any(Uint8Array),
      fileSize: 42,
      filename: "outer.zip",
      filenameSource: "url",
      requestedFormats: ["json"],
      cpuBudgetMs: 25_000,
      archiveEntry,
      remoteReadChunk: readChunk,
      reportProgress: undefined,
      signal: expect.any(AbortSignal),
    })
  })
})
