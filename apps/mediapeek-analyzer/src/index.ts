import { sValidator } from "@hono/standard-validator"
import type {
  AnalyzeErrorCode,
  AnalyzerRpcSuccessResponse,
} from "@mediapeek/shared/analyze-contract"
import {
  ANALYZE_PROGRESS_STREAM_CONTENT_TYPE,
  encodeAnalyzeStreamEvent,
  type AnalyzeProgressReporter,
} from "@mediapeek/shared/analyze-progress"
import { createEvlogLoggerConfig } from "@mediapeek/shared/evlog"
import { redactSensitiveUrl } from "@mediapeek/shared/log-redaction"
import { Result, Schema } from "effect"
import { initWorkersLogger } from "evlog/workers"
import { Hono, type Context } from "hono"

import { unknownToError } from "./lib/error"
import { AnalyzerError, DiagnosticsError } from "./lib/error-utils"
import { analyzeSchema, type AnalyzeInput } from "./lib/schemas"
import {
  executeAnalysis,
  type AnalysisExecutionInput,
  type AnalysisExecutionResult,
} from "./services/analysis-execution.server"
import { DEFAULT_ANALYSIS_CPU_BUDGET_MS } from "./services/mediainfo.server"
import {
  requestLogging,
  type AnalyzerRequestLoggingEnvironment,
} from "./services/request-logging.server"

export interface AnalyzerAnalysisExecutor {
  (input: AnalysisExecutionInput): Promise<AnalysisExecutionResult>
}

export interface AnalyzerDependencies {
  readonly executeAnalysis: AnalyzerAnalysisExecutor
}

type AnalyzerContext = Context<AnalyzerRequestLoggingEnvironment>

interface AnalyzeLogContext {
  [key: string]: typeof Schema.Json.Type
}

type RequestSeverity = "INFO" | "WARNING" | "ERROR"

type AnalyzeStatus = 200 | 400 | 401 | 403 | 429 | 500 | 502 | 503

interface ClassifiedAnalyzeError {
  status: AnalyzeStatus
  code: AnalyzeErrorCode
  message: string
  retryable: boolean
  severity: RequestSeverity
}

interface AnalyzeLogActions {
  write: (context: AnalyzeLogContext) => void
  setError: () => void
  setWarning: () => void
}

interface AnalyzeRequestState {
  requestId: string
  customContext: AnalyzeLogContext
  log: AnalyzeLogActions
  status: AnalyzeStatus
  severity: RequestSeverity
  finalize: () => void
}

interface AnalyzerAuthFailure {
  status: 401 | 403
  code: "AUTH_REQUIRED" | "AUTH_INVALID"
  message: string
  errorClass: "ANALYZER_AUTH_REQUIRED" | "ANALYZER_AUTH_INVALID"
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

interface ProgressStreamState extends AnalyzeRequestState {
  controller?: ReadableStreamDefaultController<Uint8Array>
  encoder: TextEncoder
  signal: AbortSignal
  finished: boolean
}

const defaultAnalyzerDependencies: AnalyzerDependencies = {
  executeAnalysis,
}

const MIN_ANALYSIS_CPU_BUDGET_MS = 5_000
const MAX_ANALYSIS_CPU_BUDGET_MS = 29_000
const INTERNAL_REQUEST_ID_HEADER = "x-mediapeek-request-id"
const VALID_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/

const getRequestId = (request: Request): string => {
  const requestId = request.headers.get("x-request-id")?.trim()

  if (requestId && VALID_REQUEST_ID.test(requestId)) {
    return requestId
  }

  const propagated = request.headers.get(INTERNAL_REQUEST_ID_HEADER)?.trim()

  if (propagated && VALID_REQUEST_ID.test(propagated)) {
    return propagated
  }

  return request.headers.get("cf-ray") ?? crypto.randomUUID()
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

const resolveCpuBudgetMs = (rawValue?: string): number => {
  const parsed = Number.parseInt(rawValue ?? "", 10)

  if (Number.isNaN(parsed)) {
    return DEFAULT_ANALYSIS_CPU_BUDGET_MS
  }

  return Math.min(
    MAX_ANALYSIS_CPU_BUDGET_MS,
    Math.max(MIN_ANALYSIS_CPU_BUDGET_MS, parsed)
  )
}

const wantsProgressStream = (request: Request): boolean =>
  request.headers
    .get("accept")
    ?.toLowerCase()
    .includes(ANALYZE_PROGRESS_STREAM_CONTENT_TYPE) ?? false

const setLogContextValue = (
  context: AnalyzeLogContext,
  key: string,
  cause: unknown
): void => {
  const decodedValue = Schema.decodeUnknownResult(Schema.Json)(cause)

  if (Result.isSuccess(decodedValue)) {
    context[key] = decodedValue.success
  }
}

const createLogActions = (context: AnalyzerContext): AnalyzeLogActions => {
  const logger = context.get("log")

  return {
    write: (logContext) => logger.set(logContext),
    setError: () => logger.setLevel("error"),
    setWarning: () => logger.setLevel("warn"),
  }
}

const createAnalyzeRequestState = (
  context: AnalyzerContext
): AnalyzeRequestState => {
  const request = context.req.raw
  const requestId = getRequestId(request)
  const customContext: AnalyzeLogContext = { request_id: requestId }
  const clientIp = request.headers.get("CF-Connecting-IP")
  const userAgent = request.headers.get("User-Agent")

  if (clientIp) {
    customContext.client_ip = clientIp
  }

  if (userAgent) {
    customContext.user_agent = userAgent
  }

  const log = createLogActions(context)

  const state: AnalyzeRequestState = {
    requestId,
    customContext,
    log,
    status: 200,
    severity: "INFO",
    finalize: () => undefined,
  }

  state.finalize = () => finalizeRequestLog(state)

  return state
}

const finalizeRequestLog = (state: AnalyzeRequestState): void => {
  state.log.write(state.customContext)

  if (state.severity === "ERROR") {
    state.log.setError()
  }

  if (state.severity === "WARNING") {
    state.log.setWarning()
  }
}

const resolveAnalyzerAuthFailure = (
  request: Request,
  expectedApiKey?: string
): AnalyzerAuthFailure | null => {
  if (!expectedApiKey) {
    return null
  }

  const providedApiKey = getApiKeyFromRequest(request)

  if (!providedApiKey) {
    return {
      status: 401,
      code: "AUTH_REQUIRED",
      message: "Missing analyzer API key.",
      errorClass: "ANALYZER_AUTH_REQUIRED",
    }
  }

  if (providedApiKey !== expectedApiKey) {
    return {
      status: 403,
      code: "AUTH_INVALID",
      message: "Invalid analyzer API key.",
      errorClass: "ANALYZER_AUTH_INVALID",
    }
  }

  return null
}

const createAuthFailureResponse = (
  context: AnalyzerContext,
  state: AnalyzeRequestState,
  failure: AnalyzerAuthFailure
): Response => {
  state.status = failure.status
  state.severity = "WARNING"
  state.customContext.errorClass = failure.errorClass
  state.finalize()

  return context.json(
    {
      success: false as const,
      requestId: state.requestId,
      error: {
        code: failure.code,
        message: failure.message,
        retryable: false,
      },
    },
    failure.status
  )
}

const findAnalyzerError = (cause: unknown): AnalyzerError | undefined => {
  let current = cause

  while (current instanceof Error) {
    if (current instanceof AnalyzerError) {
      return current
    }

    current = current.cause
  }

  return undefined
}

const findDiagnosticsError = (
  cause: unknown
): DiagnosticsError<unknown> | undefined => {
  let current = cause

  while (current instanceof Error) {
    if (current instanceof DiagnosticsError) {
      return current
    }

    current = current.cause
  }

  return undefined
}

const classifyAnalyzerError = (
  error: AnalyzerError,
  customContext: AnalyzeLogContext
): ClassifiedAnalyzeError => {
  switch (error.kind) {
    case "cpu-budget":
      customContext.errorClass = "CPU_LIMIT_EXCEEDED"

      return {
        status: 503,
        code: "CPU_BUDGET_EXCEEDED",
        message:
          "Analysis exceeded the configured CPU budget. Retry with a smaller or simpler source.",
        retryable: true,
        severity: "ERROR",
      }
    case "rate-limited":
      customContext.errorClass = "ANALYZE_RATE_LIMITED"

      return {
        status: 429,
        code: "RATE_LIMITED",
        message: error.message,
        retryable: true,
        severity: "WARNING",
      }
    case "validation":
      customContext.errorClass = "ANALYZE_VALIDATION_FAILED"

      return {
        status: 400,
        code: "VALIDATION_FAILED",
        message: error.message,
        retryable: false,
        severity: "WARNING",
      }
    case "upstream-fetch":
      customContext.errorClass = "UPSTREAM_FETCH_FAILED"

      return {
        status: 502,
        code: "UPSTREAM_FETCH_FAILED",
        message: "Unable to retrieve the media source.",
        retryable: true,
        severity: "ERROR",
      }
    default:
      customContext.errorClass = "ANALYZER_INTERNAL_ERROR"

      return {
        status: 500,
        code: "INTERNAL_ERROR",
        message: "Internal Server Error",
        retryable: false,
        severity: "ERROR",
      }
  }
}

const classifyAnalyzeError = (
  cause: unknown,
  customContext: AnalyzeLogContext
): ClassifiedAnalyzeError => {
  const normalizedError = unknownToError(cause)
  const analyzerError = findAnalyzerError(cause)

  let classification: ClassifiedAnalyzeError

  if (analyzerError) {
    classification = classifyAnalyzerError(analyzerError, customContext)
  } else {
    classification = {
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Internal Server Error",
      retryable: false,
      severity: "ERROR",
    }
  }

  const diagnosticsError = findDiagnosticsError(cause)

  if (diagnosticsError) {
    setLogContextValue(
      customContext,
      "diagnostics",
      diagnosticsError.diagnostics
    )
  }

  setLogContextValue(customContext, "error", {
    code: classification.code,
    message: classification.message,
    details: normalizedError.stack ?? "Unknown error",
  })

  return classification
}

const runAnalyzeRequest = async (options: {
  url: string
  formats: AnalysisExecutionInput["formats"]
  cpuBudgetMs: number
  customContext: AnalyzeLogContext
  reportProgress?: AnalyzeProgressReporter
  signal: AbortSignal
  analysisExecutor: AnalyzerAnalysisExecutor
}): Promise<AnalyzeRequestResult> => {
  const result = await options.analysisExecutor({
    url: options.url,
    formats: options.formats,
    cpuBudgetMs: options.cpuBudgetMs,
    reportProgress: options.reportProgress,
    signal: options.signal,
  })

  setLogContextValue(options.customContext, "fetch", result.diagnostics.fetch)
  setLogContextValue(
    options.customContext,
    "analysis",
    result.diagnostics.analysis
  )

  if (result.fileSize !== undefined) {
    options.customContext.fileSize = result.fileSize
  }

  options.customContext.filename = result.resolvedFilename
  options.customContext.filenameSource = result.resolvedFilenameSource
  options.customContext.cpuBudgetRemainingMs = result.cpuBudgetRemainingMs

  return {
    fileSize: result.fileSize,
    results: result.results,
    diagnostics: {
      ...result.diagnostics,
      analysis: {
        ...result.diagnostics.analysis,
        resolvedFilename: result.resolvedFilename,
        resolvedFilenameSource: result.resolvedFilenameSource,
      },
    },
  }
}

const createProgressReporter =
  (state: ProgressStreamState): AnalyzeProgressReporter =>
  (stage, title, message) => {
    if (state.finished || state.signal.aborted) {
      return
    }

    const { controller } = state

    if (!controller) {
      return
    }

    controller.enqueue(
      state.encoder.encode(
        encodeAnalyzeStreamEvent({
          type: "progress",
          requestId: state.requestId,
          stage,
          title,
          message,
        })
      )
    )
  }

const closeProgressStream = (state: ProgressStreamState): void => {
  state.finished = true
  state.controller?.close()
}

const writeProgressSuccess = (
  state: ProgressStreamState,
  results: Record<string, string>
): void => {
  if (state.finished || state.signal.aborted) {
    return
  }

  const { controller } = state

  if (!controller) {
    return
  }

  controller.enqueue(
    state.encoder.encode(
      encodeAnalyzeStreamEvent({
        type: "success",
        requestId: state.requestId,
        results,
      })
    )
  )

  closeProgressStream(state)
}

const writeProgressError = (
  state: ProgressStreamState,
  cause: unknown
): void => {
  const classified = classifyAnalyzeError(cause, state.customContext)
  state.status = classified.status
  state.severity = classified.severity

  state.controller?.enqueue(
    state.encoder.encode(
      encodeAnalyzeStreamEvent({
        type: "error",
        requestId: state.requestId,
        error: {
          code: classified.code,
          message: classified.message,
          retryable: classified.retryable,
        },
      })
    )
  )

  closeProgressStream(state)
}

const finalizeProgressStream = (state: ProgressStreamState): void => {
  state.customContext.analysis_status = state.status
  state.log.write(state.customContext)

  if (state.severity === "ERROR") {
    state.log.setError()
  }

  if (state.severity === "WARNING") {
    state.log.setWarning()
  }
}

const runProgressAnalysis = async (options: {
  state: ProgressStreamState
  url: string
  formats: AnalysisExecutionInput["formats"]
  cpuBudgetMs: number
  analysisExecutor: AnalyzerAnalysisExecutor
}): Promise<void> => {
  const reportProgress = createProgressReporter(options.state)

  try {
    const result = await runAnalyzeRequest({
      url: options.url,
      formats: options.formats,
      cpuBudgetMs: options.cpuBudgetMs,
      customContext: options.state.customContext,
      reportProgress,
      signal: options.state.signal,
      analysisExecutor: options.analysisExecutor,
    })

    writeProgressSuccess(options.state, result.results)
  } catch (error) {
    if (options.state.finished) {
      return
    }

    if (options.state.signal.aborted) {
      options.state.finished = true
      options.state.controller?.error(options.state.signal.reason)

      return
    }

    writeProgressError(options.state, error)
  } finally {
    finalizeProgressStream(options.state)
  }
}

const createProgressResponse = (options: {
  context: AnalyzerContext
  requestState: AnalyzeRequestState
  url: string
  formats: AnalysisExecutionInput["formats"]
  cpuBudgetMs: number
  analysisExecutor: AnalyzerAnalysisExecutor
}): Response => {
  const streamAbortController = new AbortController()

  const signal = AbortSignal.any([
    options.context.req.raw.signal,
    streamAbortController.signal,
  ])

  const streamState: ProgressStreamState = {
    ...options.requestState,
    controller: undefined,
    encoder: new TextEncoder(),
    signal,
    finished: false,
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamState.controller = controller

      void runProgressAnalysis({
        state: streamState,
        url: options.url,
        formats: options.formats,
        cpuBudgetMs: options.cpuBudgetMs,
        analysisExecutor: options.analysisExecutor,
      })
    },
    cancel() {
      streamState.finished = true
      streamAbortController.abort(
        new DOMException("Analysis stream cancelled.", "AbortError")
      )
    },
  })

  return new Response(stream, {
    headers: {
      "content-type": ANALYZE_PROGRESS_STREAM_CONTENT_TYPE,
      "cache-control": "no-store",
    },
  })
}

const createBufferedSuccessResponse = async (options: {
  context: AnalyzerContext
  requestState: AnalyzeRequestState
  url: string
  formats: AnalysisExecutionInput["formats"]
  cpuBudgetMs: number
  analysisExecutor: AnalyzerAnalysisExecutor
}): Promise<Response> => {
  const result = await runAnalyzeRequest({
    url: options.url,
    formats: options.formats,
    cpuBudgetMs: options.cpuBudgetMs,
    customContext: options.requestState.customContext,
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

const createBufferedErrorResponse = (
  context: AnalyzerContext,
  state: AnalyzeRequestState,
  cause: unknown
): Response => {
  const classified = classifyAnalyzeError(cause, state.customContext)
  state.status = classified.status
  state.severity = classified.severity

  return context.json(
    {
      success: false as const,
      requestId: state.requestId,
      error: {
        code: classified.code,
        message: classified.message,
        retryable: classified.retryable,
      },
    },
    classified.status
  )
}

const handleAnalyzeRequest = async (
  context: AnalyzerContext,
  input: AnalyzeInput,
  dependencies: AnalyzerDependencies
): Promise<Response> => {
  const requestState = createAnalyzeRequestState(context)
  const expectedApiKey = context.env.ANALYZE_API_KEY?.trim()

  const authFailure = resolveAnalyzerAuthFailure(
    context.req.raw,
    expectedApiKey
  )

  if (authFailure) {
    return createAuthFailureResponse(context, requestState, authFailure)
  }

  const cpuBudgetMs = resolveCpuBudgetMs(context.env.ANALYZE_CPU_BUDGET_MS)
  requestState.customContext.cpuBudgetMs = cpuBudgetMs

  const { url, format } = input
  requestState.customContext.target_url = redactSensitiveUrl(url)

  if (wantsProgressStream(context.req.raw)) {
    return createProgressResponse({
      context,
      requestState,
      url,
      formats: format,
      cpuBudgetMs,
      analysisExecutor: dependencies.executeAnalysis,
    })
  }

  try {
    return await createBufferedSuccessResponse({
      context,
      requestState,
      url,
      formats: format,
      cpuBudgetMs,
      analysisExecutor: dependencies.executeAnalysis,
    })
  } catch (error) {
    return createBufferedErrorResponse(context, requestState, error)
  } finally {
    requestState.finalize()
  }
}

initWorkersLogger(createEvlogLoggerConfig("mediapeek-analyzer"))

export const createAnalyzerApp = (
  dependencies: AnalyzerDependencies = defaultAnalyzerDependencies
) => {
  const app = new Hono<AnalyzerRequestLoggingEnvironment>()

  app.use("*", requestLogging())

  app.get("/", (context) => context.text("MediaPeek Analyzer API"))

  const routes = app.post(
    "/analyze",
    sValidator("json", analyzeSchema),
    (context) =>
      handleAnalyzeRequest(context, context.req.valid("json"), dependencies)
  )

  return app.route("/", routes)
}

export const route = createAnalyzerApp()

export type AppType = typeof route

export default route
