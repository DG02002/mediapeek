import {
  AnalyzerValidationIssueSchema,
  type AnalyzerRpcResponse,
  type AnalyzeErrorCode,
} from "@mediapeek/shared/analyze-contract"
import { ANALYZE_PROGRESS_STREAM_CONTENT_TYPE } from "@mediapeek/shared/analyze-progress"
import {
  redactSensitiveUrl,
  summarizeSensitiveToken,
} from "@mediapeek/shared/log-redaction"
import {
  type AnalyzeInput,
  type TurnstileResponse,
} from "@mediapeek/shared/schemas"
import { Effect, Match, Result, Schema } from "effect"

import {
  DEFAULT_ANALYZER_REQUEST_TIMEOUT_MS,
  MAX_ANALYZER_REQUEST_TIMEOUT_MS,
} from "~/constants"
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
import {
  AnalysisGateway,
  AnalysisGatewayError,
} from "~/services/analysis-gateway.server"
import {
  AnalysisPolicy,
  AnalysisPolicyError,
  type AnalysisPolicyInput,
} from "~/services/analysis-policy.server"
import { getWorkerAppRuntime } from "~/services/app-runtime.server"
import {
  createRequestContext,
  RequestContext,
} from "~/services/request-context.server"

import type { Route } from "./+types/route"

const LEGACY_GET_WARNING =
  '299 - "GET /resource/analyze is deprecated. Use POST /resource/analyze with JSON body."'

const archiveMediaSchema = Schema.Struct({
  media: Schema.optionalKey(
    Schema.Struct({
      track: Schema.Array(
        Schema.StructWithRest(
          Schema.Struct({
            "@type": Schema.String,
            Archive_Name: Schema.optionalKey(Schema.String),
          }),
          [Schema.Record(Schema.String, Schema.Json)]
        )
      ),
    })
  ),
})

type AnalyzerSuccessResponse = Extract<AnalyzerRpcResponse, { success: true }>

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

interface ParsedAnalyzeInput {
  readonly policyInput: AnalysisPolicyInput
  readonly legacyGet: boolean
}

type AnalyzeQueryInput = typeof Schema.JsonObject.Type & {
  url: string | null
  format?: string[]
}

const createPolicyInput = (
  input: typeof Schema.JsonObject.Type,
  legacyGet: boolean,
  parseError?: string
): ParsedAnalyzeInput => {
  if (parseError) {
    return { policyInput: { input: {}, parseError }, legacyGet }
  }

  const { format } = input

  const normalizedInput = Schema.is(Schema.String)(format)
    ? { ...input, format: [format] }
    : input

  return { policyInput: { input: normalizedInput }, legacyGet }
}

const wantsProgressStream = (request: Request) =>
  request.headers
    .get("accept")
    ?.toLowerCase()
    .includes(ANALYZE_PROGRESS_STREAM_CONTENT_TYPE) ?? false

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
      const raw: unknown = await request.json()
      const decodedObject = Schema.decodeUnknownResult(Schema.JsonObject)(raw)

      if (Result.isFailure(decodedObject)) {
        return createPolicyInput(
          {},
          false,
          "Invalid JSON body. Expected an object payload."
        )
      }

      return createPolicyInput(decodedObject.success, false)
    } catch {
      return createPolicyInput({}, false, "Invalid JSON body.")
    }
  }

  const queryInput: AnalyzeQueryInput = {
    url: url.searchParams.get("url"),
  }

  if (url.searchParams.has("format")) {
    queryInput.format = url.searchParams.getAll("format")
  }

  return createPolicyInput(queryInput, true)
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

const getAnalyzerTimeoutMs = (env: Env) => {
  const configured = Number.parseInt(env.ANALYZER_REQUEST_TIMEOUT_MS ?? "", 10)

  if (Number.isNaN(configured) || configured <= 0) {
    return DEFAULT_ANALYZER_REQUEST_TIMEOUT_MS
  }

  return Math.min(MAX_ANALYZER_REQUEST_TIMEOUT_MS, configured)
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

const recordValidationFailure = (
  state: AnalyzeRequestState,
  error: AnalysisPolicyError
) => {
  state.customContext.validationReason = error.reason
  state.customContext.validationMessage = error.message
}

const getAnalysisPolicyErrorClass = (reason: AnalysisPolicyError["reason"]) =>
  Match.value(reason).pipe(
    Match.when("rate-limited", () => "ANALYZE_RATE_LIMITED"),
    Match.when(
      "rate-limit-unavailable",
      () => "ANALYZE_RATE_LIMIT_UNAVAILABLE"
    ),
    Match.when("rate-limit-missing", () => "ANALYZE_RATE_LIMIT_MISSING"),
    Match.orElse(() => "ANALYZE_VALIDATION_FAILED")
  )

const createPolicyErrorResponse = (
  state: AnalyzeRequestState,
  error: AnalysisPolicyError
) => {
  if (error.rateLimitSource) {
    state.customContext.rateLimitSource = error.rateLimitSource
  }

  if (error.rateLimitBindingError) {
    state.customContext.rateLimitBindingError = error.rateLimitBindingError
  }

  if (error.reason === "invalid-json" || error.reason === "validation-failed") {
    recordValidationFailure(state, error)
  }

  let headers = state.compatibilityHeaders

  if (error.retryAfterSeconds !== undefined) {
    headers = mergeHeaders(state.compatibilityHeaders, {
      "Retry-After": String(Math.max(1, Math.ceil(error.retryAfterSeconds))),
    })
  }

  return failRequest(state, {
    status: error.status,
    code: error.code,
    message: error.message,
    retryable: error.retryable,
    severity: error.status < 500 ? "WARNING" : "ERROR",
    errorClass: getAnalysisPolicyErrorClass(error.reason),
    headers,
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

  const runtime = getWorkerAppRuntime(state.env)

  const requestContext = createRequestContext({
    request: state.request,
    requestId: state.requestId,
    runtimeConfig: state.runtimeConfig,
  })

  try {
    const decision = await runtime.runPromise(
      Effect.gen(function* () {
        const analysisPolicy = yield* AnalysisPolicy

        return yield* analysisPolicy.authorize(parsed.policyInput)
      }).pipe(Effect.provideService(RequestContext, requestContext))
    )

    if (decision.rateLimitBindingError) {
      state.customContext.rateLimitBindingError = decision.rateLimitBindingError
    }

    return { success: true, data: decision.input }
  } catch (caughtError) {
    if (!(caughtError instanceof AnalysisPolicyError)) {
      throw caughtError
    }

    return {
      success: false,
      response: createPolicyErrorResponse(state, caughtError),
    }
  }
}

const recordTurnstileVerification = (
  state: AnalyzeRequestState,
  input: {
    success: boolean
    tokenSummary: ReturnType<typeof summarizeSensitiveToken>
    result: string
    outcome?: TurnstileResponse
  }
) => {
  state.customContext.turnstileVerification = {
    success: input.success,
    tokenPresent: input.tokenSummary.tokenPresent,
    tokenLength: input.tokenSummary.tokenLength,
    result: input.result,
    errorCodes: input.outcome?.["error-codes"],
  }
}

const rejectTurnstile = (
  state: AnalyzeRequestState,
  input: {
    failure: AnalyzeFailure
    tokenSummary?: ReturnType<typeof summarizeSensitiveToken>
    outcome?: TurnstileResponse
  }
): TurnstileDecision => {
  const { failure, tokenSummary, outcome } = input

  if (tokenSummary) {
    recordTurnstileVerification(state, {
      success: false,
      tokenSummary,
      result: "REJECTED",
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

  const rawOutcome: unknown = await result.json()
  const outcome = Schema.decodeUnknownSync(TurnstileResponseSchema)(rawOutcome)

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
  recordTurnstileVerification(state, {
    success: true,
    tokenSummary: input.tokenSummary,
    result: "TOKEN_VERIFIED",
    outcome,
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
  if (!state.runtimeConfig.turnstileEnabled) {
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
    recordTurnstileVerification(state, {
      success: true,
      tokenSummary: summarizeSensitiveToken(null),
      result: "GRANT_VALID",
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
    signal: AbortSignal.any([
      state.request.signal,
      AbortSignal.timeout(getAnalyzerTimeoutMs(state.env)),
    ]),
  }
}

const streamAnalyzerResponse = async (
  state: AnalyzeRequestState,
  input: {
    binding: Fetcher
    url: string
    format: ReadonlyArray<string>
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
    signal: input.options.signal,
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
  if (Schema.is(Schema.Array(AnalyzerValidationIssueSchema))(errorData)) {
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
    const raw: unknown = JSON.parse(jsonResult || "{}")
    const parsed = Schema.decodeUnknownResult(archiveMediaSchema)(raw)

    if (Result.isFailure(parsed)) {
      return
    }

    const general = parsed.success.media?.track.find(
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
  data: AnalyzerSuccessResponse,
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

  return buildSuccessResponse(
    state.requestId,
    results,
    mergeHeaders(
      state.compatibilityHeaders,
      grantCookieHeader ? { "Set-Cookie": grantCookieHeader } : undefined
    )
  )
}

const getAnalysisGatewayErrorDetails = (error: AnalysisGatewayError) => {
  let status = 502
  let code: AnalyzeErrorCode = "INTERNAL_ERROR"

  if (error.reason === "aborted") {
    status = 504
    code = "UPSTREAM_FETCH_FAILED"
  } else if (error.reason === "binding-missing" || error.reason === "network") {
    status = 503
  }

  const errorClass = Match.value(error.reason).pipe(
    Match.when("binding-missing", () => "ANALYZER_BINDING_MISSING"),
    Match.when("aborted", () => "ANALYZER_TIMEOUT"),
    Match.when("network", () => "ANALYZER_NETWORK_ERROR"),
    Match.orElse(() => "ANALYZER_INVALID_RESPONSE")
  )

  return { status, code, errorClass }
}

const handleAnalysisGatewayError = (
  state: AnalyzeRequestState,
  error: AnalysisGatewayError
) => {
  state.requestError = error
  state.customContext.gatewayErrorReason = error.reason

  if (error.responsePreview) {
    state.customContext.analyzerResponsePreview = error.responsePreview
  }

  const { status, code, errorClass } = getAnalysisGatewayErrorDetails(error)

  return failRequest(state, {
    status,
    code,
    message: error.message,
    retryable: error.retryable,
    severity: "ERROR",
    errorClass,
  })
}

const callAnalyzerJson = async (
  state: AnalyzeRequestState,
  input: {
    readonly data: AnalyzeInput
    readonly grantCookieHeader?: string
    readonly signal: AbortSignal
  }
) => {
  const runtime = getWorkerAppRuntime(state.env)

  const requestContext = createRequestContext({
    request: state.request,
    requestId: state.requestId,
    runtimeConfig: state.runtimeConfig,
    signal: input.signal,
  })

  try {
    const response = await runtime.runPromise(
      Effect.gen(function* () {
        const analysisGateway = yield* AnalysisGateway
        const apiKey = state.env.ANALYZE_API_KEY?.trim()
        const gatewayRequest = apiKey ? { ...input.data, apiKey } : input.data

        return yield* analysisGateway.analyze(gatewayRequest)
      }).pipe(Effect.provideService(RequestContext, requestContext))
    )

    state.customContext.analyzerStatus = response.status
    state.customContext.analyzerContentType = response.contentType

    if (!response.data.success) {
      return handleAnalyzerError(state, response.status, response.data.error)
    }

    return completeAnalyzeResponse(
      state,
      response.data,
      input.grantCookieHeader
    )
  } catch (caughtError) {
    if (caughtError instanceof AnalysisGatewayError) {
      return handleAnalysisGatewayError(state, caughtError)
    }

    throw caughtError
  }
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
  state.customContext.targetUrl = redactedUrl

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

  return callAnalyzerJson(state, {
    data: input.data,
    grantCookieHeader: input.grantCookieHeader,
    signal: options.signal,
  })
}

const remoteFetchErrorSchema = Schema.Struct({ remote: Schema.Boolean })

const isRemoteFetchError = (error: Error) => {
  return Schema.is(remoteFetchErrorSchema)(error) && error.remote
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

  state.customContext.errorClass ??= failure.errorClass
  state.customContext.error = {
    code: failure.status,
    message: failure.message,
    details: caughtError.stack ?? caughtError.message,
  }

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
