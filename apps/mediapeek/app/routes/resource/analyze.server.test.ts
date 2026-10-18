import { ANALYZE_PROGRESS_STREAM_CONTENT_TYPE } from "@mediapeek/shared/analyze-progress"
import { resolveRuntimeConfig } from "@mediapeek/shared/runtime-config"
import { env } from "cloudflare:workers"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  MAX_TURNSTILE_RESPONSE_BYTES,
  TURNSTILE_VERIFY_TIMEOUT_MS,
} from "~/constants"
import {
  createTurnstileGrantToken,
  serializeTurnstileGrantCookie,
} from "~/lib/turnstile-grant.server"

import { handleGet, handlePost, type AnalyzeRouteArgs } from "./analyze"

const analyzeUrl = "https://example.com/video.mp4"
const grantSecret = "test-grant-secret"

const createContext = (overrides: Partial<Env> = {}) => {
  const workerEnv = { ...env, ...overrides } satisfies Env

  return {
    env: workerEnv,
    runtimeConfig: resolveRuntimeConfig({
      APP_ENV: "development",
      TURNSTILE_ENABLED: workerEnv.TURNSTILE_ENABLED,
    }),
  } satisfies AnalyzeRouteArgs["context"]
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

const get = () =>
  new Request(
    `https://mediapeek.test/resource/analyze?url=${encodeURIComponent(analyzeUrl)}&format=json`,
    {
      method: "GET",
      headers: { "cf-ray": crypto.randomUUID() },
    }
  )

const invokePost = (request: Request, context: AnalyzeRouteArgs["context"]) =>
  handlePost({ request, context })

describe("analyze route Turnstile flag", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("analyzes without a grant or token when Turnstile is disabled", async () => {
    const siteverifyFetch = vi.spyOn(globalThis, "fetch")
    const context = createContext({ TURNSTILE_ENABLED: "false" })

    const response = await invokePost(post(), context)

    expect(response.status).toBe(200)
    expect(siteverifyFetch).not.toHaveBeenCalled()
    expect(response.headers.get("set-cookie")).toBeNull()
  })

  it("keeps the deprecated GET response contract", async () => {
    const response = await handleGet({
      request: get(),
      context: createContext(),
    })

    expect(response.status).toBe(200)
    expect(response.headers.get("warning")).toContain(
      "GET /resource/analyze is deprecated"
    )
    expect(response.headers.get("deprecation")).toBe("true")
    expect(await response.json()).toMatchObject({
      success: true,
      results: { json: '{"media":{"track":[]}}' },
    })
  })

  it("streams analyzer progress through the analysis gateway", async () => {
    const context = createContext()

    const response = await invokePost(
      post({ accept: ANALYZE_PROGRESS_STREAM_CONTENT_TYPE }),
      context
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("content-type")).toBe(
      ANALYZE_PROGRESS_STREAM_CONTENT_TYPE
    )
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.text()).toBe('{"type":"started"}\n')
  })

  it("requires a token or valid grant when Turnstile is enabled", async () => {
    const siteverifyFetch = vi.spyOn(globalThis, "fetch")

    const context = createContext({
      TURNSTILE_ENABLED: "true",
      TURNSTILE_SECRET_KEY: "test-turnstile-secret",
      TURNSTILE_GRANT_SECRET: grantSecret,
    })

    const response = await invokePost(post(), context)
    const payload: unknown = await response.json()

    expect(response.status).toBe(403)
    expect(payload).toMatchObject({
      success: false,
      error: { code: "AUTH_REQUIRED" },
    })
    expect(siteverifyFetch).not.toHaveBeenCalled()
  })

  it("verifies a token and reuses its grant when Turnstile is enabled", async () => {
    const siteverifyFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ success: true }))

    const context = createContext({
      TURNSTILE_ENABLED: "true",
      TURNSTILE_SECRET_KEY: "test-turnstile-secret",
      TURNSTILE_GRANT_SECRET: grantSecret,
    })

    const firstResponse = await invokePost(
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

    const secondResponse = await invokePost(post({ cookie }), context)

    expect(secondResponse.status).toBe(200)
    expect(siteverifyFetch).toHaveBeenCalledOnce()
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

    const context = createContext({
      TURNSTILE_ENABLED: "true",
      TURNSTILE_SECRET_KEY: "test-turnstile-secret",
      TURNSTILE_GRANT_SECRET: grantSecret,
    })

    const response = await invokePost(
      post({ "CF-Turnstile-Response": "test-response-token" }),
      context
    )

    expect(timeout).toHaveBeenCalledWith(TURNSTILE_VERIFY_TIMEOUT_MS)
    expect(siteverifyFetch).toHaveBeenCalledOnce()
    expect(response.status).toBe(503)
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

    const context = createContext({
      TURNSTILE_ENABLED: "true",
      TURNSTILE_SECRET_KEY: "test-turnstile-secret",
      TURNSTILE_GRANT_SECRET: grantSecret,
    })

    const response = await invokePost(
      post({ "CF-Turnstile-Response": "test-response-token" }),
      context
    )

    expect(siteverifyFetch).toHaveBeenCalledOnce()
    expect(cancel).toHaveBeenCalledOnce()
    expect(response.status).toBe(503)
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

    const context = createContext({
      TURNSTILE_ENABLED: "true",
      TURNSTILE_SECRET_KEY: "test-turnstile-secret",
      TURNSTILE_GRANT_SECRET: grantSecret,
    })

    const response = await invokePost(post({ cookie }), context)

    expect(response.status).toBe(200)
    expect(siteverifyFetch).not.toHaveBeenCalled()
  })
})
