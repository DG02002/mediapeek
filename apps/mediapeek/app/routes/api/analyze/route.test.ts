import { resolveRuntimeConfig } from "@mediapeek/shared/runtime-config"
import { RouterContextProvider } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  MAX_TURNSTILE_RESPONSE_BYTES,
  TURNSTILE_VERIFY_TIMEOUT_MS,
} from "~/constants"
import { cloudflareContext } from "~/lib/cloudflare-context.server"
import {
  createTurnstileGrantToken,
  serializeTurnstileGrantCookie,
} from "~/lib/turnstile-grant.server"

import type { Route } from "./+types/route"
import { action } from "./route"

const analyzeUrl = "https://example.com/video.mp4"
const grantSecret = "test-grant-secret"

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

const createTestFetcher = (
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
): Fetcher => ({
  fetch,
  connect: () => {
    throw new Error("Test fetcher connect is not implemented.")
  },
})

const executionContext: Pick<
  ExecutionContext,
  "waitUntil" | "passThroughOnException"
> = {
  waitUntil: () => undefined,
  passThroughOnException: () => undefined,
}

function createContext(env: Partial<Env> = {}) {
  const analyzerFetch = vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >(async () => Response.json(successPayload))

  const workerEnv = {
    ASSETS: createTestFetcher(analyzerFetch),
    ANALYZER: createTestFetcher(analyzerFetch),
    TURNSTILE_SITE_KEY: "test-site-key",
    ...env,
  } satisfies Env

  const context = new RouterContextProvider()

  context.set(cloudflareContext, {
    env: workerEnv,
    ctx: executionContext,
    runtimeConfig: resolveRuntimeConfig({
      APP_ENV: "development",
      TURNSTILE_ENABLED: workerEnv.TURNSTILE_ENABLED,
    }),
  })

  return { context, analyzerFetch }
}

const post = (headers: HeadersInit = {}) => {
  const requestHeaders = new Headers(headers)
  requestHeaders.set("content-type", "application/json")
  requestHeaders.set("cf-ray", crypto.randomUUID())

  return new Request("https://mediapeek.test/resource/analyze", {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify({ url: analyzeUrl, format: ["json"] }),
  })
}

const invokeAction = (request: Request, context: Route.ActionArgs["context"]) =>
  action({
    request,
    context,
    params: {},
    url: new URL(request.url),
    pattern: "/resource/analyze",
  })

describe("analyze route Turnstile flag", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("analyzes without a grant or token when Turnstile is disabled", async () => {
    const siteverifyFetch = vi.spyOn(globalThis, "fetch")

    const { context, analyzerFetch } = createContext({
      TURNSTILE_ENABLED: "false",
    })

    const response = await invokeAction(post(), context)

    expect(response.status).toBe(200)
    expect(analyzerFetch).toHaveBeenCalledOnce()
    expect(siteverifyFetch).not.toHaveBeenCalled()
    expect(response.headers.get("set-cookie")).toBeNull()
  })

  it("requires a token or valid grant when Turnstile is enabled", async () => {
    const siteverifyFetch = vi.spyOn(globalThis, "fetch")

    const { context, analyzerFetch } = createContext({
      TURNSTILE_ENABLED: "true",
      TURNSTILE_SECRET_KEY: "test-turnstile-secret",
      TURNSTILE_GRANT_SECRET: grantSecret,
    })

    const response = await invokeAction(post(), context)
    const payload: unknown = await response.json()

    expect(response.status).toBe(403)
    expect(payload).toMatchObject({
      success: false,
      error: { code: "AUTH_REQUIRED" },
    })
    expect(analyzerFetch).not.toHaveBeenCalled()
    expect(siteverifyFetch).not.toHaveBeenCalled()
  })

  it("verifies a token and reuses its grant when Turnstile is enabled", async () => {
    const siteverifyFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ success: true }))

    const { context, analyzerFetch } = createContext({
      TURNSTILE_ENABLED: "true",
      TURNSTILE_SECRET_KEY: "test-turnstile-secret",
      TURNSTILE_GRANT_SECRET: grantSecret,
    })

    const firstResponse = await invokeAction(
      post({ "CF-Turnstile-Response": "test-response-token" }),
      context
    )

    const setCookie = firstResponse.headers.get("set-cookie")

    expect(firstResponse.status).toBe(200)
    expect(setCookie).toContain("mp_turnstile_grant=")
    expect(siteverifyFetch).toHaveBeenCalledOnce()

    const [cookie] = setCookie?.split(";", 1) ?? []

    if (!cookie) {
      throw new Error("The verified request did not issue a grant cookie.")
    }

    const secondResponse = await invokeAction(post({ cookie }), context)

    expect(secondResponse.status).toBe(200)
    expect(siteverifyFetch).toHaveBeenCalledOnce()
    expect(analyzerFetch).toHaveBeenCalledTimes(2)
  })

  it("times out the siteverify request and reports it as unavailable", async () => {
    const timeoutSignal = AbortSignal.abort(
      new DOMException("The request timed out.", "TimeoutError")
    )

    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(timeoutSignal)

    const siteverifyFetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(async (_input, init) => {
        if (!init?.signal?.aborted) {
          throw new Error("The siteverify request did not receive a timeout.")
        }

        throw init.signal.reason
      })

    const { context, analyzerFetch } = createContext({
      TURNSTILE_ENABLED: "true",
      TURNSTILE_SECRET_KEY: "test-turnstile-secret",
      TURNSTILE_GRANT_SECRET: grantSecret,
    })

    const response = await invokeAction(
      post({ "CF-Turnstile-Response": "test-response-token" }),
      context
    )

    expect(timeout).toHaveBeenCalledWith(TURNSTILE_VERIFY_TIMEOUT_MS)
    expect(siteverifyFetch).toHaveBeenCalledOnce()
    expect(response.status).toBe(503)
    expect(analyzerFetch).not.toHaveBeenCalled()
  })

  it("cancels oversized siteverify responses", async () => {
    const cancel = vi.fn()

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_TURNSTILE_RESPONSE_BYTES + 1))
      },
      cancel,
    })

    const siteverifyFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(body, { status: 200 }))

    const { context, analyzerFetch } = createContext({
      TURNSTILE_ENABLED: "true",
      TURNSTILE_SECRET_KEY: "test-turnstile-secret",
      TURNSTILE_GRANT_SECRET: grantSecret,
    })

    const response = await invokeAction(
      post({ "CF-Turnstile-Response": "test-response-token" }),
      context
    )

    expect(siteverifyFetch).toHaveBeenCalledOnce()
    expect(cancel).toHaveBeenCalledOnce()
    expect(response.status).toBe(503)
    expect(analyzerFetch).not.toHaveBeenCalled()
  })

  it("accepts an existing valid grant without requiring a new token", async () => {
    const { token } = await createTurnstileGrantToken({
      secret: grantSecret,
      url: analyzeUrl,
    })

    const [cookie] = serializeTurnstileGrantCookie({
      token,
      appEnv: "development",
    }).split(";", 1)

    if (!cookie) {
      throw new Error("The test grant did not produce a cookie.")
    }

    const siteverifyFetch = vi.spyOn(globalThis, "fetch")

    const { context, analyzerFetch } = createContext({
      TURNSTILE_ENABLED: "true",
      TURNSTILE_SECRET_KEY: "test-turnstile-secret",
      TURNSTILE_GRANT_SECRET: grantSecret,
    })

    const response = await invokeAction(post({ cookie }), context)

    expect(response.status).toBe(200)
    expect(analyzerFetch).toHaveBeenCalledOnce()
    expect(siteverifyFetch).not.toHaveBeenCalled()
  })
})
