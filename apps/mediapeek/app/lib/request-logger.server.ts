import { createEvlogLoggerConfig } from "@mediapeek/shared/evlog"
import { Schema } from "effect"
import { createRequestLogger, initLogger, type AuditableLogger } from "evlog"

export interface RequestLoggerHandle {
  readonly logger: AuditableLogger
}

initLogger(createEvlogLoggerConfig("mediapeek"))

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

export const getRequestLogger = createFallbackRequestLogger

export const finishFallbackRequestLogger = (
  handle: RequestLoggerHandle,
  status: number,
  error?: Error
) => {
  if (error) {
    handle.logger.error(error)
  }

  handle.logger.emit({ status })
}
