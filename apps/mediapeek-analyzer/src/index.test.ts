import { timingSafeEqual as nodeTimingSafeEqual } from "node:crypto"

import { ANALYZE_PROGRESS_STREAM_CONTENT_TYPE } from "@mediapeek/shared/analyze-progress"
import { createEvlogLoggerConfig } from "@mediapeek/shared/evlog"
import { resolveRuntimeConfig } from "@mediapeek/shared/runtime-config"
import type { AnalyzeInput } from "@mediapeek/shared/schemas"
import type { LoggerConfig, WideEvent } from "evlog"
import { initWorkersLogger } from "evlog/workers"
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

import {
  classifyAnalyzerFailure,
  createAnalyzerApp,
  type AnalyzerAnalysisExecutor,
} from "./index"
import {
  CpuBudgetExceededError,
  DiagnosticsError,
  RateLimitedError,
  UpstreamFetchError,
  ValidationFailureError,
} from "./lib/error-utils"

const executeAnalysisMock = vi.fn<AnalyzerAnalysisExecutor>()
const app = createAnalyzerApp({ executeAnalysis: executeAnalysisMock })
const loggedEvents: WideEvent[] = []
let loggedEventPromise: Promise<void> = Promise.resolve()
let resolveLoggedEvent = () => {}

const toBytes = (value: ArrayBuffer | ArrayBufferView) =>
  value instanceof ArrayBuffer
    ? new Uint8Array(value)
    : new Uint8Array(value.buffer, value.byteOffset, value.byteLength)

const stubTimingSafeEqual = () => {
  const subtleCrypto = crypto.subtle

  const original = Object.getOwnPropertyDescriptor(
    subtleCrypto,
    "timingSafeEqual"
  )

  Object.defineProperty(subtleCrypto, "timingSafeEqual", {
    configurable: true,
    value: (
      left: ArrayBuffer | ArrayBufferView,
      right: ArrayBuffer | ArrayBufferView
    ) => nodeTimingSafeEqual(toBytes(left), toBytes(right)),
  })

  return () => {
    if (original) {
      Object.defineProperty(subtleCrypto, "timingSafeEqual", original)
    } else {
      Reflect.deleteProperty(subtleCrypto, "timingSafeEqual")
    }
  }
}

let restoreTimingSafeEqual = () => {}

const initializeTestLogger = (
  sampling: LoggerConfig["sampling"] = {
    rates: { info: 100, warn: 100, error: 100 },
  }
) => {
  loggedEventPromise = new Promise<void>((resolve) => {
    resolveLoggedEvent = resolve
  })

  initWorkersLogger({
    env: { service: "mediapeek-analyzer-test" },
    sampling,
    silent: true,
    redact: false,
    drain: ({ event }) => {
      loggedEvents.push(event)
      resolveLoggedEvent()
    },
  })
}

const input: AnalyzeInput = {
  url: "https://example.com/video.mp4",
  format: ["json"],
}

const request = (
  body: AnalyzeInput = input,
  headers: HeadersInit = {},
  signal?: AbortSignal
) => {
  const requestHeaders = new Headers(headers)
  requestHeaders.set("content-type", "application/json")
  requestHeaders.set("cf-ray", "test-request-id")

  return new Request("https://analyzer.test/analyze", {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify(body),
    signal,
  })
}

function invoke(req: Request, env: Record<string, string> = {}) {
  return app.fetch(req, { APP_ENV: "development", ...env })
}

const addMediaInfoFailure = (failure: "format" | "object") => {
  const defaultImplementation = executeAnalysisMock.getMockImplementation()

  if (!defaultImplementation) {
    throw new Error(
      "The analysis executor mock must have a default implementation."
    )
  }

  executeAnalysisMock.mockImplementationOnce(async (executionInput) => {
    const result = await defaultImplementation(executionInput)

    if (failure === "format") {
      result.results.xml = "Error generating XML view."
      result.diagnostics.analysis.formatErrors = {
        xml: "MediaInfo did not generate the requested output.",
      }
    } else {
      result.results.json = "{}"
      result.diagnostics.analysis.objectProcessError =
        "The MediaInfo object was invalid."
    }

    return result
  })
}

describe("analyzer Worker boundary", () => {
  beforeEach(() => {
    loggedEvents.length = 0
    initializeTestLogger()
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

  afterEach(() => {
    restoreTimingSafeEqual()
    restoreTimingSafeEqual = () => {}
  })

  afterAll(() => {
    initWorkersLogger(
      createEvlogLoggerConfig(
        "mediapeek-analyzer",
        resolveRuntimeConfig(process.env)
      )
    )
  })

  it("rejects invalid input before fetching media", async () => {
    const response = await invoke(request({ url: "invalid", format: ["json"] }))
    expect(response.status).toBe(400)
    expect(response.headers.get("content-type")).toContain("application/json")
    expect(executeAnalysisMock).not.toHaveBeenCalled()
  })

  describe("analyzer authentication", () => {
    it.each([
      [undefined, 401, "AUTH_REQUIRED"],
      ["wrong", 403, "AUTH_INVALID"],
    ])("enforces a configured internal API key", async (key, status, code) => {
      if (key) {
        restoreTimingSafeEqual = stubTimingSafeEqual()
      }

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

    it("fails closed when production has no analyzer API key", async () => {
      const response = await invoke(request(), { APP_ENV: "production" })

      expect(response.status).toBe(503)
      expect(await response.json()).toMatchObject({
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "Analyzer authentication is not configured.",
          retryable: false,
        },
      })
      await loggedEventPromise
      expect(loggedEvents).toHaveLength(1)
      expect(loggedEvents[0]).toMatchObject({
        errorClass: "ANALYZER_AUTH_UNCONFIGURED",
        level: "error",
      })
      expect(executeAnalysisMock).not.toHaveBeenCalled()
    })

    it("allows development analysis without an analyzer API key", async () => {
      const response = await invoke(request(), { APP_ENV: "development" })

      expect(response.status).toBe(200)
      expect(executeAnalysisMock).toHaveBeenCalledOnce()
    })

    it("accepts a valid internal API key and returns the success contract", async () => {
      restoreTimingSafeEqual = stubTimingSafeEqual()

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
  })

  it("includes an unknown source size warning in the success response", async () => {
    executeAnalysisMock.mockImplementationOnce(async () => ({
      fileSize: undefined,
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
          fileSizeUnknown: true,
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
    }))

    const response = await invoke(request())

    expect(await response.json()).toMatchObject({
      success: true,
      warnings: ["source_size_unknown"],
      diagnostics: { fetch: { fileSizeUnknown: true } },
    })
  })

  it("includes a truncated archive entry warning in the success response", async () => {
    const defaultImplementation = executeAnalysisMock.getMockImplementation()

    if (!defaultImplementation) {
      throw new Error(
        "The analysis executor mock must have a default implementation."
      )
    }

    executeAnalysisMock.mockImplementationOnce(async (executionInput) => {
      const result = await defaultImplementation(executionInput)
      result.diagnostics.fetch.archiveEntryTruncated = true

      return result
    })

    const response = await invoke(request())

    expect(await response.json()).toMatchObject({
      success: true,
      warnings: ["archive_entry_truncated"],
      diagnostics: { fetch: { archiveEntryTruncated: true } },
    })
  })

  it("includes a format generation warning beside its output placeholder", async () => {
    addMediaInfoFailure("format")

    const response = await invoke(request({ ...input, format: ["xml"] }))

    expect(await response.json()).toMatchObject({
      success: true,
      warnings: ["format_generation_failed"],
      results: { xml: "Error generating XML view." },
      diagnostics: {
        analysis: {
          formatErrors: {
            xml: "MediaInfo did not generate the requested output.",
          },
        },
      },
    })
  })

  it("includes a format generation warning for object processing failures", async () => {
    addMediaInfoFailure("object")

    const response = await invoke(request())

    expect(await response.json()).toMatchObject({
      success: true,
      warnings: ["format_generation_failed"],
      results: { json: "{}" },
      diagnostics: {
        analysis: { objectProcessError: "The MediaInfo object was invalid." },
      },
    })
  })

  it("includes format generation warnings in streamed successes", async () => {
    addMediaInfoFailure("format")

    const response = await invoke(
      request(
        { ...input, format: ["xml"] },
        { accept: ANALYZE_PROGRESS_STREAM_CONTENT_TYPE }
      )
    )

    const text = await response.text()

    expect(text).toContain('"warnings":["format_generation_failed"]')
    expect(text).toContain('"xml":"Error generating XML view."')
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
      new UpstreamFetchError("Media source request timed out.")
    )
    const response = await invoke(request())
    expect(response.status).toBe(502)
    expect(await response.json()).toEqual({
      success: false,
      requestId: "test-request-id",
      error: {
        code: "UPSTREAM_FETCH_FAILED",
        message: "Media source request timed out.",
        retryable: true,
      },
    })
  })

  it("classifies buffered client aborts as informational cancellations", async () => {
    executeAnalysisMock.mockRejectedValue(
      new DOMException("The client disconnected.", "AbortError")
    )

    const response = await invoke(request())

    expect(response.status).toBe(499)
    expect(await response.json()).toMatchObject({
      success: false,
      error: {
        code: "CLIENT_ABORTED",
        message: "The request was cancelled before analysis finished.",
        retryable: true,
      },
    })
    expect(loggedEvents).toHaveLength(1)
    expect(loggedEvents[0]).toMatchObject({
      errorClass: "ANALYZER_CLIENT_ABORTED",
      level: "info",
    })
  })

  it.each([
    {
      error: new CpuBudgetExceededError(),
      expected: {
        status: 503,
        code: "CPU_BUDGET_EXCEEDED",
        retryable: true,
        severity: "ERROR",
      },
    },
    {
      error: new RateLimitedError("Source is temporarily rate-limited."),
      expected: {
        status: 429,
        code: "RATE_LIMITED",
        retryable: true,
        severity: "WARNING",
      },
    },
    {
      error: new ValidationFailureError("Invalid media URL."),
      expected: {
        status: 400,
        code: "VALIDATION_FAILED",
        retryable: false,
        severity: "WARNING",
      },
    },
    {
      error: new UpstreamFetchError("Unable to fetch source."),
      expected: {
        status: 502,
        code: "UPSTREAM_FETCH_FAILED",
        retryable: true,
        severity: "ERROR",
      },
    },
  ])("classifies tagged analyzer errors", ({ error, expected }) => {
    expect(classifyAnalyzerFailure(error)).toMatchObject(expected)
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

  it("includes an unknown source size warning in the streamed success event", async () => {
    const defaultImplementation = executeAnalysisMock.getMockImplementation()

    if (!defaultImplementation) {
      throw new Error(
        "The analysis executor mock must have a default implementation."
      )
    }

    executeAnalysisMock.mockImplementationOnce(async (executionInput) => {
      const result = await defaultImplementation(executionInput)

      return {
        ...result,
        diagnostics: {
          ...result.diagnostics,
          fetch: { ...result.diagnostics.fetch, fileSizeUnknown: true },
        },
      }
    })

    const response = await invoke(
      request(input, { accept: ANALYZE_PROGRESS_STREAM_CONTENT_TYPE })
    )

    const text = await response.text()

    expect(text).toContain('"warnings":["source_size_unknown"]')
  })

  it("streams a classified terminal error event", async () => {
    initializeTestLogger({ rates: { info: 0 }, keep: [{ status: 400 }] })
    executeAnalysisMock.mockRejectedValue(
      new UpstreamFetchError("Unable to fetch source.")
    )

    const response = await invoke(
      request(input, { accept: ANALYZE_PROGRESS_STREAM_CONTENT_TYPE })
    )

    const text = await response.text()
    expect(response.status).toBe(200)
    expect(text).toContain('"type":"error"')
    expect(text).toContain('"code":"UPSTREAM_FETCH_FAILED"')
    expect(text).toContain('"retryable":true')
    await loggedEventPromise
    expect(loggedEvents).toHaveLength(1)
    expect(loggedEvents[0]).toMatchObject({
      status: 200,
      analysis_status: 502,
      errorClass: "UPSTREAM_FETCH_FAILED",
      level: "error",
    })
  })

  it("classifies and retains a streamed client abort after progress", async () => {
    initializeTestLogger({ rates: { info: 0 }, keep: [{ status: 400 }] })

    const abortController = new AbortController()
    executeAnalysisMock.mockImplementationOnce(
      async ({ signal, reportProgress }) => {
        await reportProgress?.(
          "analysis_started",
          "Running Media Analysis",
          "MediaInfo is parsing the source."
        )

        return new Promise<never>((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          })
        })
      }
    )

    const response = await invoke(
      request(
        input,
        { accept: ANALYZE_PROGRESS_STREAM_CONTENT_TYPE },
        abortController.signal
      )
    )

    const reader = response.body?.getReader()

    if (!reader) {
      throw new Error("The analysis response must have a progress stream.")
    }

    const firstChunk = await reader.read()

    if (!firstChunk.value) {
      throw new Error("The analysis stream must start with a progress event.")
    }

    expect(new TextDecoder().decode(firstChunk.value)).toContain(
      '"type":"progress"'
    )

    abortController.abort(
      new DOMException("The client disconnected.", "AbortError")
    )

    await expect(reader.read()).rejects.toMatchObject({ name: "AbortError" })
    await loggedEventPromise

    expect(loggedEvents).toHaveLength(1)
    expect(loggedEvents[0]).toMatchObject({
      status: 500,
      analysis_status: 499,
      errorClass: "ANALYZER_CLIENT_ABORTED",
      level: "error",
    })
  })
})
