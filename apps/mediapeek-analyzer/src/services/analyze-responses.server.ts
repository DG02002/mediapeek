import type {
  AnalyzeErrorCode,
  AnalyzerRpcSuccessResponse,
} from "@mediapeek/shared/analyze-contract"
import { Match, type Schema } from "effect"
import type { Context } from "hono"

import { unknownToError } from "../lib/error"
import {
  DiagnosticsError,
  isAnalyzerFailure,
  type AnalyzerFailure,
} from "../lib/error-utils"
import type {
  AnalysisExecutionInput,
  AnalysisExecutionResult,
} from "./analysis-execution.server"
import type { AnalyzerRequestLoggingEnvironment } from "./request-logging.server"

export interface AnalyzerAnalysisExecutor {
  (input: AnalysisExecutionInput): Promise<AnalysisExecutionResult>
}

export type AnalyzerContext = Context<AnalyzerRequestLoggingEnvironment>

export interface AnalyzeLogContext {
  [key: string]: typeof Schema.Json.Type
}

export type SetLogContextValue = (
  context: AnalyzeLogContext,
  key: string,
  cause: unknown
) => void

type RequestSeverity = "INFO" | "WARNING" | "ERROR"

type AnalyzeStatus = 200 | 400 | 401 | 403 | 429 | 500 | 502 | 503

interface ClassifiedAnalyzeError {
  status: AnalyzeStatus
  code: AnalyzeErrorCode
  message: string
  retryable: boolean
  severity: RequestSeverity
  errorClass: string
}

export interface AnalyzeLogActions {
  write: (context: AnalyzeLogContext) => void
  setError: () => void
  setWarning: () => void
}

export interface AnalyzeRequestState {
  readonly requestId: string
  readonly status: number
  readonly severity: RequestSeverity
  readonly context: AnalyzeLogContext
  annotate: (values: Partial<AnalyzeLogContext>) => void
  setStatus: (status: number) => void
  setSeverity: (severity: RequestSeverity) => void
  log: AnalyzeLogActions
  finalize: () => void
}

interface AnalyzeRequestResult {
  fileSize?: number
  results: Record<string, string>
  diagnostics: AnalysisExecutionResult["diagnostics"] & {
    analysis: AnalysisExecutionResult["diagnostics"]["analysis"] & {
      resolvedFilename: string
      resolvedFilenameSource: string
    }
  }
}

interface RunAnalyzeRequestInput {
  readonly url: string
  readonly formats: AnalysisExecutionInput["formats"]
  readonly cpuBudgetMs: number
  readonly logContext: AnalyzeLogContext
  readonly reportProgress?: AnalysisExecutionInput["reportProgress"]
  readonly signal: AbortSignal
  readonly analysisExecutor: AnalyzerAnalysisExecutor
}

export type RunAnalyzeRequest = (
  options: RunAnalyzeRequestInput
) => Promise<AnalyzeRequestResult>

const internalErrorClassification: ClassifiedAnalyzeError = {
  status: 500,
  code: "INTERNAL_ERROR",
  message: "Internal Server Error",
  retryable: false,
  severity: "ERROR",
  errorClass: "ANALYZER_INTERNAL_ERROR",
}

export const classifyAnalyzerFailure = Match.typeTags<
  AnalyzerFailure,
  ClassifiedAnalyzeError
>()({
  CpuBudgetExceededError: () => ({
    status: 503,
    code: "CPU_BUDGET_EXCEEDED",
    message:
      "Analysis exceeded the configured CPU budget. Retry with a smaller or simpler source.",
    retryable: true,
    severity: "ERROR",
    errorClass: "CPU_LIMIT_EXCEEDED",
  }),
  RateLimitedError: (failure) => ({
    status: 429,
    code: "RATE_LIMITED",
    message: failure.message,
    retryable: true,
    severity: "WARNING",
    errorClass: "ANALYZE_RATE_LIMITED",
  }),
  ValidationFailureError: (failure) => ({
    status: 400,
    code: "VALIDATION_FAILED",
    message: failure.message,
    retryable: false,
    severity: "WARNING",
    errorClass: "ANALYZE_VALIDATION_FAILED",
  }),
  UpstreamFetchError: () => ({
    status: 502,
    code: "UPSTREAM_FETCH_FAILED",
    message: "Unable to retrieve the media source.",
    retryable: true,
    severity: "ERROR",
    errorClass: "UPSTREAM_FETCH_FAILED",
  }),
})

export const classifyAnalyzeError = (
  cause: unknown,
  logContext: AnalyzeLogContext,
  setLogContextValue: SetLogContextValue
): ClassifiedAnalyzeError => {
  const normalizedError = unknownToError(cause)
  const diagnosticsError = cause instanceof DiagnosticsError ? cause : undefined
  const analyzerFailure = diagnosticsError?.cause ?? cause

  const classification = isAnalyzerFailure(analyzerFailure)
    ? classifyAnalyzerFailure(analyzerFailure)
    : internalErrorClassification

  if (diagnosticsError) {
    setLogContextValue(logContext, "diagnostics", diagnosticsError.diagnostics)
  }

  logContext.errorClass = classification.errorClass

  setLogContextValue(logContext, "error", {
    code: classification.code,
    message: classification.message,
    details: normalizedError.stack ?? "Unknown error",
  })

  return classification
}

export const createBufferedSuccessResponse = async (options: {
  context: AnalyzerContext
  requestState: AnalyzeRequestState
  url: string
  formats: AnalysisExecutionInput["formats"]
  cpuBudgetMs: number
  analysisExecutor: AnalyzerAnalysisExecutor
  runAnalyzeRequest: RunAnalyzeRequest
}): Promise<Response> => {
  const result = await options.runAnalyzeRequest({
    url: options.url,
    formats: options.formats,
    cpuBudgetMs: options.cpuBudgetMs,
    logContext: options.requestState.context,
    signal: options.context.req.raw.signal,
    analysisExecutor: options.analysisExecutor,
  })

  const responsePayload = {
    success: true as const,
    requestId: options.requestState.requestId,
    fileSize: result.fileSize,
    results: result.results,
    diagnostics: result.diagnostics,
  } satisfies AnalyzerRpcSuccessResponse

  return options.context.json(responsePayload)
}

export const createBufferedErrorResponse = (options: {
  context: AnalyzerContext
  state: AnalyzeRequestState
  cause: unknown
  setLogContextValue: SetLogContextValue
}): Response => {
  const classified = classifyAnalyzeError(
    options.cause,
    options.state.context,
    options.setLogContextValue
  )

  options.state.setStatus(classified.status)
  options.state.setSeverity(classified.severity)

  return options.context.json(
    {
      success: false as const,
      requestId: options.state.requestId,
      error: {
        code: classified.code,
        message: classified.message,
        retryable: classified.retryable,
      },
    },
    classified.status
  )
}
