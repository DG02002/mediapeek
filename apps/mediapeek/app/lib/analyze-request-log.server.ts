import {
  createRequestLogState,
  type RequestLogState,
} from "@mediapeek/shared/request-log-state"
import type { RuntimeConfig } from "@mediapeek/shared/runtime-config"

import { type LogContext } from "~/lib/logger.server"
import {
  finishFallbackRequestLogger,
  getRequestIdFromLogger,
  getRequestLogger,
} from "~/lib/request-logger.server"

type AnalyzeLogContext = NonNullable<LogContext["customContext"]>

export interface AnalyzeExecution {
  readonly state: RequestLogState<AnalyzeLogContext>
  readonly logContext: LogContext
  readonly requestLoggerHandle: ReturnType<typeof getRequestLogger>
  readonly startTime: number
}

export const createExecution = (input: {
  readonly request: Request
  readonly runtimeConfig: RuntimeConfig
}): AnalyzeExecution => {
  const { request, runtimeConfig } = input
  const startTime = performance.now()
  const requestLoggerHandle = getRequestLogger(request)
  const requestId = getRequestIdFromLogger(request, requestLoggerHandle.logger)
  const url = new URL(request.url)

  const customContext: AnalyzeLogContext = {}

  const state = createRequestLogState({
    requestId,
    initialContext: customContext,
  })

  const logContext: LogContext = {
    requestId,
    runtimeConfig,
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

  return { state, logContext, requestLoggerHandle, startTime }
}

export const finalizeAnalyzeRequest = (
  execution: AnalyzeExecution,
  error?: Error
) => {
  const { state, logContext, requestLoggerHandle, startTime } = execution

  state.finalize(({ status, severity, context }) => {
    let outcome: "success" | "error" | "cancelled"

    if (context.stream_outcome === "cancelled") {
      outcome = "cancelled"
    } else if (status < 400) {
      outcome = "success"
    } else {
      outcome = "error"
    }

    if (logContext.httpRequest) {
      logContext.httpRequest.status = status
      logContext.httpRequest.latency =
        String((performance.now() - startTime) / 1000) + "s"
    }

    requestLoggerHandle.logger.set({
      ...context,
      outcome,
      severity: severity.toLowerCase(),
      durationMs: performance.now() - startTime,
    })

    finishFallbackRequestLogger(requestLoggerHandle, status, error)
  })
}
