export type AppEnvironment = "development" | "staging" | "production"

export interface RuntimeConfig {
  appEnv: AppEnvironment
  logSampleRate: number
  logSlowRequestMs: number
  logForceAllRequests: boolean
  turnstileEnabled: boolean
}

export interface RuntimeConfigEnv {
  APP_ENV?: string
  LOG_SAMPLE_RATE?: string
  LOG_SLOW_REQUEST_MS?: string
  LOG_FORCE_ALL_REQUESTS?: string
  TURNSTILE_ENABLED?: string
}

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  appEnv: "production",
  logSampleRate: 0.1,
  logSlowRequestMs: 2_000,
  logForceAllRequests: false,
  turnstileEnabled: false,
}

const APP_ENV_VALUES: AppEnvironment[] = [
  "development",
  "staging",
  "production",
]

const isAppEnvironment = (value: string): value is AppEnvironment =>
  APP_ENV_VALUES.some((appEnv) => appEnv === value)

const parseAppEnvironment = (value?: string): AppEnvironment => {
  if (!value) {
    return DEFAULT_RUNTIME_CONFIG.appEnv
  }

  const normalized = value.trim().toLowerCase()

  if (isAppEnvironment(normalized)) {
    return normalized
  }

  return DEFAULT_RUNTIME_CONFIG.appEnv
}

interface BoundedNumberOptions {
  value: string | undefined
  fallback: number
  minimum: number
  maximum: number
}

const parseBoundedNumber = ({
  value,
  fallback,
  minimum,
  maximum,
}: BoundedNumberOptions) => {
  const parsed = parseFloat(value ?? "")

  if (!Number.isFinite(parsed)) {
    return fallback
  }

  return Math.min(maximum, Math.max(minimum, parsed))
}

const parseBoolean = (value?: string, fallback = false) => {
  if (!value) {
    return fallback
  }

  switch (value.trim().toLowerCase()) {
    case "true":
    case "1":
    case "yes":
    case "y":
    case "on":
      return true
    case "false":
    case "0":
    case "no":
    case "n":
    case "off":
      return false
    default:
      return fallback
  }
}

export const isDevelopmentEnvironment = (appEnv: AppEnvironment) =>
  appEnv === "development"

export const isProductionEnvironment = (appEnv: AppEnvironment) =>
  appEnv === "production"

export const resolveRuntimeConfig = (
  env: RuntimeConfigEnv | undefined
): RuntimeConfig => ({
  appEnv: parseAppEnvironment(env?.APP_ENV),
  logSampleRate: parseBoundedNumber({
    value: env?.LOG_SAMPLE_RATE,
    fallback: DEFAULT_RUNTIME_CONFIG.logSampleRate,
    minimum: 0,
    maximum: 1,
  }),
  logSlowRequestMs: parseBoundedNumber({
    value: env?.LOG_SLOW_REQUEST_MS,
    fallback: DEFAULT_RUNTIME_CONFIG.logSlowRequestMs,
    minimum: 1,
    maximum: 300_000,
  }),
  logForceAllRequests: parseBoolean(
    env?.LOG_FORCE_ALL_REQUESTS,
    DEFAULT_RUNTIME_CONFIG.logForceAllRequests
  ),
  turnstileEnabled: env?.TURNSTILE_ENABLED === "true",
})
