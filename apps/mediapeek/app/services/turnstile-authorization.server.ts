import type { AnalyzeErrorCode } from "@mediapeek/shared/analyze-contract"
import { readStreamBytesWithinLimit } from "@mediapeek/shared/bounded-stream-read"
import { summarizeSensitiveToken } from "@mediapeek/shared/log-redaction"
import type { RuntimeConfig } from "@mediapeek/shared/runtime-config"
import type { TurnstileResponse } from "@mediapeek/shared/schemas"
import { Context, Effect, Layer, Schema } from "effect"

import {
  MAX_TURNSTILE_RESPONSE_BYTES,
  TURNSTILE_VERIFY_TIMEOUT_MS,
} from "~/constants"
import { TurnstileResponseSchema } from "~/lib/schemas/turnstile"
import {
  createTurnstileGrantToken,
  readTurnstileGrantCookie,
  serializeTurnstileGrantCookie,
  verifyTurnstileGrantToken,
} from "~/lib/turnstile-grant.server"

interface TurnstileEnvironment {
  readonly TURNSTILE_SECRET_KEY?: string
  readonly TURNSTILE_GRANT_SECRET?: string
}

export interface TurnstileAuthorizationFailure {
  readonly status: number
  readonly code: AnalyzeErrorCode
  readonly message: string
  readonly retryable: boolean
  readonly severity: "WARNING" | "ERROR"
  readonly errorClass: string
}

interface TurnstileVerificationLog {
  readonly success: boolean
  readonly tokenPresent: boolean
  readonly tokenLength: number | null
  readonly result: string
  readonly errorCodes?: ReadonlyArray<string>
}

interface TurnstileAuthorizationTelemetry {
  readonly grantOutcome?: string
  readonly verification?: TurnstileVerificationLog
}

export interface TurnstileAuthorizationInput {
  readonly request: Request
  readonly requestId: string
  readonly url: string
  readonly env: TurnstileEnvironment
  readonly runtimeConfig: RuntimeConfig
  readonly createFailureResponse: (
    failure: TurnstileAuthorizationFailure
  ) => Response
}

export type TurnstileAuthorizationResult =
  | (TurnstileAuthorizationTelemetry & {
      readonly authorized: true
      readonly grantCookieHeader?: string
    })
  | (TurnstileAuthorizationTelemetry & {
      readonly authorized: false
      readonly response: Response
      readonly failure: TurnstileAuthorizationFailure
      readonly requestError: Error | undefined
    })

const readTurnstileResponse = async (
  response: Response,
  signal: AbortSignal
) => {
  const reader = response.body?.getReader()

  if (!reader) {
    throw new Error("Turnstile verification returned an empty response.")
  }

  try {
    const bytes = await readStreamBytesWithinLimit({
      reader,
      maxBytes: MAX_TURNSTILE_RESPONSE_BYTES,
      overflow: "reject",
      signal,
    })

    if (bytes === null) {
      throw new Error(
        "Turnstile verification response exceeded its size limit."
      )
    }

    return Schema.decodeUnknownSync(TurnstileResponseSchema)(
      JSON.parse(new TextDecoder().decode(bytes))
    )
  } finally {
    reader.releaseLock()
  }
}

const fetchTurnstileOutcome = async (
  input: TurnstileAuthorizationInput,
  formData: FormData
): Promise<TurnstileResponse> => {
  const signal = AbortSignal.any([
    input.request.signal,
    AbortSignal.timeout(TURNSTILE_VERIFY_TIMEOUT_MS),
  ])

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      body: formData,
      signal,
    }
  )

  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(
      `Turnstile verification returned HTTP ${String(response.status)}.`
    )
  }

  return readTurnstileResponse(response, signal)
}

const createVerificationLog = (input: {
  readonly success: boolean
  readonly tokenSummary: ReturnType<typeof summarizeSensitiveToken>
  readonly result: string
  readonly outcome?: TurnstileResponse
}): TurnstileVerificationLog => ({
  success: input.success,
  tokenPresent: input.tokenSummary.tokenPresent,
  tokenLength: input.tokenSummary.tokenLength,
  result: input.result,
  errorCodes: input.outcome?.["error-codes"],
})

const rejectTurnstile = (input: {
  readonly authorizationInput: TurnstileAuthorizationInput
  readonly failure: TurnstileAuthorizationFailure
  readonly telemetry: TurnstileAuthorizationTelemetry
  readonly requestError?: Error
}): TurnstileAuthorizationResult => ({
  authorized: false,
  response: input.authorizationInput.createFailureResponse(input.failure),
  failure: input.failure,
  ...input.telemetry,
  requestError: input.requestError,
})

const verifyTurnstileToken = async (input: {
  readonly authorizationInput: TurnstileAuthorizationInput
  readonly token: string
  readonly tokenSummary: ReturnType<typeof summarizeSensitiveToken>
  readonly secret: string
  readonly grantSecret: string
  readonly grantOutcome: string
}): Promise<TurnstileAuthorizationResult> => {
  const formData = new FormData()
  formData.append("secret", input.secret)
  formData.append("response", input.token)
  formData.append(
    "remoteip",
    input.authorizationInput.request.headers.get("CF-Connecting-IP") ?? ""
  )
  // Generate this key server-side so visitor-supplied request IDs cannot replay siteverify results.
  formData.append("idempotency_key", crypto.randomUUID())

  let outcome: TurnstileResponse

  try {
    outcome = await fetchTurnstileOutcome(input.authorizationInput, formData)
  } catch (cause) {
    const requestError =
      cause instanceof Error ? cause : new Error(String(cause))

    return rejectTurnstile({
      authorizationInput: input.authorizationInput,
      failure: {
        status: 503,
        code: "INTERNAL_ERROR",
        message:
          "Security check is unavailable right now. Try again in a moment.",
        retryable: true,
        severity: "ERROR",
        errorClass: "TURNSTILE_VERIFY_UNAVAILABLE",
      },
      telemetry: { grantOutcome: input.grantOutcome },
      requestError,
    })
  }

  if (!outcome.success) {
    return rejectTurnstile({
      authorizationInput: input.authorizationInput,
      failure: {
        status: 403,
        code: "AUTH_INVALID",
        message: "Security check failed. Refresh the page and try again.",
        retryable: false,
        severity: "WARNING",
        errorClass: "ANALYZE_AUTH_FAILED",
      },
      telemetry: {
        grantOutcome: input.grantOutcome,
        verification: createVerificationLog({
          success: false,
          tokenSummary: input.tokenSummary,
          result: "REJECTED",
          outcome,
        }),
      },
    })
  }

  const grant = await createTurnstileGrantToken({
    secret: input.grantSecret,
    url: input.authorizationInput.url,
  })

  return {
    authorized: true,
    grantCookieHeader: serializeTurnstileGrantCookie({
      token: grant.token,
      appEnv: input.authorizationInput.runtimeConfig.appEnv,
    }),
    grantOutcome: "TOKEN_VERIFIED",
    verification: createVerificationLog({
      success: true,
      tokenSummary: input.tokenSummary,
      result: "TOKEN_VERIFIED",
      outcome,
    }),
  }
}

const authorizeTurnstileRequest = async (
  input: TurnstileAuthorizationInput
): Promise<TurnstileAuthorizationResult> => {
  if (!input.runtimeConfig.turnstileEnabled) {
    return { authorized: true }
  }

  const secret = input.env.TURNSTILE_SECRET_KEY?.trim() ?? ""
  const grantSecret = input.env.TURNSTILE_GRANT_SECRET?.trim() ?? ""

  if (!secret || !grantSecret) {
    return rejectTurnstile({
      authorizationInput: input,
      failure: {
        status: 500,
        code: "INTERNAL_ERROR",
        message:
          "Security verification is unavailable right now. Try again later.",
        retryable: true,
        severity: "ERROR",
        errorClass: "TURNSTILE_MISCONFIGURED",
      },
      telemetry: {},
    })
  }

  const token = input.request.headers.get("CF-Turnstile-Response")
  const tokenSummary = summarizeSensitiveToken(token)

  const grantResult = await verifyTurnstileGrantToken({
    secret: grantSecret,
    url: input.url,
    token: readTurnstileGrantCookie(input.request.headers.get("cookie")),
  })

  if (grantResult.valid) {
    return {
      authorized: true,
      grantOutcome: grantResult.reason,
      verification: createVerificationLog({
        success: true,
        tokenSummary: summarizeSensitiveToken(null),
        result: "GRANT_VALID",
      }),
    }
  }

  if (!token) {
    const outcome: TurnstileResponse = {
      success: false,
      "error-codes": ["missing-input-response"],
    }

    return rejectTurnstile({
      authorizationInput: input,
      failure: {
        status: 403,
        code: "AUTH_REQUIRED",
        message: "Complete the security check to continue.",
        retryable: false,
        severity: "WARNING",
        errorClass: "ANALYZE_AUTH_FAILED",
      },
      telemetry: {
        grantOutcome: grantResult.reason,
        verification: createVerificationLog({
          success: false,
          tokenSummary,
          result: "REJECTED",
          outcome,
        }),
      },
    })
  }

  return verifyTurnstileToken({
    authorizationInput: input,
    token,
    tokenSummary,
    secret,
    grantSecret,
    grantOutcome: grantResult.reason,
  })
}

export class TurnstileAuthorization extends Context.Service<
  TurnstileAuthorization,
  {
    authorize(
      input: TurnstileAuthorizationInput
    ): Effect.Effect<TurnstileAuthorizationResult, unknown>
  }
>()("mediapeek/TurnstileAuthorization") {
  static readonly layer: Layer.Layer<TurnstileAuthorization> = Layer.effect(
    TurnstileAuthorization,
    Effect.sync(() => {
      const authorize = Effect.fn("TurnstileAuthorization.authorize")(
        (input: TurnstileAuthorizationInput) =>
          Effect.tryPromise({
            try: () => authorizeTurnstileRequest(input),
            catch: (cause) => cause,
          })
      )

      return { authorize }
    })
  )
}
