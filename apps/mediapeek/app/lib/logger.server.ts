import { AsyncLocalStorage } from "node:async_hooks"

import type { SensitiveLogObject } from "@mediapeek/shared/log-redaction"
import type { RuntimeConfig } from "@mediapeek/shared/runtime-config"

type HttpRequestLog = SensitiveLogObject & {
  requestMethod: string
  requestUrl: string
  status: number
  remoteIp?: string
  userAgent?: string
  latency?: string
}

export interface LogContext {
  requestId: string
  runtimeConfig?: RuntimeConfig
  httpRequest?: HttpRequestLog
  customContext?: SensitiveLogObject
}

export const requestStorage = new AsyncLocalStorage<LogContext>()
