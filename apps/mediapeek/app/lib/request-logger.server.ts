import { createEvlogLoggerConfig } from "@mediapeek/shared/evlog"
import { Schema } from "effect"
import { createRequestLogger, initLogger, type AuditableLogger } from "evlog"
import { withEvlog, type WorkerExecutionContext } from "evlog/workers"

import { DEVTOOLS_WELL_KNOWN_PATH } from "~/constants"

export interface RequestLoggerHandle {
  readonly logger: AuditableLogger
}

initLogger(createEvlogLoggerConfig("mediapeek"))

// The analyze route emits richer diagnostics through finalizeAnalyzeRequest.
const UNLOGGED_PATH_PATTERNS = [
  "/resource/analyze",
  "/healthz",
  "/robots.txt",
  DEVTOOLS_WELL_KNOWN_PATH,
  "/_build/**",
  "/badges/**",
  "/brand/**",
  "/wasm/**",
  "/**.png",
  "/**.ico",
  "/**.svg",
  "/**.webp",
  "/**.wasm",
  "/demo.json",
  "/test-badges.html",
]

export const withRequestLogging = <TEnvironment>(
  handler: (
    request: Request,
    environment: TEnvironment,
    context: WorkerExecutionContext
  ) => Response | Promise<Response>
) => withEvlog(handler, { exclude: UNLOGGED_PATH_PATTERNS })

const getFallbackRequestId = (request: Request) =>
  request.headers.get("x-request-id")?.trim() ||
  request.headers.get("cf-ray") ||
  crypto.randomUUID()

export const getRequestLogger = (request: Request): RequestLoggerHandle => ({
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
