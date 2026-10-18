import { DEFAULT_RUNTIME_CONFIG } from "@mediapeek/shared/runtime-config"
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  MAX_TURNSTILE_RESPONSE_BYTES,
  TURNSTILE_VERIFY_TIMEOUT_MS,
} from "~/constants"

import {
  authorizeTurnstile,
  type TurnstileAuthorizationFailure,
  type TurnstileAuthorizationInput,
} from "./turnstile-authorization.server"

const analyzeUrl = "https://example.com/video.mp4"
const grantSecret = "test-grant-secret"

const createInput = (
  headers: HeadersInit = {}
): TurnstileAuthorizationInput => ({
  request: new Request("https://mediapeek.test/resource/analyze", {
    method: "POST",
    headers,
  }),
  requestId: "request-123",
  url: analyzeUrl,
  env: {
    TURNSTILE_SECRET_KEY: "test-turnstile-secret",
    TURNSTILE_GRANT_SECRET: grantSecret,
  },
  runtimeConfig: {
    ...DEFAULT_RUNTIME_CONFIG,
    appEnv: "development",
    turnstileEnabled: true,
  },
  createFailureResponse: (failure: TurnstileAuthorizationFailure) =>
    Response.json(
      {
        success: false,
        error: {
          code: failure.code,
          message: failure.message,
          retryable: failure.retryable,
        },
      },
      { status: failure.status }
    ),
})

describe("authorizeTurnstile", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("returns an authorization result without fetching when disabled", async () => {
    const siteverifyFetch = vi.spyOn(globalThis, "fetch")
    const input = createInput()

    const result = await authorizeTurnstile({
      ...input,
      runtimeConfig: { ...input.runtimeConfig, turnstileEnabled: false },
    })

    expect(result).toEqual({ authorized: true })
    expect(siteverifyFetch).not.toHaveBeenCalled()
  })

  it("returns a terminal response when the visitor has no token or grant", async () => {
    const siteverifyFetch = vi.spyOn(globalThis, "fetch")
    const result = await authorizeTurnstile(createInput())

    expect(result.authorized).toBe(false)

    if (result.authorized) {
      throw new Error("Expected Turnstile authorization to be denied.")
    }

    expect(result.response.status).toBe(403)
    expect(await result.response.json()).toMatchObject({
      error: { code: "AUTH_REQUIRED" },
    })
    expect(result.grantOutcome).toBe("GRANT_MISSING")
    expect(result.verification).toMatchObject({
      tokenPresent: false,
      result: "REJECTED",
    })
    expect(siteverifyFetch).not.toHaveBeenCalled()
  })

  it("verifies a token and issues a URL-bound grant cookie", async () => {
    const siteverifyFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json({ success: true }))

    const result = await authorizeTurnstile(
      createInput({ "CF-Turnstile-Response": "test-response-token" })
    )

    expect(result.authorized).toBe(true)

    if (!result.authorized) {
      throw new Error("Expected Turnstile authorization to succeed.")
    }

    expect(result.grantCookieHeader).toContain("mp_turnstile_grant=")
    expect(result.grantOutcome).toBe("TOKEN_VERIFIED")
    expect(result.verification).toMatchObject({
      success: true,
      tokenPresent: true,
      result: "TOKEN_VERIFIED",
    })
    expect(siteverifyFetch).toHaveBeenCalledOnce()

    const requestBody = siteverifyFetch.mock.calls[0]?.[1]?.body

    expect(requestBody).toBeInstanceOf(FormData)

    if (!(requestBody instanceof FormData)) {
      throw new Error("Expected siteverify to receive form data.")
    }

    expect(requestBody.get("idempotency_key")).toBe("request-123")
  })

  it("times out and returns an unavailable response", async () => {
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

    const result = await authorizeTurnstile(
      createInput({ "CF-Turnstile-Response": "test-response-token" })
    )

    expect(timeout).toHaveBeenCalledWith(TURNSTILE_VERIFY_TIMEOUT_MS)
    expect(siteverifyFetch).toHaveBeenCalledOnce()
    expect(result.authorized).toBe(false)

    if (result.authorized) {
      throw new Error("Expected timed out verification to be denied.")
    }

    expect(result.response.status).toBe(503)
    expect(result.failure.errorClass).toBe("TURNSTILE_VERIFY_UNAVAILABLE")
    expect(result.requestError).toBeInstanceOf(Error)
  })

  it("cancels oversized verification responses", async () => {
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

    const result = await authorizeTurnstile(
      createInput({ "CF-Turnstile-Response": "test-response-token" })
    )

    expect(siteverifyFetch).toHaveBeenCalledOnce()
    expect(cancel).toHaveBeenCalledOnce()
    expect(result.authorized).toBe(false)

    if (result.authorized) {
      throw new Error("Expected oversized verification to be denied.")
    }

    expect(result.response.status).toBe(503)
  })
})
