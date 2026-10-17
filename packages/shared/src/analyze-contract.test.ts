import { Result, Schema } from "effect"
import { describe, expect, it } from "vitest"

import {
  AnalyzerRpcResponseSchema,
  AnalyzeResponseSchema,
} from "./analyze-contract"

const diagnostics = {
  fetch: {
    headRequestDurationMs: 1,
    fetchRequestDurationMs: 2,
    totalDurationMs: 3,
    isGoogleDrive: false,
    resolvedFilename: "video.mp4",
    resolvedFilenameSource: "url",
    responseStatus: 206,
    probeMethod: "HEAD",
  },
  analysis: {
    wasmLoadTimeMs: 1,
    factoryCreateTimeMs: 1,
    formatGenerationTimes: { json: 2 },
    totalAnalysisTimeMs: 4,
    formatErrors: {},
    resolvedFilename: "video.mp4",
    resolvedFilenameSource: "url",
  },
}

describe("analyze contracts", () => {
  it("accepts public success and typed error envelopes", () => {
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(AnalyzeResponseSchema)({
          success: true,
          requestId: "request-1",
          results: { json: "{}" },
        })
      )
    ).toBe(true)
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(AnalyzeResponseSchema)({
          success: false,
          requestId: "request-2",
          error: {
            code: "UPSTREAM_FETCH_FAILED",
            message: "Fetch failed",
            retryable: true,
          },
        })
      )
    ).toBe(true)
  })

  it("accepts the internal success envelope without exposing diagnostics publicly", () => {
    const internal = {
      success: true,
      requestId: "request-1",
      fileSize: 42,
      results: { json: "{}" },
      diagnostics,
    }

    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(AnalyzerRpcResponseSchema)(internal)
      )
    ).toBe(true)

    const publicResult = Schema.decodeUnknownSync(AnalyzeResponseSchema)(
      internal
    )

    expect(publicResult).not.toHaveProperty("diagnostics")
    expect(publicResult).not.toHaveProperty("fileSize")
  })

  it.each([
    { success: true, requestId: "request-1", results: { json: "{}" } },
    {
      success: true,
      requestId: "request-1",
      results: { json: "{}" },
      diagnostics: { ...diagnostics, analysis: { formatErrors: {} } },
    },
    { success: "yes", requestId: "request-1", results: {}, diagnostics },
  ])("rejects malformed internal envelope %#", (value) => {
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(AnalyzerRpcResponseSchema)(value)
      )
    ).toBe(true)
  })
})
