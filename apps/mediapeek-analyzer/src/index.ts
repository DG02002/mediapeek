import { sValidator } from "@hono/standard-validator"
import type { AnalyzeErrorCode } from "@mediapeek/shared/analyze-contract"
import {
  ANALYZE_PROGRESS_STREAM_CONTENT_TYPE,
  encodeAnalyzeStreamEvent,
  type AnalyzeProgressStage,
} from "@mediapeek/shared/analyze-progress"
import {
  redactSensitiveUrl,
  type SensitiveLogObject,
} from "@mediapeek/shared/log-redaction"
import { resolveRuntimeConfig } from "@mediapeek/shared/runtime-config"
import { Hono } from "hono"
import { z } from "zod"

import { log, type LogContext, requestStorage } from "./lib/logger.server"
import { analyzeSchema } from "./lib/schemas"
import { fetchMediaChunk } from "./services/media-fetch.server"
import {
  analyzeMediaBuffer,
  CpuBudgetExceededError,
  DEFAULT_ANALYSIS_CPU_BUDGET_MS,
} from "./services/mediainfo.server"
import { initTelemetry } from "./services/telemetry.server"

type Bindings = {
  ANALYZE_API_KEY?: string
  ANALYZE_CPU_BUDGET_MS?: string
  APP_ENV?: string
  LOG_SAMPLE_RATE?: string
  LOG_SLOW_REQUEST_MS?: string
  LOG_FORCE_ALL_REQUESTS?: string
}

const MIN_ANALYSIS_CPU_BUDGET_MS = 5_000
const MAX_ANALYSIS_CPU_BUDGET_MS = 29_000

initTelemetry()

const thrownErrorSchema = z.unknown().transform((value) => {
  if (value instanceof Error) {
    return value
  }

  return new Error(String(value))
})

const cloudflareRequestContextSchema = z.object({
  colo: z.string().optional(),
  country: z.string().optional(),
})

const getRequestId = (request: Request) =>
  request.headers.get("cf-ray") ?? crypto.randomUUID()

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

const resolveCpuBudgetMs = (rawValue?: string) => {
  const parsed = Number.parseInt(rawValue ?? "", 10)

  if (Number.isNaN(parsed)) {
    return DEFAULT_ANALYSIS_CPU_BUDGET_MS
  }

  return Math.min(
    MAX_ANALYSIS_CPU_BUDGET_MS,
    Math.max(MIN_ANALYSIS_CPU_BUDGET_MS, parsed)
  )
}

const isCpuLimitError = (error: Error) => {
  if (error instanceof CpuBudgetExceededError) {
    return true
  }

  return /cpu budget exceeded/i.test(error.message)
}

const isRateLimitedFetchError = (message: string) =>
  /rate-limited/i.test(message)

const isValidationFetchError = (message: string) =>
  /webpage, not a media file|provide a direct link|media file not found|access denied/i.test(
    message
  )

const wantsProgressStream = (request: Request) =>
  request.headers
    .get("accept")
    ?.toLowerCase()
    .includes(ANALYZE_PROGRESS_STREAM_CONTENT_TYPE) ?? false

type RequestSeverity = "INFO" | "WARNING" | "ERROR"

type AnalyzeHttpStatus = 400 | 429 | 500 | 502 | 503

type AnalyzeErrorClassification = {
  status: AnalyzeHttpStatus
  code: AnalyzeErrorCode
  message: string
  retryable: boolean
  severity: RequestSeverity
}

type AnalyzeProgressReporter = (
  stage: AnalyzeProgressStage,
  title: string,
  message: string
) => Promise<void> | void

type AnalyzeExecutionResult = {
  fileSize?: number
  results: Record<string, string>
  diagnostics: {
    fetch: Awaited<ReturnType<typeof fetchMediaChunk>>["diagnostics"]
    analysis: Awaited<ReturnType<typeof analyzeMediaBuffer>>["diagnostics"] & {
      resolvedFilename: string
      resolvedFilenameSource: string
    }
  }
}

const classifyCpuBudgetError = (): AnalyzeErrorClassification => ({
  status: 503,
  code: "CPU_BUDGET_EXCEEDED",
  message:
    "Analysis exceeded the configured CPU budget. Retry with a smaller or simpler source.",
  retryable: true,
  severity: "ERROR",
})

const classifyMessageError = (
  error: Error,
  customContext: SensitiveLogObject
): AnalyzeErrorClassification => {
  if (isRateLimitedFetchError(error.message)) {
    customContext.errorClass = "ANALYZE_RATE_LIMITED"

    return {
      status: 429,
      code: "RATE_LIMITED",
      message: error.message,
      retryable: true,
      severity: "WARNING",
    }
  }

  if (isValidationFetchError(error.message)) {
    customContext.errorClass = "ANALYZE_VALIDATION_FAILED"

    return {
      status: 400,
      code: "VALIDATION_FAILED",
      message: error.message,
      retryable: false,
      severity: "WARNING",
    }
  }

  if (/fetch stream|unable to access file/i.test(error.message)) {
    customContext.errorClass = "UPSTREAM_FETCH_FAILED"

    return {
      status: 502,
      code: "UPSTREAM_FETCH_FAILED",
      message: error.message,
      retryable: true,
      severity: "ERROR",
    }
  }

  customContext.errorClass = "ANALYZER_INTERNAL_ERROR"

  return {
    status: 500,
    code: "INTERNAL_ERROR",
    message: error.message,
    retryable: false,
    severity: "ERROR",
  }
}

const classifyAnalyzeError = (
  error: Error,
  customContext: SensitiveLogObject
): AnalyzeErrorClassification => {
  const classification = isCpuLimitError(error)
    ? classifyCpuBudgetError()
    : classifyMessageError(error, customContext)

  if (isCpuLimitError(error)) {
    customContext.errorClass = "CPU_LIMIT_EXCEEDED"
  }

  customContext.error = {
    code: classification.code,
    message: classification.message,
    details: error.stack,
  }

  return classification
}

const runAnalyzeRequest = async ({
  url,
  format,
  cpuBudgetMs,
  customContext,
  reportProgress,
}: {
  url: string
  format: string[]
  cpuBudgetMs: number
  customContext: SensitiveLogObject
  reportProgress?: AnalyzeProgressReporter
}): Promise<AnalyzeExecutionResult> => {
  await reportProgress?.(
    "request_received",
    "Analyzer Started",
    "The analyzer accepted the request and is beginning the source fetch."
  )

  const {
    buffer,
    byteSource,
    fileSize,
    filename,
    filenameSource,
    diagnostics: fetchDiag,
    archiveEntry,
  } = await fetchMediaChunk(url, undefined, reportProgress)

  customContext.fetch = { ...fetchDiag }
  customContext.fileSize = fileSize
  customContext.filename = fetchDiag.resolvedFilename ?? filename

  const {
    results,
    diagnostics: analysisDiag,
    resolvedFilename,
    resolvedFilenameSource,
  } = await analyzeMediaBuffer({
    fileBuffer: buffer,
    fileSize,
    filename,
    filenameSource,
    requestedFormats: format,
    cpuBudgetMs,
    archiveEntry,
    remoteReadChunk: byteSource?.readChunk,
    reportProgress,
  })

  customContext.analysis = { ...analysisDiag }
  customContext.filename = resolvedFilename
  customContext.filenameSource = resolvedFilenameSource
  customContext.cpuBudgetRemainingMs = Math.max(
    0,
    cpuBudgetMs - analysisDiag.totalAnalysisTimeMs
  )

  return {
    fileSize,
    results,
    diagnostics: {
      fetch: fetchDiag,
      analysis: {
        ...analysisDiag,
        resolvedFilename,
        resolvedFilenameSource,
      },
    },
  }
}

const attachCloudflareContext = (
  request: Request,
  customContext: SensitiveLogObject
) => {
  const parsedContext = cloudflareRequestContextSchema.safeParse(request.cf)

  if (parsedContext.success) {
    customContext.cloudflare = parsedContext.data
  }
}

type AuthFailure = {
  status: 401 | 403
  errorClass: string
  payload: {
    success: false
    requestId: string
    error: {
      code: "AUTH_REQUIRED" | "AUTH_INVALID"
      message: string
      retryable: false
    }
  }
}

const resolveAuthFailure = (
  request: Request,
  expectedApiKey: string | undefined,
  requestId: string
): AuthFailure | null => {
  if (!expectedApiKey) {
    return null
  }

  const providedApiKey = getApiKeyFromRequest(request)

  if (!providedApiKey) {
    return {
      status: 401,
      errorClass: "ANALYZER_AUTH_REQUIRED",
      payload: {
        success: false,
        requestId,
        error: {
          code: "AUTH_REQUIRED",
          message: "Missing analyzer API key.",
          retryable: false,
        },
      },
    }
  }

  if (providedApiKey !== expectedApiKey) {
    return {
      status: 403,
      errorClass: "ANALYZER_AUTH_INVALID",
      payload: {
        success: false,
        requestId,
        error: {
          code: "AUTH_INVALID",
          message: "Invalid analyzer API key.",
          retryable: false,
        },
      },
    }
  }

  return null
}

const writeRequestLog = (options: {
  initialContext: LogContext
  startTime: number
  status: number
  severity: RequestSeverity
}) => {
  const { initialContext, startTime, status, severity } = options

  if (initialContext.httpRequest) {
    initialContext.httpRequest.status = status
    initialContext.httpRequest.latency =
      String((performance.now() - startTime) / 1000) + "s"
  }

  log({
    severity,
    message: "Analyzer Request",
  })
}

const createProgressResponse = (options: {
  requestId: string
  startTime: number
  initialContext: LogContext
  url: string
  format: string[]
  cpuBudgetMs: number
  customContext: SensitiveLogObject
}): Response => {
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const reportProgress: AnalyzeProgressReporter = async (
        stage,
        title,
        message
      ) => {
        controller.enqueue(
          encoder.encode(
            encodeAnalyzeStreamEvent({
              type: "progress",
              requestId: options.requestId,
              stage,
              title,
              message,
            })
          )
        )
      }

      void (async () => {
        let classification: AnalyzeErrorClassification | undefined

        try {
          const result = await runAnalyzeRequest({
            url: options.url,
            format: options.format,
            cpuBudgetMs: options.cpuBudgetMs,
            customContext: options.customContext,
            reportProgress,
          })

          const event = encodeAnalyzeStreamEvent({
            type: "success",
            requestId: options.requestId,
            results: result.results,
          })

          controller.enqueue(encoder.encode(event))
          controller.close()
        } catch (caughtError) {
          const error = thrownErrorSchema.parse(caughtError)
          classification = classifyAnalyzeError(error, options.customContext)

          const event = encodeAnalyzeStreamEvent({
            type: "error",
            requestId: options.requestId,
            error: {
              code: classification.code,
              message: classification.message,
              retryable: classification.retryable,
            },
          })

          controller.enqueue(encoder.encode(event))
          controller.close()
        } finally {
          writeRequestLog({
            initialContext: options.initialContext,
            startTime: options.startTime,
            status: classification?.status ?? 200,
            severity: classification?.severity ?? "INFO",
          })
        }
      })()
    },
  })

  return new Response(stream, {
    headers: {
      "content-type": ANALYZE_PROGRESS_STREAM_CONTENT_TYPE,
      "cache-control": "no-store",
    },
  })
}

const app = new Hono<{ Bindings: Bindings }>()

// Health check
app.get("/", (c) => c.text("MediaPeek Analyzer API"))

// RPC Route
const routes = app.post(
  "/analyze",
  sValidator("json", analyzeSchema),
  async (c) => {
    const startTime = performance.now()
    const requestId = getRequestId(c.req.raw)
    const runtimeConfig = resolveRuntimeConfig(c.env)

    const initialContext: LogContext = {
      requestId,
      runtimeConfig,
      httpRequest: {
        requestMethod: c.req.method,
        requestUrl: c.req.path,
        status: 200,
        remoteIp: c.req.header("CF-Connecting-IP") ?? undefined,
        userAgent: c.req.header("User-Agent") ?? undefined,
        latency: "0s",
      },
      customContext: {},
    }

    const respondToRequest = async (options: {
      url: string
      format: string[]
      cpuBudgetMs: number
      customContext: SensitiveLogObject
    }) => {
      let shouldWriteLog = true
      let classification: AnalyzeErrorClassification | undefined

      const runOrStreamAnalysis = async () => {
        if (wantsProgressStream(c.req.raw)) {
          shouldWriteLog = false

          return createProgressResponse({
            requestId,
            startTime,
            initialContext,
            url: options.url,
            format: options.format,
            cpuBudgetMs: options.cpuBudgetMs,
            customContext: options.customContext,
          })
        }

        return runAnalyzeRequest(options)
      }

      try {
        const outcome = await runOrStreamAnalysis()

        if (outcome instanceof Response) {
          return outcome
        }

        const payload = {
          success: true,
          requestId,
          fileSize: outcome.fileSize,
          results: outcome.results,
          diagnostics: outcome.diagnostics,
        } satisfies {
          success: true
          requestId: string
          fileSize?: number
          results: Record<string, string>
          diagnostics: AnalyzeExecutionResult["diagnostics"]
        }

        return c.json(payload)
      } catch (caughtError) {
        const error = thrownErrorSchema.parse(caughtError)

        const errorClassification = classifyAnalyzeError(
          error,
          options.customContext
        )

        classification = errorClassification

        const payload = {
          success: false,
          requestId,
          error: {
            code: errorClassification.code,
            message: errorClassification.message,
            retryable: errorClassification.retryable,
          },
        } satisfies {
          success: false
          requestId: string
          error: {
            code: AnalyzeErrorCode
            message: string
            retryable: boolean
          }
        }

        return c.json(payload, errorClassification.status)
      } finally {
        if (shouldWriteLog) {
          writeRequestLog({
            initialContext,
            startTime,
            status: classification?.status ?? 200,
            severity: classification?.severity ?? "INFO",
          })
        }
      }
    }

    const handleRequest = async () => {
      const customContext =
        initialContext.customContext ?? (initialContext.customContext = {})

      attachCloudflareContext(c.req.raw, customContext)

      const authFailure = resolveAuthFailure(
        c.req.raw,
        c.env.ANALYZE_API_KEY?.trim(),
        requestId
      )

      if (authFailure) {
        customContext.errorClass = authFailure.errorClass

        return c.json(authFailure.payload, authFailure.status)
      }

      const cpuBudgetMs = resolveCpuBudgetMs(c.env.ANALYZE_CPU_BUDGET_MS)
      customContext.cpuBudgetMs = cpuBudgetMs
      const { url, format } = c.req.valid("json")
      customContext.targetUrl = redactSensitiveUrl(url)

      return respondToRequest({ url, format, cpuBudgetMs, customContext })
    }

    return requestStorage.run(initialContext, handleRequest)
  }
)

export const route = app.route("/", routes)

export type AppType = typeof route

export default app
