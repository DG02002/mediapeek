import type { SensitiveLogObject } from "@mediapeek/shared/log-redaction"
import {
  createRequestLogState,
  type RequestLogState,
} from "@mediapeek/shared/request-log-state"

import {
  finishFallbackRequestLogger,
  getRequestIdFromLogger,
  getRequestLogger,
} from "~/lib/request-logger.server"

type AnalyzeLogContext = SensitiveLogObject

export interface AnalyzeExecution {
  readonly state: RequestLogState<AnalyzeLogContext>
  readonly requestLoggerHandle: ReturnType<typeof getRequestLogger>
  readonly startTime: number
}

export const createExecution = (input: {
  readonly request: Request
}): AnalyzeExecution => {
  const { request } = input
  const startTime = performance.now()
  const requestLoggerHandle = getRequestLogger(request)
  const requestId = getRequestIdFromLogger(request, requestLoggerHandle.logger)

  const customContext: AnalyzeLogContext = {
    user_agent: request.headers.get("User-Agent") ?? undefined,
    client_ip: request.headers.get("CF-Connecting-IP") ?? undefined,
  }

  const state = createRequestLogState({
    requestId,
    initialContext: customContext,
  })

  return { state, requestLoggerHandle, startTime }
}

export const finalizeAnalyzeRequest = (
  execution: AnalyzeExecution,
  error?: Error
) => {
  const { state, requestLoggerHandle, startTime } = execution

  state.finalize(({ status, severity, context }) => {
    let outcome: "success" | "error" | "cancelled"

    if (context.stream_outcome === "cancelled") {
      outcome = "cancelled"
    } else if (status < 400) {
      outcome = "success"
    } else {
      outcome = "error"
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
