import {
  DEFAULT_RUNTIME_CONFIG,
  type RuntimeConfig,
} from "@mediapeek/shared/runtime-config"
import { Effect } from "effect"
import { describe, expect, it } from "vitest"

import {
  AnalysisPolicy,
  type AnalysisPolicyInput,
} from "./analysis-policy.server"
import { getAppRuntime } from "./app-runtime.server"
import {
  RequestContext,
  type RequestContextValue,
} from "./request-context.server"
import type { RuntimeEnvironmentValue } from "./runtime-environment.server"

const createRequestContext = (
  runtimeConfig: RuntimeConfig = {
    ...DEFAULT_RUNTIME_CONFIG,
    appEnv: "development",
  }
): RequestContextValue => ({
  requestId: "request-123",
  method: "POST",
  pathname: "/resource/analyze",
  url: new URL("https://mediapeek.test/resource/analyze"),
  headers: new Headers({ "CF-Connecting-IP": "192.0.2.1" }),
  signal: new AbortController().signal,
  clientIp: "192.0.2.1",
  runtimeConfig,
})

const createInput = (
  input: AnalysisPolicyInput["input"] = {
    url: "https://example.com/video.mp4",
  }
) => ({ input })

const runAuthorize = async (
  environment: RuntimeEnvironmentValue,
  requestContext: RequestContextValue,
  input: AnalysisPolicyInput
) => {
  const runtime = getAppRuntime(environment)

  try {
    return await runtime.runPromise(
      Effect.gen(function* () {
        const analysisPolicy = yield* AnalysisPolicy

        return yield* analysisPolicy.authorize(input)
      }).pipe(Effect.provideService(RequestContext, requestContext))
    )
  } finally {
    await runtime.dispose()
  }
}

describe("AnalysisPolicy", () => {
  it("validates input and canonicalizes the requested formats", async () => {
    const decision = await runAuthorize(
      {},
      createRequestContext(),
      createInput({
        url: "https://example.com/video.mp4",
        format: ["object", "Text"],
      })
    )

    expect(decision.input).toEqual({
      url: "https://example.com/video.mp4",
      format: ["json", "text"],
    })
  })

  it("fails closed in production when the rate limiter is missing", async () => {
    await expect(
      runAuthorize(
        {},
        createRequestContext({
          ...DEFAULT_RUNTIME_CONFIG,
          appEnv: "production",
        }),
        createInput()
      )
    ).rejects.toMatchObject({
      reason: "rate-limit-missing",
      status: 503,
    })
  })

  it("fails closed in production when the rate limiter throws", async () => {
    const rateLimiter = {
      limit: async () => {
        throw new Error("binding unavailable")
      },
    }

    await expect(
      runAuthorize(
        { rateLimiter },
        createRequestContext({
          ...DEFAULT_RUNTIME_CONFIG,
          appEnv: "production",
        }),
        createInput()
      )
    ).rejects.toMatchObject({
      reason: "rate-limit-unavailable",
      status: 503,
      rateLimitBindingError: "binding unavailable",
    })
  })

  it("uses the in-memory limiter in development when the binding throws", async () => {
    const rateLimiter = {
      limit: async () => {
        throw new Error("binding unavailable")
      },
    }

    const runtimeConfig: RuntimeConfig = {
      ...DEFAULT_RUNTIME_CONFIG,
      appEnv: "development",
    }

    const runtime = getAppRuntime({ rateLimiter, rateLimitPerMinute: 1 })

    try {
      const authorize = (input: AnalysisPolicyInput) =>
        runtime.runPromise(
          Effect.gen(function* () {
            const analysisPolicy = yield* AnalysisPolicy

            return yield* analysisPolicy.authorize(input)
          }).pipe(
            Effect.provideService(
              RequestContext,
              createRequestContext(runtimeConfig)
            )
          )
        )

      await expect(authorize(createInput())).resolves.toMatchObject({
        rateLimitBindingError: "binding unavailable",
      })
      await expect(authorize(createInput())).rejects.toMatchObject({
        reason: "rate-limited",
        status: 429,
        rateLimitSource: "development_in_memory",
      })
    } finally {
      await runtime.dispose()
    }
  })

  it("uses the in-memory limiter in development when the binding is missing", async () => {
    const decision = await runAuthorize(
      {},
      createRequestContext({
        ...DEFAULT_RUNTIME_CONFIG,
        appEnv: "development",
      }),
      createInput()
    )

    expect(decision.input.url).toBe("https://example.com/video.mp4")
  })

  it("rejects invalid request data after rate limiting", async () => {
    await expect(
      runAuthorize(
        {},
        createRequestContext(),
        createInput({ url: "file:///video.mp4" })
      )
    ).rejects.toMatchObject({
      reason: "validation-failed",
      status: 422,
    })
  })
})
