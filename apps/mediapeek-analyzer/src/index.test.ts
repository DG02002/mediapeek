import { ANALYZE_PROGRESS_STREAM_CONTENT_TYPE } from "@mediapeek/shared/analyze-progress"
import { createEvlogLoggerConfig } from "@mediapeek/shared/evlog"
import type { AnalyzeInput } from "@mediapeek/shared/schemas"
import type { WideEvent } from "evlog"
import { initWorkersLogger } from "evlog/workers"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import { createAnalyzerApp, type AnalyzerAnalysisExecutor } from "./index"
import { AnalyzerError, DiagnosticsError } from "./lib/error-utils"
import { CpuBudgetExceededError } from "./services/mediainfo.server"

const executeAnalysisMock = vi.fn<AnalyzerAnalysisExecutor>()
const app = createAnalyzerApp({ executeAnalysis: executeAnalysisMock })
const loggedEvents: WideEvent[] = []

const input: AnalyzeInput = {
  url: "https://example.com/video.mp4",
  format: ["json"],
}

const request = (body: AnalyzeInput = input, headers: HeadersInit = {}) => {
  const requestHeaders = new Headers(headers)
  requestHeaders.set("content-type", "application/json")
  requestHeaders.set("cf-ray", "test-request-id")

  return new Request("https://analyzer.test/analyze", {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify(body),
  })
}

function invoke(req: Request, env: Record<string, string> = {}) {
  return app.fetch(req, { APP_ENV: "test", ...env })
}

describe("analyzer Worker boundary", () => {
  beforeEach(() => {
    loggedEvents.length = 0
    initWorkersLogger({
      env: { service: "mediapeek-analyzer-test" },
      sampling: { rates: { info: 100, warn: 100, error: 100 } },
      silent: true,
      redact: false,
      drain: ({ event }) => {
        loggedEvents.push(event)
      },
    })
    vi.clearAllMocks()
    executeAnalysisMock.mockImplementation(async ({ reportProgress }) => {
      await reportProgress?.(
        "analysis_started",
        "Running Media Analysis",
        "MediaInfo is parsing the source."
      )

      return {
        fileSize: 1,
        results: { json: '{"media":{"track":[]}}' },
        diagnostics: {
          fetch: {
            headRequestDurationMs: 0,
            fetchRequestDurationMs: 1,
            totalDurationMs: 1,
            isGoogleDrive: false,
            resolvedFilename: "video.mp4",
            resolvedFilenameSource: "url",
            responseStatus: 206,
            probeMethod: "range",
          },
          analysis: {
            wasmLoadTimeMs: 0,
            factoryCreateTimeMs: 0,
            formatGenerationTimes: { json: 1 },
            totalAnalysisTimeMs: 1,
            formatErrors: {},
          },
        },
        resolvedFilename: "video.mp4",
        resolvedFilenameSource: "url",
        cpuBudgetRemainingMs: 24_999,
      }
    })
  })

  afterAll(() => {
    initWorkersLogger(createEvlogLoggerConfig("mediapeek-analyzer"))
  })

  it("rejects invalid input before fetching media", async () => {
    const response = await invoke(request({ url: "invalid", format: ["json"] }))
    expect(response.status).toBe(400)
    expect(response.headers.get("content-type")).toContain("application/json")
    expect(executeAnalysisMock).not.toHaveBeenCalled()
  })

  it.each([
    [undefined, 401, "AUTH_REQUIRED"],
    ["wrong", 403, "AUTH_INVALID"],
  ])("enforces a configured internal API key", async (key, status, code) => {
    const response = await invoke(
      request(input, key ? { "x-api-key": key } : {}),
      { ANALYZE_API_KEY: "secret" }
    )

    expect(response.status).toBe(status)
    expect(await response.json()).toMatchObject({
      success: false,
      requestId: "test-request-id",
      error: { code, retryable: false },
    })
  })

  it("accepts a valid internal API key and returns the success contract", async () => {
    const response = await invoke(
      request(input, { authorization: "Bearer secret" }),
      { ANALYZE_API_KEY: "secret" }
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      requestId: "test-request-id",
      fileSize: 1,
      results: { json: '{"media":{"track":[]}}' },
      diagnostics: { fetch: {}, analysis: { resolvedFilename: "video.mp4" } },
    })
    expect(executeAnalysisMock.mock.calls[0]?.[0].signal).toBeInstanceOf(
      AbortSignal
    )
  })

  it("prefers a bounded propagated request ID", async () => {
    const response = await invoke(
      request(input, { "x-mediapeek-request-id": "web-request-123" })
    )

    expect(await response.json()).toMatchObject({
      success: true,
      requestId: "web-request-123",
    })
  })

  it("classifies media fetch failures", async () => {
    executeAnalysisMock.mockRejectedValue(
      new AnalyzerError("upstream-fetch", "Unable to access file stream")
    )
    const response = await invoke(request())
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      success: false,
      requestId: "test-request-id",
      error: {
        code: "UPSTREAM_FETCH_FAILED",
        message: "Unable to retrieve the media source.",
        retryable: true,
      },
    })
  })

  it("does not expose unknown internal error details", async () => {
    executeAnalysisMock.mockRejectedValue(
      new Error("distinctive internal library detail")
    )
    const response = await invoke(request())
    expect(response.status).toBe(500)
    const body = JSON.stringify(await response.json())
    expect(body).toContain("Internal Server Error")
    expect(body).not.toContain("distinctive internal library detail")
  })

  it("classifies a CPU budget error preserved inside analysis diagnostics", async () => {
    executeAnalysisMock.mockRejectedValue(
      new DiagnosticsError(
        "CPU budget exceeded",
        { wasmLoadTimeMs: 1 },
        new CpuBudgetExceededError()
      )
    )

    const response = await invoke(request())

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      success: false,
      error: { code: "CPU_BUDGET_EXCEEDED", retryable: true },
    })
    expect(loggedEvents).toHaveLength(1)
    expect(loggedEvents[0]).toMatchObject({
      diagnostics: { wasmLoadTimeMs: 1 },
    })
  })

  it("streams progress and a terminal success event", async () => {
    const response = await invoke(
      request(input, { accept: ANALYZE_PROGRESS_STREAM_CONTENT_TYPE })
    )

    const text = await response.text()
    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe(
      ANALYZE_PROGRESS_STREAM_CONTENT_TYPE
    )
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(text).toContain('"type":"progress"')
    expect(text).toContain('"type":"success"')
    expect(text).toContain('"requestId":"test-request-id"')
  })

  it("streams a classified terminal error event", async () => {
    executeAnalysisMock.mockRejectedValue(
      new AnalyzerError("validation", "media file not found")
    )

    const response = await invoke(
      request(input, { accept: ANALYZE_PROGRESS_STREAM_CONTENT_TYPE })
    )

    const text = await response.text()
    expect(response.status).toBe(200)
    expect(text).toContain('"type":"error"')
    expect(text).toContain('"code":"VALIDATION_FAILED"')
    expect(text).toContain('"retryable":false')
  })
})
