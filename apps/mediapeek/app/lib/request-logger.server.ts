import { createEvlogLoggerConfig } from "@mediapeek/shared/evlog"
import { Schema } from "effect"
import { createRequestLogger, initLogger, type AuditableLogger } from "evlog"
import { evlog, loggerContext } from "evlog/react-router"
import type { MiddlewareFunction, RouterContext } from "react-router"

export interface RequestLoggerHandle {
  readonly logger: AuditableLogger
  readonly managed: boolean
}

export interface RequestContextProvider {
  get<T>(context: RouterContext<T>): T
}

initLogger(createEvlogLoggerConfig("mediapeek"))

export const requestLoggerMiddleware: MiddlewareFunction<Response> = evlog({
  include: ["/api/analyze"],
})

const getFallbackRequestId = (request: Request) =>
  request.headers.get("x-request-id")?.trim() ||
  request.headers.get("cf-ray") ||
  crypto.randomUUID()

const createFallbackRequestLogger = (
  request: Request
): RequestLoggerHandle => ({
  logger: createRequestLogger({
    method: request.method,
    path: new URL(request.url).pathname,
    requestId: getFallbackRequestId(request),
  }),
  managed: false,
})

export const getRequestIdFromLogger = (
  request: Request,
  logger: AuditableLogger
) => {
  const { requestId } = logger.getContext()

  if (Schema.is(Schema.String)(requestId) && requestId.length > 0) {
    return requestId
  }

  return getFallbackRequestId(request)
}

export const getRequestLogger = (
  context: RequestContextProvider,
  request: Request
): RequestLoggerHandle => {
  try {
    const logger = context.get(loggerContext)

    if (logger) {
      return { logger, managed: true }
    }
  } catch {
    return createFallbackRequestLogger(request)
  }

  return createFallbackRequestLogger(request)
}

export const finishFallbackRequestLogger = (
  handle: RequestLoggerHandle,
  status: number,
  error?: Error
) => {
  if (handle.managed) {
    return
  }

  if (error) {
    handle.logger.error(error)
  }

  handle.logger.emit({ status })
}
