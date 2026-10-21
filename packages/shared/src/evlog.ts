import type { LoggerConfig } from "evlog"

import { sensitiveQueryPattern } from "./log-redaction"
import type { RuntimeConfig } from "./runtime-config"

export const createEvlogLoggerConfig = (
  service: string,
  config: RuntimeConfig
): LoggerConfig => ({
  env: { service },
  stringify: false,
  sampling: {
    rates: {
      info: config.logForceAllRequests
        ? 100
        : Math.round(config.logSampleRate * 100),
    },
    keep: [{ duration: config.logSlowRequestMs }, { status: 400 }],
  },
  redact: {
    paths: [
      "**.access_token",
      "**.apiKey",
      "**.api_key",
      "**.authorization",
      "**.cookie",
      "**.password",
      "**.secret",
      "**.signature",
      "**.sig",
      "**.token",
      "**.turnstileToken",
    ],
    patterns: [sensitiveQueryPattern],
  },
})
