import {
  AnalyzeInputSchema,
  type AnalyzeInput,
} from "@mediapeek/shared/schemas"
import {
  Context,
  DateTime,
  Effect,
  Layer,
  Predicate,
  Result,
  Schema,
} from "effect"

import {
  ANALYSIS_RATE_LIMIT_WINDOW_MS,
  DEFAULT_ANALYSIS_RATE_LIMIT_PER_MINUTE,
  DEFAULT_ANALYSIS_RATE_LIMIT_RETRY_AFTER_SECONDS,
  MAX_IN_MEMORY_ANALYSIS_RATE_LIMIT_ENTRIES,
} from "~/constants"

import {
  RequestContext,
  type RequestContextValue,
} from "./request-context.server"
import {
  RuntimeEnvironment,
  type RuntimeRateLimiter,
} from "./runtime-environment.server"

const RATE_LIMIT_UNAVAILABLE_MESSAGE =
  "Analysis service is temporarily unavailable. Try again shortly."

const RateLimitSourceSchema = Schema.Literals([
  "cloudflare_binding",
  "development_in_memory",
])

export interface AnalysisPolicyInput {
  readonly input: typeof Schema.JsonObject.Type
  readonly parseError?: string
}

export interface AnalysisPolicyDecision {
  readonly input: AnalyzeInput
  readonly rateLimitBindingError?: string
}

export const AnalysisPolicyErrorReasonSchema = Schema.Literals([
  "invalid-json",
  "validation-failed",
  "rate-limited",
  "rate-limit-unavailable",
  "rate-limit-missing",
])

export type AnalysisPolicyErrorReason =
  typeof AnalysisPolicyErrorReasonSchema.Type

export class AnalysisPolicyError extends Schema.TaggedError<AnalysisPolicyError>()(
  "AnalysisPolicyError",
  {
    reason: AnalysisPolicyErrorReasonSchema,
    status: Schema.Number,
    code: Schema.Literals([
      "RATE_LIMITED",
      "VALIDATION_FAILED",
      "INTERNAL_ERROR",
    ]),
    message: Schema.String,
    retryable: Schema.Boolean,
    cause: Schema.Defect(),
    retryAfterSeconds: Schema.optionalKey(Schema.Number),
    rateLimitSource: Schema.optionalKey(RateLimitSourceSchema),
    rateLimitBindingError: Schema.optionalKey(Schema.String),
  }
) {}

interface InMemoryRateLimitEntry {
  count: number
  resetAt: number
}

interface InMemoryRateLimitResult {
  readonly allowed: boolean
  readonly retryAfterMs: number
}

const getCauseMessage = (cause: unknown) =>
  Predicate.isError(cause) ? cause.message : "Rate limit binding failed."

const getRateLimitPerMinute = (configured: number | undefined) => {
  if (configured === undefined || Number.isNaN(configured) || configured <= 0) {
    return DEFAULT_ANALYSIS_RATE_LIMIT_PER_MINUTE
  }

  return configured
}

const getRateLimitKey = (requestContext: RequestContextValue) =>
  requestContext.runtimeConfig.appEnv === "production"
    ? `analysis:${requestContext.headers.get("CF-Connecting-IP") ?? "unknown"}`
    : `analysis:${requestContext.clientIp ?? "anonymous"}`

const applyInMemoryRateLimit = (input: {
  readonly state: Map<string, InMemoryRateLimitEntry>
  readonly key: string
  readonly nowMs: number
  readonly maxPerMinute: number
}): InMemoryRateLimitResult => {
  const { state, key, nowMs, maxPerMinute } = input
  const current = state.get(key)

  if (!current || current.resetAt <= nowMs) {
    state.set(key, {
      count: 1,
      resetAt: nowMs + ANALYSIS_RATE_LIMIT_WINDOW_MS,
    })

    return { allowed: true, retryAfterMs: 0 }
  }

  if (current.count >= maxPerMinute) {
    return { allowed: false, retryAfterMs: current.resetAt - nowMs }
  }

  current.count += 1
  state.set(key, current)

  if (state.size > MAX_IN_MEMORY_ANALYSIS_RATE_LIMIT_ENTRIES) {
    for (const [entryKey, entry] of state.entries()) {
      if (entry.resetAt <= nowMs) {
        state.delete(entryKey)
      }
    }
  }

  return { allowed: true, retryAfterMs: 0 }
}

interface RateLimitBindingResult {
  readonly useInMemoryRateLimit: boolean
  readonly rateLimitBindingError?: string
}

const checkRateLimiterBinding = (input: {
  readonly rateLimiter: RuntimeRateLimiter | undefined
  readonly rateLimitKey: string
  readonly isProduction: boolean
}): Effect.Effect<RateLimitBindingResult, AnalysisPolicyError> =>
  Effect.gen(function* () {
    const { rateLimiter, rateLimitKey, isProduction } = input

    if (!rateLimiter) {
      if (isProduction) {
        return yield* new AnalysisPolicyError({
          reason: "rate-limit-missing",
          status: 503,
          code: "INTERNAL_ERROR",
          message: RATE_LIMIT_UNAVAILABLE_MESSAGE,
          retryable: true,
          cause: "ANALYZE_RATE_LIMITER",
        })
      }

      return { useInMemoryRateLimit: true }
    }

    const result = yield* Effect.result(
      Effect.tryPromise({
        try: () => rateLimiter.limit({ key: rateLimitKey }),
        catch: (cause) => cause,
      })
    )

    if (Result.isFailure(result)) {
      const rateLimitBindingError = getCauseMessage(result.failure)

      if (isProduction) {
        return yield* new AnalysisPolicyError({
          reason: "rate-limit-unavailable",
          status: 503,
          code: "INTERNAL_ERROR",
          message: RATE_LIMIT_UNAVAILABLE_MESSAGE,
          retryable: true,
          cause: result.failure,
          rateLimitSource: "cloudflare_binding",
          rateLimitBindingError,
        })
      }

      return { useInMemoryRateLimit: true, rateLimitBindingError }
    }

    if (!result.success.success) {
      return yield* new AnalysisPolicyError({
        reason: "rate-limited",
        status: 429,
        code: "RATE_LIMITED",
        message: "Too many analysis requests. Try again in a moment.",
        retryable: true,
        cause: "RATE_LIMITED",
        retryAfterSeconds: DEFAULT_ANALYSIS_RATE_LIMIT_RETRY_AFTER_SECONDS,
        rateLimitSource: "cloudflare_binding",
      })
    }

    return { useInMemoryRateLimit: false }
  })

const applyDevelopmentRateLimit = (input: {
  readonly state: Map<string, InMemoryRateLimitEntry>
  readonly rateLimitKey: string
  readonly maxPerMinute: number
  readonly isProduction: boolean
}): Effect.Effect<void, AnalysisPolicyError> =>
  Effect.gen(function* () {
    if (input.isProduction) {
      return yield* new AnalysisPolicyError({
        reason: "rate-limit-missing",
        status: 503,
        code: "INTERNAL_ERROR",
        message: RATE_LIMIT_UNAVAILABLE_MESSAGE,
        retryable: true,
        cause: "ANALYZE_RATE_LIMITER",
      })
    }

    const now = yield* DateTime.now

    const result = applyInMemoryRateLimit({
      state: input.state,
      key: input.rateLimitKey,
      nowMs: now.epochMilliseconds,
      maxPerMinute: input.maxPerMinute,
    })

    if (!result.allowed) {
      return yield* new AnalysisPolicyError({
        reason: "rate-limited",
        status: 429,
        code: "RATE_LIMITED",
        message: "Too many analysis requests. Try again in a moment.",
        retryable: true,
        cause: "RATE_LIMITED",
        retryAfterSeconds: result.retryAfterMs / 1_000,
        rateLimitSource: "development_in_memory",
      })
    }

    return undefined
  })

export class AnalysisPolicy extends Context.Service<
  AnalysisPolicy,
  {
    authorize(
      input: AnalysisPolicyInput
    ): Effect.Effect<
      AnalysisPolicyDecision,
      AnalysisPolicyError,
      RequestContext
    >
  }
>()("mediapeek/AnalysisPolicy") {
  static readonly layer: Layer.Layer<
    AnalysisPolicy,
    never,
    RuntimeEnvironment
  > = Layer.effect(
    AnalysisPolicy,
    Effect.gen(function* () {
      const runtimeEnvironment = yield* RuntimeEnvironment
      const inMemoryRateLimitState = new Map<string, InMemoryRateLimitEntry>()

      const authorize = Effect.fn("AnalysisPolicy.authorize")((input) =>
        Effect.gen(function* () {
          const requestContext = yield* RequestContext

          const isProduction =
            requestContext.runtimeConfig.appEnv === "production"

          const rateLimitKey = getRateLimitKey(requestContext)
          const { rateLimiter } = runtimeEnvironment

          const rateLimitResult = yield* checkRateLimiterBinding({
            rateLimiter,
            rateLimitKey,
            isProduction,
          })

          if (rateLimitResult.useInMemoryRateLimit) {
            yield* applyDevelopmentRateLimit({
              state: inMemoryRateLimitState,
              rateLimitKey,
              maxPerMinute: getRateLimitPerMinute(
                runtimeEnvironment.rateLimitPerMinute
              ),
              isProduction,
            })
          }

          if (input.parseError) {
            return yield* new AnalysisPolicyError({
              reason: "invalid-json",
              status: 422,
              code: "VALIDATION_FAILED",
              message: input.parseError,
              retryable: false,
              cause: input.parseError,
            })
          }

          const decodedInput = Schema.decodeUnknownResult(AnalyzeInputSchema)(
            input.input
          )

          if (Result.isFailure(decodedInput)) {
            return yield* new AnalysisPolicyError({
              reason: "validation-failed",
              status: 422,
              code: "VALIDATION_FAILED",
              message: decodedInput.failure.message,
              retryable: false,
              cause: decodedInput.failure,
            })
          }

          return {
            input: decodedInput.success,
            rateLimitBindingError: rateLimitResult.rateLimitBindingError,
          }
        })
      )

      return AnalysisPolicy.of({ authorize })
    })
  )
}
