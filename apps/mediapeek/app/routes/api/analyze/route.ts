import {
  AnalyzeErrorSchema,
  type AnalyzeErrorCode,
} from "@mediapeek/shared/analyze-contract"
import { ANALYZE_PROGRESS_STREAM_CONTENT_TYPE } from "@mediapeek/shared/analyze-progress"
import {
  redactSensitiveUrl,
  summarizeSensitiveToken,
} from "@mediapeek/shared/log-redaction"
import { analyzeSchema, type AnalyzeInput } from "@mediapeek/shared/schemas"
import { Match } from "effect"
import { hc } from "hono/client"
import type { AppType } from "mediapeek-analyzer"
import { z } from "zod"

import { cloudflareContext } from "~/lib/cloudflare-context.server"
import { type LogContext, requestStorage } from "~/lib/logger.server"
import {
  finishFallbackRequestLogger,
  getRequestIdFromLogger,
  getRequestLogger,
} from "~/lib/request-logger.server"
import { TurnstileResponseSchema } from "~/lib/schemas/turnstile"
import {
  createTurnstileGrantToken,
  readTurnstileGrantCookie,
  serializeTurnstileGrantCookie,
  verifyTurnstileGrantToken,
} from "~/lib/turnstile-grant.server"
import { mediaPeekEmitter } from "~/services/event-bus.server"
import { initTelemetry } from "~/services/telemetry.server"

import type { Route } from "./+types/route"

const RATE_LIMIT_WINDOW_MS = 60_000
const DEFAULT_RATE_LIMIT_PER_MINUTE = 30
const DEFAULT_ANALYZER_REQUEST_TIMEOUT_MS = 60_000

const LEGACY_GET_WARNING =
  '299 - "GET /resource/analyze is deprecated. Use POST /resource/analyze with JSON body."'

const rateLimitState = new Map<string, { count: number; resetAt: number }>()

const fetchDiagnosticsSchema = z.object({
  headRequestDurationMs: z.number(),
  fetchRequestDurationMs: z.number(),
  totalDurationMs: z.number(),
  isGoogleDrive: z.boolean(),
  resolvedFilename: z.string(),
  resolvedFilenameSource: z.string(),
  responseStatus: z.number(),
  probeMethod: z.string(),
  firstByteReadTimeoutMs: z.number().optional(),
  firstByteReadRetries: z.number().optional(),
  firstByteReadStrategy: z.enum(["range", "no_range_fallback"]).optional(),
  seekFetchCount: z.number().optional(),
  seekBytesFetched: z.number().optional(),
  streamCloseError: z.string().optional(),
})

const mediaInfoDiagnosticsSchema = z.object({
  wasmLoadTimeMs: z.number(),
  factoryCreateTimeMs: z.number(),
  formatGenerationTimes: z.record(z.string(), z.number()),
  totalAnalysisTimeMs: z.number(),
  wasmLoadError: z.string().optional(),
  objectProcessError: z.string().optional(),
  formatErrors: z.record(z.string(), z.string()),
})

const analyzerRpcResponseSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    requestId: z.string().optional(),
    fileSize: z.number().optional(),
    results: z.record(z.string(), z.string()),
    diagnostics: z.object({
      fetch: fetchDiagnosticsSchema,
      analysis: mediaInfoDiagnosticsSchema.extend({
        resolvedFilename: z.string().optional(),
        resolvedFilenameSource: z.string().optional(),
      }),
    }),
  }),
  z.object({
    success: z.literal(false),
    error: z.union([
      z.array(z.object({ message: z.string() })),
      AnalyzeErrorSchema,
    ]),
  }),
])

const archiveMediaSchema = z.object({
  media: z
    .object({
      track: z.array(
        z
          .object({
            "@type": z.string(),
            Archive_Name: z.string().optional(),
          })
          .passthrough()
      ),
    })
    .optional(),
})

type AnalyzerRpcResponse = z.infer<typeof analyzerRpcResponseSchema>

type AnalyzerClientResponse = Awaited<
  ReturnType<ReturnType<typeof hc<AppType>>["analyze"]["$post"]>
>

type AnalyzeRouteArgs = {
  request: Request
  context: Route.LoaderArgs["context"]
}

interface AnalyzeRequestState {
  readonly request: Request
  readonly requestId: string
  readonly url: URL
  readonly env: Env
  readonly runtimeConfig: NonNullable<LogContext["runtimeConfig"]>
  readonly customContext: NonNullable<LogContext["customContext"]>
  compatibilityHeaders?: HeadersInit
  status: number
  severity: "INFO" | "WARNING" | "ERROR"
  requestError?: Error
}

interface AnalyzeExecution {
  readonly state: AnalyzeRequestState
  readonly logContext: LogContext
  readonly requestLoggerHandle: ReturnType<typeof getRequestLogger>
  readonly startTime: number
}

interface AnalyzeErrorPayload {
  success: false
  requestId: string
  error: {
    code: AnalyzeErrorCode
    message: string
    retryable: boolean
  }
}

interface AnalyzeErrorDetails {
  code: AnalyzeErrorCode
  message: string
  retryable: boolean
  headers?: HeadersInit
}

interface AnalyzeFailure {
  status: number
  code: AnalyzeErrorCode
  message: string
  retryable: boolean
  severity: "WARNING" | "ERROR"
  errorClass?: string
  headers?: HeadersInit
}

const analyzeRequestSchema = z.object({
  url: analyzeSchema.shape.url,
  format: z
    .union([z.string(), z.array(z.string())])
    .transform((format) => (Array.isArray(format) ? format : [format]))
    .default(["JSON"]),
})

type ParsedAnalyzeInput =
  | { success: true; data: AnalyzeInput; legacyGet: boolean }
  | {
      success: false
      legacyGet: boolean
      parseError?: string
      issues?: z.ZodIssue[]
    }

const wantsProgressStream = (request: Request) =>
  request.headers
    .get("accept")
    ?.toLowerCase()
    .includes(ANALYZE_PROGRESS_STREAM_CONTENT_TYPE) ?? false

const getClientIp = (request: Request) =>
  request.headers.get("CF-Connecting-IP") ??
  request.headers.get("x-real-ip") ??
  "anonymous"

const getCompatibilityHeaders = (legacyGet: boolean) =>
  legacyGet
    ? {
        Warning: LEGACY_GET_WARNING,
        Deprecation: "true",
      }
    : undefined

const mergeHeaders = (...headersList: Array<HeadersInit | undefined>) => {
  const merged = new Headers()

  for (const headers of headersList) {
    if (!headers) {
      continue
    }

    const source = new Headers(headers)
    source.forEach((value, key) => {
      merged.append(key, value)
    })
  }

  return merged
}

const parseAnalyzeInput = async (
  request: Request,
  url: URL
): Promise<ParsedAnalyzeInput> => {
  if (request.method === "POST") {
    try {
      const raw = await request.json()

      const result = analyzeRequestSchema.safeParse(raw)

      if (!result.success) {
        return { success: false, legacyGet: false, issues: result.error.issues }
      }

      return {
        success: true,
        data: result.data,
        legacyGet: false,
      }
    } catch {
      return {
        success: false,
        legacyGet: false,
        parseError: "Invalid JSON body.",
      }
    }
  }

  const result = analyzeRequestSchema.safeParse({
    url: url.searchParams.get("url"),
    format: url.searchParams.has("format")
      ? url.searchParams.getAll("format")
      : undefined,
  })

  if (!result.success) {
    return { success: false, legacyGet: true, issues: result.error.issues }
  }

  return {
    success: true,
    data: result.data,
    legacyGet: true,
  }
}

const getApiKeyFromRequest = (request: Request): string | null => {
  const xApiKey = request.headers.get("x-api-key")

  if (xApiKey) {
    return xApiKey
  }

  const authorization = request.headers.get("authorization")

  if (!authorization?.startsWith("Bearer ")) {
    return null
  }

  return authorization.slice("Bearer ".length).trim() || null
}

const buildErrorResponse = (
  requestId: string,
  status: number,
  details: AnalyzeErrorDetails
) => {
  const payload = {
    success: false,
    requestId,
    error: {
      code: details.code,
      message: details.message,
      retryable: details.retryable,
    },
  } satisfies AnalyzeErrorPayload

  return Response.json(payload, { status, headers: details.headers })
}

const buildSuccessResponse = (
  requestId: string,
  results: Record<string, string>,
  headers?: HeadersInit
) =>
  Response.json(
    {
      success: true,
      requestId,
      results,
    },
    { headers }
  )

const isCpuLimitError = (error: Error) =>
  /(exceeded cpu|cpu budget exceeded)/i.test(error.message)

const applyRateLimit = (request: Request, maxPerMinute: number) => {
  const now = Date.now()
  const key = getClientIp(request)
  const current = rateLimitState.get(key)

  if (!current || now >= current.resetAt) {
    rateLimitState.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    })

    return { allowed: true, retryAfterMs: 0 }
  }

  if (current.count >= maxPerMinute) {
    return { allowed: false, retryAfterMs: current.resetAt - now }
  }

  current.count += 1
  rateLimitState.set(key, current)

  // Keep memory bounded for long-lived isolates.
  if (rateLimitState.size > 4000) {
    for (const [entryKey, entry] of rateLimitState.entries()) {
      if (entry.resetAt <= now) {
        rateLimitState.delete(entryKey)
      }
    }
  }

  return { allowed: true, retryAfterMs: 0 }
}

const getRateLimitConfig = (env: Env) => {
  const configured = Number.parseInt(
    env.ANALYZE_RATE_LIMIT_PER_MINUTE ?? "",
    10
  )

  if (Number.isNaN(configured) || configured <= 0) {
    return DEFAULT_RATE_LIMIT_PER_MINUTE
  }

  return configured
}

const getAnalyzerTimeoutMs = (env: Env) => {
  const configured = Number.parseInt(env.ANALYZER_REQUEST_TIMEOUT_MS ?? "", 10)

  if (Number.isNaN(configured) || configured <= 0) {
    return DEFAULT_ANALYZER_REQUEST_TIMEOUT_MS
  }

  return Math.min(180_000, configured)
}

interface TurnstileDecision {
  authorized: boolean
  response?: Response
  grantCookieHeader?: string
}

const createExecution = ({
  request,
  context,
}: AnalyzeRouteArgs): AnalyzeExecution => {
  const startTime = performance.now()
  const cloudflare = context.get(cloudflareContext)
  const requestLoggerHandle = getRequestLogger(context, request)
  const requestId = getRequestIdFromLogger(request, requestLoggerHandle.logger)
  const url = new URL(request.url)
  const customContext: NonNullable<LogContext["customContext"]> = {}

  const logContext: LogContext = {
    requestId,
    runtimeConfig: cloudflare.runtimeConfig,
    httpRequest: {
      requestMethod: request.method,
      requestUrl: url.pathname,
      status: 200,
      remoteIp: request.headers.get("CF-Connecting-IP") ?? undefined,
      userAgent: request.headers.get("User-Agent") ?? undefined,
      latency: "0s",
    },
    customContext,
  }

  const state: AnalyzeRequestState = {
    request,
    requestId,
    url,
    env: cloudflare.env,
    runtimeConfig: cloudflare.runtimeConfig,
    customContext,
    compatibilityHeaders: getCompatibilityHeaders(request.method !== "POST"),
    status: 200,
    severity: "INFO",
  }

  return { state, logContext, requestLoggerHandle, startTime }
}

const failRequest = (
  state: AnalyzeRequestState,
  failure: AnalyzeFailure
): Response => {
  const { status, severity, errorClass, headers, ...details } = failure
  state.status = status
  state.severity = severity

  if (errorClass) {
    state.customContext.errorClass = errorClass
  }

  return buildErrorResponse(state.requestId, status, {
    ...details,
    headers: headers ?? state.compatibilityHeaders,
  })
}

const failRateLimit = (
  state: AnalyzeRequestState,
  retryAfterMs: number,
  source: "cloudflare_binding" | "in_memory"
) => {
  state.customContext.rateLimitSource = source

  return failRequest(state, {
    status: 429,
    code: "RATE_LIMITED",
    message: "Too many analysis requests. Try again in a moment.",
    retryable: true,
    severity: "WARNING",
    errorClass: "ANALYZE_RATE_LIMITED",
    headers: mergeHeaders(state.compatibilityHeaders, {
      "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))),
    }),
  })
}

const checkAnalyzePolicy = async (
  state: AnalyzeRequestState
): Promise<Response | undefined> => {
  const expectedApiKey = state.env.ANALYZE_PUBLIC_API_KEY?.trim()

  if (expectedApiKey) {
    const providedApiKey = getApiKeyFromRequest(state.request)

    if (!providedApiKey) {
      return failRequest(state, {
        status: 401,
        code: "AUTH_REQUIRED",
        message: "Missing API key.",
        retryable: false,
        severity: "WARNING",
        errorClass: "ANALYZE_AUTH_FAILED",
      })
    }

    if (providedApiKey !== expectedApiKey) {
      return failRequest(state, {
        status: 403,
        code: "AUTH_INVALID",
        message: "Invalid API key.",
        retryable: false,
        severity: "WARNING",
        errorClass: "ANALYZE_AUTH_FAILED",
      })
    }
  }

  const rateLimiter = state.env.ANALYZE_RATE_LIMITER

  if (rateLimiter) {
    try {
      const outcome = await rateLimiter.limit({
        key: getClientIp(state.request),
      })

      if (!outcome.success) {
        return failRateLimit(state, 60_000, "cloudflare_binding")
      }
    } catch (error) {
      state.customContext.rateLimitBindingError =
        error instanceof Error ? error.message : String(error)
    }
  }

  const rateLimitResult = applyRateLimit(
    state.request,
    getRateLimitConfig(state.env)
  )

  if (!rateLimitResult.allowed) {
    return failRateLimit(state, rateLimitResult.retryAfterMs, "in_memory")
  }

  return undefined
}

const getValidationMessage = (issues: z.ZodIssue[]) => {
  const urlError = issues.find((issue) => issue.path[0] === "url")?.message

  const formatError = issues.find(
    (issue) => issue.path[0] === "format"
  )?.message

  return urlError ?? formatError ?? "The input provided is invalid."
}

const emitValidationFailure = (issues: z.ZodIssue[]) => {
  mediaPeekEmitter.emit("error", {
    error: new Error("Validation Failed"),
    context: {
      validationErrors: issues.map(({ code, message, path }) => ({
        code,
        message,
        path: path.map(String),
      })),
    },
  })
}

const validateAnalyzeRequest = async (
  state: AnalyzeRequestState
): Promise<
  { success: true; data: AnalyzeInput } | { success: false; response: Response }
> => {
  const parsed = await parseAnalyzeInput(state.request, state.url)
  state.compatibilityHeaders = getCompatibilityHeaders(parsed.legacyGet)
  state.customContext.apiContract = parsed.legacyGet
    ? "legacy_get_query"
    : "post_json"

  if (parsed.success) {
    return { success: true, data: parsed.data }
  }

  if (parsed.issues) {
    emitValidationFailure(parsed.issues)
  }

  const message = parsed.parseError ?? getValidationMessage(parsed.issues ?? [])

  const response = failRequest(state, {
    status: 422,
    code: "VALIDATION_FAILED",
    message,
    retryable: false,
    severity: "WARNING",
    errorClass: "ANALYZE_VALIDATION_FAILED",
  })

  return { success: false, response }
}

const rejectTurnstile = (
  state: AnalyzeRequestState,
  input: {
    failure: AnalyzeFailure
    tokenSummary?: ReturnType<typeof summarizeSensitiveToken>
    outcome?: ReturnType<typeof TurnstileResponseSchema.parse>
  }
): TurnstileDecision => {
  const { failure, tokenSummary, outcome } = input

  if (tokenSummary) {
    mediaPeekEmitter.emit("turnstile:verify", {
      success: false,
      ...tokenSummary,
      outcome,
    })
  }

  return { authorized: false, response: failRequest(state, failure) }
}

const verifyTurnstileToken = async (
  state: AnalyzeRequestState,
  input: {
    url: string
    secret: string
    grantSecret: string
    token: string
    tokenSummary: ReturnType<typeof summarizeSensitiveToken>
  }
): Promise<TurnstileDecision> => {
  const formData = new FormData()
  formData.append("secret", input.secret)
  formData.append("response", input.token)
  formData.append(
    "remoteip",
    state.request.headers.get("CF-Connecting-IP") ?? ""
  )
  formData.append("idempotency_key", state.requestId)

  const result = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: formData }
  )

  if (!result.ok) {
    const response = failRequest(state, {
      status: 503,
      code: "INTERNAL_ERROR",
      message:
        "Security check is unavailable right now. Try again in a moment.",
      retryable: true,
      severity: "ERROR",
      errorClass: "TURNSTILE_VERIFY_UNAVAILABLE",
    })

    return { authorized: false, response }
  }

  const outcome = TurnstileResponseSchema.parse(await result.json())

  if (!outcome.success) {
    return rejectTurnstile(state, {
      failure: {
        status: 403,
        code: "AUTH_INVALID",
        message: "Security check failed. Refresh the page and try again.",
        retryable: false,
        severity: "WARNING",
        errorClass: "ANALYZE_AUTH_FAILED",
      },
      tokenSummary: input.tokenSummary,
      outcome,
    })
  }

  state.customContext.turnstileGrantOutcome = "TOKEN_VERIFIED"
  mediaPeekEmitter.emit("turnstile:verify", {
    success: true,
    ...input.tokenSummary,
    outcome: { result: "TOKEN_VERIFIED" },
  })

  const grant = await createTurnstileGrantToken({
    secret: input.grantSecret,
    url: input.url,
  })

  const grantCookieHeader = serializeTurnstileGrantCookie({
    token: grant.token,
    appEnv: state.runtimeConfig.appEnv,
  })

  return { authorized: true, grantCookieHeader }
}

const authorizeTurnstile = async (
  state: AnalyzeRequestState,
  url: string
): Promise<TurnstileDecision> => {
  if (state.env.ENABLE_TURNSTILE !== "true") {
    return { authorized: true }
  }

  const secret = state.env.TURNSTILE_SECRET_KEY?.trim() ?? ""
  const grantSecret = state.env.TURNSTILE_GRANT_SECRET?.trim() ?? ""

  if (!secret || !grantSecret) {
    return {
      authorized: false,
      response: failRequest(state, {
        status: 500,
        code: "INTERNAL_ERROR",
        message:
          "Security verification is unavailable right now. Try again later.",
        retryable: true,
        severity: "ERROR",
        errorClass: "TURNSTILE_MISCONFIGURED",
      }),
    }
  }

  const token = state.request.headers.get("CF-Turnstile-Response")
  const tokenSummary = summarizeSensitiveToken(token)

  const existingGrantToken = readTurnstileGrantCookie(
    state.request.headers.get("cookie")
  )

  const grantResult = await verifyTurnstileGrantToken({
    secret: grantSecret,
    url,
    token: existingGrantToken,
  })

  state.customContext.turnstileGrantOutcome = grantResult.reason

  if (grantResult.valid) {
    mediaPeekEmitter.emit("turnstile:verify", {
      success: true,
      tokenPresent: false,
      tokenLength: 0,
      outcome: { result: "GRANT_VALID" },
    })

    return { authorized: true }
  }

  if (!token) {
    return rejectTurnstile(state, {
      failure: {
        status: 403,
        code: "AUTH_REQUIRED",
        message: "Complete the security check to continue.",
        retryable: false,
        severity: "WARNING",
        errorClass: "ANALYZE_AUTH_FAILED",
      },
      tokenSummary,
      outcome: { success: false, "error-codes": ["missing-input-response"] },
    })
  }

  return verifyTurnstileToken(state, {
    url,
    secret,
    grantSecret,
    token,
    tokenSummary,
  })
}

const createAnalyzerRequestOptions = (state: AnalyzeRequestState) => {
  const headers: Record<string, string> = {}
  const apiKey = state.env.ANALYZE_API_KEY?.trim()

  if (apiKey) {
    headers["x-api-key"] = apiKey
  }

  return {
    headers,
    signal: AbortSignal.timeout(getAnalyzerTimeoutMs(state.env)),
  }
}

const streamAnalyzerResponse = async (
  state: AnalyzeRequestState,
  input: {
    binding: Fetcher
    url: string
    format: string[]
    options: ReturnType<typeof createAnalyzerRequestOptions>
    grantCookieHeader?: string
  }
) => {
  const response = await input.binding.fetch("https://analyzer/analyze", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: ANALYZE_PROGRESS_STREAM_CONTENT_TYPE,
      ...input.options.headers,
    },
    body: JSON.stringify({ url: input.url, format: input.format }),
  })

  state.customContext.analyzerStatus = response.status
  state.customContext.analyzerContentType =
    response.headers.get("content-type")?.toLowerCase() ?? ""

  return new Response(response.body, {
    status: response.status,
    headers: mergeHeaders(
      response.headers,
      state.compatibilityHeaders,
      input.grantCookieHeader
        ? { "Set-Cookie": input.grantCookieHeader }
        : undefined,
      { "Cache-Control": "no-store" }
    ),
  })
}

const failUnexpectedAnalyzerResponse = async (
  state: AnalyzeRequestState,
  response: AnalyzerClientResponse
) => {
  state.customContext.errorClass = "ANALYZER_INVALID_RESPONSE"
  const preview = (await response.text()).slice(0, 240)
  state.customContext.analyzerResponsePreview = preview

  const isMissingLocalDevSession = /couldn't find a local dev session/i.test(
    preview
  )

  const message = isMissingLocalDevSession
    ? "Analyzer local dev worker is unavailable. Restart pnpm dev and retry."
    : "Analyzer service returned an unexpected response. Try again."

  return failRequest(state, {
    status: 502,
    code: "INTERNAL_ERROR",
    message,
    retryable: true,
    severity: "ERROR",
  })
}

const parseAnalyzerResponse = async (
  state: AnalyzeRequestState,
  response: AnalyzerClientResponse
): Promise<
  | { success: true; data: AnalyzerRpcResponse }
  | { success: false; response: Response }
> => {
  const responseClone = response.clone()

  try {
    const parsed = analyzerRpcResponseSchema.safeParse(await response.json())

    if (parsed.success) {
      return { success: true, data: parsed.data }
    }

    state.customContext.analyzerJsonError = parsed.error.message
  } catch (caughtError) {
    state.customContext.analyzerJsonError =
      caughtError instanceof Error ? caughtError.message : String(caughtError)
  }

  state.customContext.errorClass = "ANALYZER_INVALID_JSON"
  state.customContext.analyzerResponsePreview = (
    await responseClone.text()
  ).slice(0, 240)

  const failedResponse = failRequest(state, {
    status: 502,
    code: "INTERNAL_ERROR",
    message: "Analyzer service returned malformed data. Try again.",
    retryable: true,
    severity: "ERROR",
  })

  return { success: false, response: failedResponse }
}

const getBackendErrorClass = (code: AnalyzeErrorCode) =>
  Match.value(code).pipe(
    Match.when("VALIDATION_FAILED", () => "ANALYZE_VALIDATION_FAILED"),
    Match.when("RATE_LIMITED", () => "ANALYZE_RATE_LIMITED"),
    Match.orElse((value) => "ANALYZE_" + value)
  )

const handleAnalyzerError = (
  state: AnalyzeRequestState,
  responseStatus: number,
  errorData: Extract<AnalyzerRpcResponse, { success: false }>["error"]
) => {
  if (Array.isArray(errorData)) {
    const firstIssue = errorData.at(0)

    return failRequest(state, {
      status: 400,
      code: "VALIDATION_FAILED",
      message: firstIssue?.message ?? "Invalid request data.",
      retryable: false,
      severity: "WARNING",
      errorClass: "ANALYZE_VALIDATION_FAILED",
    })
  }

  const { code, message, retryable } = errorData

  return failRequest(state, {
    status: responseStatus,
    code,
    message,
    retryable,
    severity: responseStatus >= 500 ? "ERROR" : "WARNING",
    errorClass: getBackendErrorClass(code),
  })
}

const recordArchiveFilename = (
  state: AnalyzeRequestState,
  jsonResult: string,
  resolvedFilename: string
) => {
  try {
    const parsed = archiveMediaSchema.safeParse(JSON.parse(jsonResult || "{}"))

    if (!parsed.success) {
      return
    }

    const general = parsed.data.media?.track.find(
      (track) => track["@type"] === "General"
    )

    if (!general?.Archive_Name) {
      return
    }

    state.customContext.archiveName = general.Archive_Name
    state.customContext.innerFilename = resolvedFilename
  } catch {
    return
  }
}

const completeAnalyzeResponse = (
  state: AnalyzeRequestState,
  data: Extract<AnalyzerRpcResponse, { success: true }>,
  grantCookieHeader?: string
) => {
  const { results, diagnostics } = data
  state.customContext.fetch = { ...diagnostics.fetch }
  state.customContext.analysis = { ...diagnostics.analysis }

  if (data.fileSize) {
    state.customContext.fileSize = data.fileSize
  }

  const resolvedFilename =
    diagnostics.analysis.resolvedFilename ?? diagnostics.fetch.resolvedFilename

  state.customContext.filename = resolvedFilename
  state.customContext.filenameSource =
    diagnostics.analysis.resolvedFilenameSource ??
    diagnostics.fetch.resolvedFilenameSource

  recordArchiveFilename(state, results.json ?? "{}", resolvedFilename)
  mediaPeekEmitter.emit("analyze:complete", {
    results,
    diagnostics: diagnostics.analysis,
  })

  return buildSuccessResponse(
    state.requestId,
    results,
    mergeHeaders(
      state.compatibilityHeaders,
      grantCookieHeader ? { "Set-Cookie": grantCookieHeader } : undefined
    )
  )
}

const readAnalyzerRpcResponse = async (
  state: AnalyzeRequestState,
  response: AnalyzerClientResponse,
  grantCookieHeader?: string
) => {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""
  state.customContext.analyzerStatus = response.status
  state.customContext.analyzerContentType = contentType

  if (!contentType.includes("application/json")) {
    return failUnexpectedAnalyzerResponse(state, response)
  }

  const parsed = await parseAnalyzerResponse(state, response)

  if (!parsed.success) {
    return parsed.response
  }

  if (!parsed.data.success) {
    return handleAnalyzerError(state, response.status, parsed.data.error)
  }

  return completeAnalyzeResponse(state, parsed.data, grantCookieHeader)
}

const callAnalyzer = async (
  state: AnalyzeRequestState,
  input: {
    data: AnalyzeInput
    grantCookieHeader?: string
  }
) => {
  const initialUrl = input.data.url
  const requestedFormats = input.data.format
  const redactedUrl = redactSensitiveUrl(initialUrl)
  mediaPeekEmitter.emit("request:start", {
    requestId: state.requestId,
    url: redactedUrl,
  })

  const analyzerBinding = state.env.ANALYZER

  if (!analyzerBinding) {
    return failRequest(state, {
      status: 503,
      code: "INTERNAL_ERROR",
      message: "Analyzer service is unavailable. Try again in a moment.",
      retryable: true,
      severity: "ERROR",
      errorClass: "ANALYZER_BINDING_MISSING",
    })
  }

  const options = createAnalyzerRequestOptions(state)

  if (wantsProgressStream(state.request)) {
    return streamAnalyzerResponse(state, {
      binding: analyzerBinding,
      url: initialUrl,
      format: requestedFormats,
      options,
      grantCookieHeader: input.grantCookieHeader,
    })
  }

  const client = hc<AppType>("https://analyzer", {
    fetch: analyzerBinding.fetch.bind(analyzerBinding),
  })

  const response = await client.analyze.$post(
    { json: { url: initialUrl, format: requestedFormats } },
    options
  )

  return readAnalyzerRpcResponse(state, response, input.grantCookieHeader)
}

const remoteFetchErrorSchema = z.object({ remote: z.boolean() })

const isRemoteFetchError = (error: Error) => {
  const parsed = remoteFetchErrorSchema.safeParse(error)

  return parsed.success && parsed.data.remote
}

const isAnalyzerTimeout = (error: Error) =>
  error.name === "AbortError" ||
  /timed out|timeout|aborted/i.test(error.message)

const handleUnexpectedError = (
  state: AnalyzeRequestState,
  caughtError: Error
) => {
  state.requestError = caughtError
  const message = caughtError.message || "An unexpected error occurred."

  let failure: AnalyzeFailure = {
    status: 500,
    code: "INTERNAL_ERROR",
    message,
    retryable: false,
    severity: "ERROR",
    errorClass: "ANALYZE_INTERNAL_ERROR",
  }

  if (isCpuLimitError(caughtError)) {
    failure = {
      status: 503,
      code: "CPU_BUDGET_EXCEEDED",
      message:
        "CPU budget exceeded while analyzing this source. Retry with a smaller or simpler media file.",
      retryable: true,
      severity: "ERROR",
      errorClass: "CPU_LIMIT_EXCEEDED",
    }
  } else if (isAnalyzerTimeout(caughtError)) {
    failure = {
      status: 504,
      code: "UPSTREAM_FETCH_FAILED",
      message:
        "Analysis request timed out upstream. Retry with a smaller or simpler source URL.",
      retryable: true,
      severity: "ERROR",
      errorClass: "ANALYZER_TIMEOUT",
    }
  } else if (isRemoteFetchError(caughtError)) {
    failure = {
      status: 503,
      code: "UPSTREAM_FETCH_FAILED",
      message:
        "Unable to retrieve the media file. The remote server may be incompatible with our fetcher.",
      retryable: true,
      severity: "ERROR",
      errorClass: "ANALYZE_INTERNAL_ERROR",
    }
  }

  const errorObj = {
    code: failure.status,
    message: failure.message,
    details: caughtError.stack ?? caughtError.message,
  }

  state.customContext.errorClass ??= failure.errorClass
  mediaPeekEmitter.emit("error", {
    error: caughtError,
    context: { errorObj, requestId: state.requestId, code: failure.code },
  })

  return failRequest(state, {
    ...failure,
    headers: getCompatibilityHeaders(state.request.method !== "POST"),
  })
}

const finalizeAnalyzeRequest = (execution: AnalyzeExecution) => {
  const { state, logContext, requestLoggerHandle, startTime } = execution
  const { httpRequest } = logContext

  if (httpRequest) {
    httpRequest.status = state.status
    httpRequest.latency = String((performance.now() - startTime) / 1000) + "s"
  }

  requestLoggerHandle.logger.set({
    ...state.customContext,
    outcome: state.status < 400 ? "success" : "error",
    severity: state.severity.toLowerCase(),
    durationMs: performance.now() - startTime,
  })

  if (state.requestError && requestLoggerHandle.managed) {
    requestLoggerHandle.logger.error(state.requestError)
  }

  finishFallbackRequestLogger(
    requestLoggerHandle,
    state.status,
    state.requestError
  )
}

const executeAnalyzeRequest = async (
  state: AnalyzeRequestState
): Promise<Response> => {
  const policyResponse = await checkAnalyzePolicy(state)

  if (policyResponse) {
    return policyResponse
  }

  const validation = await validateAnalyzeRequest(state)

  if (!validation.success) {
    return validation.response
  }

  const turnstile = await authorizeTurnstile(state, validation.data.url)

  if (!turnstile.authorized) {
    return (
      turnstile.response ??
      failRequest(state, {
        status: 500,
        code: "INTERNAL_ERROR",
        message:
          "Security verification is unavailable right now. Try again later.",
        retryable: true,
        severity: "ERROR",
        errorClass: "TURNSTILE_MISCONFIGURED",
      })
    )
  }

  return callAnalyzer(state, {
    data: validation.data,
    grantCookieHeader: turnstile.grantCookieHeader,
  })
}

async function handleAnalyzeRequest(args: AnalyzeRouteArgs) {
  initTelemetry()
  const execution = createExecution(args)

  return requestStorage.run(execution.logContext, async () => {
    try {
      return await executeAnalyzeRequest(execution.state)
    } catch (caughtError) {
      const error =
        caughtError instanceof Error
          ? caughtError
          : new Error(String(caughtError))

      return handleUnexpectedError(execution.state, error)
    } finally {
      finalizeAnalyzeRequest(execution)
    }
  })
}

export async function loader(args: Route.LoaderArgs) {
  return handleAnalyzeRequest(args)
}

export async function action(args: Route.ActionArgs) {
  return handleAnalyzeRequest(args)
}
