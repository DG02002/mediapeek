import {
  AnalyzerValidationIssueSchema,
  type AnalyzerRpcResponse,
  type AnalyzeErrorCode,
} from "@mediapeek/shared/analyze-contract"
import { Schema } from "effect"

import type { AnalyzeExecution } from "~/lib/analyze-request-log.server"
import type {
  AnalysisGatewayError,
  AnalysisGatewayResponse,
} from "~/services/analysis-gateway.server"
import type { AnalysisPolicyError } from "~/services/analysis-policy.server"

type AnalyzerSuccessResponse = Extract<AnalyzerRpcResponse, { success: true }>

const LEGACY_GET_WARNING =
  '299 - "GET /resource/analyze is deprecated. Use POST /resource/analyze with JSON body."'

const POLICY_ERROR_CLASSES = {
  "invalid-json": "ANALYZE_VALIDATION_FAILED",
  "validation-failed": "ANALYZE_VALIDATION_FAILED",
  "rate-limited": "ANALYZE_RATE_LIMITED",
  "rate-limit-unavailable": "ANALYZE_RATE_LIMIT_UNAVAILABLE",
  "rate-limit-missing": "ANALYZE_RATE_LIMIT_MISSING",
} satisfies Record<AnalysisPolicyError["reason"], string>

const ANALYZER_ERROR_CLASSES: Partial<Record<AnalyzeErrorCode, string>> = {
  VALIDATION_FAILED: "ANALYZE_VALIDATION_FAILED",
  RATE_LIMITED: "ANALYZE_RATE_LIMITED",
}

const GATEWAY_ERROR_CLASSES: Record<AnalysisGatewayError["reason"], string> = {
  "binding-missing": "ANALYZER_BINDING_MISSING",
  aborted: "ANALYZER_TIMEOUT",
  network: "ANALYZER_NETWORK_ERROR",
  "invalid-response": "ANALYZER_INVALID_RESPONSE",
  "invalid-json": "ANALYZER_INVALID_RESPONSE",
  "invalid-contract": "ANALYZER_INVALID_RESPONSE",
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

export interface AnalyzeFailure {
  status: number
  code: AnalyzeErrorCode
  message: string
  retryable: boolean
  severity: "WARNING" | "ERROR"
  errorClass?: string
  headers?: HeadersInit
}

export interface AnalyzeRouteResponseState {
  readonly request: Request
  readonly requestLog: AnalyzeExecution["state"]
  compatibilityHeaders?: HeadersInit
  requestError?: Error
}

export const getCompatibilityHeaders = (legacyGet: boolean) =>
  legacyGet
    ? {
        Warning: LEGACY_GET_WARNING,
        Deprecation: "true",
      }
    : undefined

export const mergeHeaders = (
  ...headersList: Array<HeadersInit | undefined>
) => {
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

const buildSuccessResponse = (options: {
  readonly requestId: string
  readonly results: Record<string, string>
  readonly warnings: AnalyzerSuccessResponse["warnings"]
  readonly headers?: HeadersInit
}) =>
  Response.json(
    {
      success: true,
      requestId: options.requestId,
      results: options.results,
      warnings: options.warnings,
    },
    { headers: options.headers }
  )

export const failRequest = (
  state: AnalyzeRouteResponseState,
  failure: AnalyzeFailure
): Response => {
  const { status, severity, errorClass, headers, ...details } = failure
  state.requestLog.setStatus(status)
  state.requestLog.setSeverity(severity)

  if (errorClass) {
    state.requestLog.context.errorClass = errorClass
  }

  return buildErrorResponse(state.requestLog.requestId, status, {
    ...details,
    headers: headers ?? state.compatibilityHeaders,
  })
}

export const createPolicyErrorResponse = (
  state: AnalyzeRouteResponseState,
  error: AnalysisPolicyError
) => {
  if (error.rateLimitSource) {
    state.requestLog.context.rateLimitSource = error.rateLimitSource
  }

  if (error.rateLimitBindingError) {
    state.requestLog.context.rateLimitBindingError = error.rateLimitBindingError
  }

  if (error.reason === "invalid-json" || error.reason === "validation-failed") {
    state.requestLog.context.validationReason = error.reason
    state.requestLog.context.validationMessage = error.message
  }

  let headers = state.compatibilityHeaders

  if (error.retryAfterSeconds !== undefined) {
    headers = mergeHeaders(state.compatibilityHeaders, {
      "Retry-After": String(Math.max(1, Math.ceil(error.retryAfterSeconds))),
    })
  }

  const errorClass = POLICY_ERROR_CLASSES[error.reason]

  return failRequest(state, {
    status: error.status,
    code: error.code,
    message: error.message,
    retryable: error.retryable,
    severity: error.status < 500 ? "WARNING" : "ERROR",
    errorClass,
    headers,
  })
}

const handleAnalyzerError = (
  state: AnalyzeRouteResponseState,
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

  const errorClass = ANALYZER_ERROR_CLASSES[code] ?? `ANALYZE_${code}`

  return failRequest(state, {
    status: responseStatus,
    code,
    message,
    retryable,
    severity: responseStatus >= 500 ? "ERROR" : "WARNING",
    errorClass,
  })
}

const completeAnalyzeResponse = (
  state: AnalyzeRouteResponseState,
  data: AnalyzerSuccessResponse,
  grantCookieHeader?: string
) => {
  const { results, diagnostics } = data
  state.requestLog.context.fetch = { ...diagnostics.fetch }
  state.requestLog.context.analysis = { ...diagnostics.analysis }

  if (data.fileSize) {
    state.requestLog.context.fileSize = data.fileSize
  }

  const resolvedFilename =
    diagnostics.analysis.resolvedFilename ?? diagnostics.fetch.resolvedFilename

  state.requestLog.context.filename = resolvedFilename
  state.requestLog.context.filenameSource =
    diagnostics.analysis.resolvedFilenameSource ??
    diagnostics.fetch.resolvedFilenameSource

  if (diagnostics.analysis.archiveFilename) {
    state.requestLog.context.archiveName = diagnostics.analysis.archiveFilename
    state.requestLog.context.innerFilename = resolvedFilename
  }

  return buildSuccessResponse({
    requestId: state.requestLog.requestId,
    results,
    warnings: data.warnings,
    headers: mergeHeaders(
      state.compatibilityHeaders,
      grantCookieHeader ? { "Set-Cookie": grantCookieHeader } : undefined
    ),
  })
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

  const errorClass = GATEWAY_ERROR_CLASSES[error.reason]

  return { status, code, errorClass }
}

export const handleAnalysisGatewayError = (
  state: AnalyzeRouteResponseState,
  error: AnalysisGatewayError
) => {
  state.requestError = error
  state.requestLog.context.gatewayErrorReason = error.reason

  if (error.responsePreview) {
    state.requestLog.context.analyzerResponsePreview = error.responsePreview
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

export const handleAnalysisGatewayResponse = (
  state: AnalyzeRouteResponseState,
  response: AnalysisGatewayResponse,
  grantCookieHeader?: string
) => {
  state.requestLog.context.analyzerStatus = response.status
  state.requestLog.context.analyzerContentType = response.contentType

  if (response.mode === "stream") {
    state.requestLog.setStatus(response.status)

    if (response.status >= 500) {
      state.requestLog.setSeverity("ERROR")
    } else if (response.status >= 400) {
      state.requestLog.setSeverity("WARNING")
    } else {
      state.requestLog.setSeverity("INFO")
    }

    return response.response
  }

  if (!response.data.success) {
    return handleAnalyzerError(state, response.status, response.data.error)
  }

  return completeAnalyzeResponse(state, response.data, grantCookieHeader)
}

export const handleUnexpectedError = (
  state: AnalyzeRouteResponseState,
  caughtError: Error
) => {
  state.requestError = caughtError
  const message = "An unexpected error occurred."

  let failure: AnalyzeFailure = {
    status: 500,
    code: "INTERNAL_ERROR",
    message,
    retryable: false,
    severity: "ERROR",
    errorClass: "ANALYZE_INTERNAL_ERROR",
  }

  if (
    caughtError.name === "AbortError" ||
    caughtError.name === "TimeoutError"
  ) {
    failure = {
      status: 504,
      code: "UPSTREAM_FETCH_FAILED",
      message:
        "Analysis request timed out upstream. Retry with a smaller or simpler source URL.",
      retryable: true,
      severity: "ERROR",
      errorClass: "ANALYZER_TIMEOUT",
    }
  }

  state.requestLog.context.errorClass ??= failure.errorClass
  state.requestLog.context.error = {
    code: failure.status,
    message: failure.message,
    details: caughtError.stack ?? caughtError.message,
  }

  return failRequest(state, {
    ...failure,
    headers: getCompatibilityHeaders(state.request.method !== "POST"),
  })
}
