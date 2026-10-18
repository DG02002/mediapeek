import { ANALYZE_PROGRESS_STREAM_CONTENT_TYPE } from "@mediapeek/shared/analyze-progress"
import { DEFAULT_RUNTIME_CONFIG } from "@mediapeek/shared/runtime-config"
import { Effect } from "effect"
import { describe, expect, it, vi } from "vitest"

import {
  AnalysisGateway,
  type AnalysisGatewayRequest,
  type AnalysisGatewayResponse,
} from "./analysis-gateway.server"
import { getAppRuntime } from "./app-runtime.server"
import {
  RequestContext,
  type RequestContextValue,
} from "./request-context.server"
import type { RuntimeEnvironmentValue } from "./runtime-environment.server"

const successPayload = {
  success: true,
  requestId: "analyzer-request-id",
  fileSize: 10,
  results: { json: '{"media":{"track":[]}}' },
  diagnostics: {
    fetch: {
      headRequestDurationMs: 1,
      fetchRequestDurationMs: 1,
      totalDurationMs: 2,
      isGoogleDrive: false,
      resolvedFilename: "video.mp4",
      resolvedFilenameSource: "url",
      responseStatus: 206,
      probeMethod: "HEAD",
    },
    analysis: {
      wasmLoadTimeMs: 1,
      factoryCreateTimeMs: 1,
      formatGenerationTimes: { json: 1 },
      totalAnalysisTimeMs: 3,
      formatErrors: {},
      resolvedFilename: "video.mp4",
      resolvedFilenameSource: "url",
    },
  },
}

const createRequestContext = (): RequestContextValue => ({
  requestId: "request-123",
  method: "POST",
  pathname: "/resource/analyze",
  url: new URL("https://mediapeek.test/resource/analyze"),
  headers: new Headers(),
  signal: new AbortController().signal,
  runtimeConfig: {
    ...DEFAULT_RUNTIME_CONFIG,
    appEnv: "development",
  },
})

const runAnalyze = async (
  fetch: NonNullable<RuntimeEnvironmentValue["analyzer"]>["fetch"],
  input: AnalysisGatewayRequest
): Promise<AnalysisGatewayResponse> => {
  const runtime = getAppRuntime({ analyzer: { fetch } })

  try {
    return await runtime.runPromise(
      Effect.gen(function* () {
        const analysisGateway = yield* AnalysisGateway

        return yield* analysisGateway.analyze(input)
      }).pipe(Effect.provideService(RequestContext, createRequestContext()))
    )
  } finally {
    await runtime.dispose()
  }
}

describe("AnalysisGateway", () => {
  it("passes through streaming responses without consuming the body", async () => {
    const upstreamResponse = new Response("event: progress\ndata: {}\n\n", {
      headers: { "content-type": ANALYZE_PROGRESS_STREAM_CONTENT_TYPE },
    })

    const readBody = vi.spyOn(upstreamResponse, "text")

    const fetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => upstreamResponse
    )

    const response = await runAnalyze(fetch, {
      url: "https://example.com/video.mp4",
      format: ["json"],
      mode: "stream",
      responseHeaders: {
        Warning: '299 - "legacy request"',
        "Set-Cookie": "grant=token; Path=/",
      },
    })

    expect(response.mode).toBe("stream")

    if (response.mode !== "stream") {
      throw new Error("Expected a streaming analyzer response.")
    }

    expect(response.status).toBe(200)
    expect(response.contentType).toBe(ANALYZE_PROGRESS_STREAM_CONTENT_TYPE)
    expect(readBody).not.toHaveBeenCalled()
    expect(response.response.headers.get("warning")).toBe(
      '299 - "legacy request"'
    )
    expect(response.response.headers.get("set-cookie")).toBe(
      "grant=token; Path=/"
    )
    expect(response.response.headers.get("cache-control")).toBe("no-store")
    expect(await response.response.text()).toBe("event: progress\ndata: {}\n\n")
    expect(fetch).toHaveBeenCalledOnce()
    const streamRequestHeaders = new Headers(fetch.mock.calls[0]?.[1]?.headers)
    expect(streamRequestHeaders.get("accept")).toBe(
      ANALYZE_PROGRESS_STREAM_CONTENT_TYPE
    )
    expect(streamRequestHeaders.get("x-mediapeek-request-id")).toBe(
      "request-123"
    )
  })

  it("keeps decoding JSON analyzer responses through the gateway", async () => {
    const fetch = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        Response.json(successPayload)
    )

    const response = await runAnalyze(fetch, {
      url: "https://example.com/video.mp4",
      format: ["json"],
    })

    expect(response.mode).toBe("json")

    if (response.mode !== "json") {
      throw new Error("Expected a JSON analyzer response.")
    }

    expect(response.status).toBe(200)
    expect(response.data).toMatchObject({
      success: true,
      results: { json: '{"media":{"track":[]}}' },
    })
    expect(fetch).toHaveBeenCalledOnce()
    const jsonRequestHeaders = new Headers(fetch.mock.calls[0]?.[1]?.headers)
    expect(jsonRequestHeaders.get("accept")).toBeNull()
  })
})
