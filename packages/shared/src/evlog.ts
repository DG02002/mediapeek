import type { LoggerConfig } from "evlog"

import { DEFAULT_RUNTIME_CONFIG } from "./runtime-config"

const sensitiveQueryValuePattern =
  /\b(token|sig|signature|key|auth|authorization|expires|api_key|apikey|access_token|id_token|refresh_token|x-amz-[\w-]+|x-goog-[\w-]+)=([^&\s]+)/gi

export const createEvlogLoggerConfig = (service: string): LoggerConfig => ({
  env: { service },
  stringify: false,
  sampling: {
    rates: {
      info: DEFAULT_RUNTIME_CONFIG.logForceAllRequests
        ? 100
        : Math.round(DEFAULT_RUNTIME_CONFIG.logSampleRate * 100),
    },
    keep: [
      { duration: DEFAULT_RUNTIME_CONFIG.logSlowRequestMs },
      { status: 400 },
    ],
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
      "**.token",
      "**.turnstileToken",
    ],
    patterns: [sensitiveQueryValuePattern],
  },
})
