import { sValidator } from "@hono/standard-validator"
import { ANALYZE_PROGRESS_STREAM_CONTENT_TYPE } from "@mediapeek/shared/analyze-progress"
import { createEvlogLoggerConfig } from "@mediapeek/shared/evlog"
import { redactSensitiveUrl } from "@mediapeek/shared/log-redaction"
import { getRequestId } from "@mediapeek/shared/request-id"
import {
  createRequestLogState,
  type RequestLogState,
} from "@mediapeek/shared/request-log-state"
import { resolveRuntimeConfig } from "@mediapeek/shared/runtime-config"
import { Result, Schema } from "effect"
import { initWorkersLogger } from "evlog/workers"
import { Hono } from "hono"

import { analyzeSchema, type AnalyzeInput } from "./lib/schemas"
import { executeAnalysis } from "./services/analysis-execution.server"
import {
  createBufferedErrorResponse,
  createBufferedSuccessResponse,
  type AnalyzeLogActions,
  type AnalyzeLogContext,
  type AnalyzeRequestState,
  type AnalyzerAnalysisExecutor,
  type AnalyzerContext,
  type RunAnalyzeRequest,
  type SetLogContextValue,
} from "./services/analyze-responses.server"
import { DEFAULT_ANALYSIS_CPU_BUDGET_MS } from "./services/mediainfo.server"
import { createProgressResponse } from "./services/progress-stream.server"
import {
  requestLogging,
  type AnalyzerRequestLoggingEnvironment,
} from "./services/request-logging.server"

export { classifyAnalyzerError } from "./services/analyze-responses.server"

export type { AnalyzerAnalysisExecutor } from "./services/analyze-responses.server"

export interface AnalyzerDependencies {
  readonly executeAnalysis: AnalyzerAnalysisExecutor
}

interface AnalyzerAuthFailure {
  status: 401 | 403
  code: "AUTH_REQUIRED" | "AUTH_INVALID"
  message: string
  errorClass: "ANALYZER_AUTH_REQUIRED" | "ANALYZER_AUTH_INVALID"
}

const defaultAnalyzerDependencies: AnalyzerDependencies = {
  executeAnalysis,
}

const MIN_ANALYSIS_CPU_BUDGET_MS = 5_000
const MAX_ANALYSIS_CPU_BUDGET_MS = 29_000

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

const setLogContextValue: SetLogContextValue = (context, key, cause) => {
  const decodedValue = Schema.decodeUnknownResult(Schema.Json)(cause)

  if (Result.isSuccess(decodedValue)) {
    context[key] = decodedValue.success
  }
}

const runAnalyzeRequest: RunAnalyzeRequest = async (options) => {
  const result = await options.analysisExecutor({
    url: options.url,
    formats: options.formats,
    cpuBudgetMs: options.cpuBudgetMs,
    reportProgress: options.reportProgress,
    signal: options.signal,
  })

  setLogContextValue(options.logContext, "fetch", result.diagnostics.fetch)
  setLogContextValue(
    options.logContext,
    "analysis",
    result.diagnostics.analysis
  )

  if (result.fileSize !== undefined) {
    options.logContext.fileSize = result.fileSize
  }

  options.logContext.filename = result.resolvedFilename
  options.logContext.filenameSource = result.resolvedFilenameSource
  options.logContext.cpuBudgetRemainingMs = result.cpuBudgetRemainingMs

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
  const initialContext: AnalyzeLogContext = { request_id: requestId }
  const requestLogState = createRequestLogState({ requestId, initialContext })
  const clientIp = request.headers.get("CF-Connecting-IP")
  const userAgent = request.headers.get("User-Agent")
  const annotations: Partial<AnalyzeLogContext> = {}

  if (clientIp) {
    annotations.client_ip = clientIp
  }

  if (userAgent) {
    annotations.user_agent = userAgent
  }

  requestLogState.annotate(annotations)

  const log = createLogActions(context)

  return {
    ...requestLogState,
    log,
    get status() {
      return requestLogState.status
    },
    get severity() {
      return requestLogState.severity
    },
    finalize: () => finalizeRequestLog(requestLogState, log),
  }
}

const finalizeRequestLog = (
  state: RequestLogState<AnalyzeLogContext>,
  log: AnalyzeLogActions
): void => {
  state.finalize(({ context, severity }) => {
    log.write(context)

    if (severity === "ERROR") {
      log.setError()
    }

    if (severity === "WARNING") {
      log.setWarning()
    }
  })
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
  state.setStatus(failure.status)
  state.setSeverity("WARNING")
  state.context.errorClass = failure.errorClass
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
  requestState.context.cpuBudgetMs = cpuBudgetMs

  const { url, format } = input
  requestState.context.target_url = redactSensitiveUrl(url)

  if (wantsProgressStream(context.req.raw)) {
    return createProgressResponse({
      context,
      requestState,
      url,
      formats: format,
      cpuBudgetMs,
      analysisExecutor: dependencies.executeAnalysis,
      runAnalyzeRequest,
      setLogContextValue,
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
      runAnalyzeRequest,
    })
  } catch (error) {
    return createBufferedErrorResponse({
      context,
      state: requestState,
      cause: error,
      setLogContextValue,
    })
  } finally {
    requestState.finalize()
  }
}

initWorkersLogger(
  createEvlogLoggerConfig(
    "mediapeek-analyzer",
    resolveRuntimeConfig(process.env)
  )
)

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
