export type AppEnvironment = 'development' | 'staging' | 'production';

export interface RuntimeConfig {
  appEnv: AppEnvironment;
  logSampleRate: number;
  logSlowRequestMs: number;
  logForceAllRequests: boolean;
}

export interface RuntimeConfigEnv {
  APP_ENV?: string;
  LOG_SAMPLE_RATE?: string;
  LOG_SLOW_REQUEST_MS?: string;
  LOG_FORCE_ALL_REQUESTS?: string;
}

export const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  appEnv: 'production',
  logSampleRate: 0.1,
  logSlowRequestMs: 2_000,
  logForceAllRequests: false,
};

const APP_ENV_VALUES: AppEnvironment[] = [
  'development',
  'staging',
  'production',
];

const parseAppEnvironment = (value?: string): AppEnvironment => {
  if (!value) return DEFAULT_RUNTIME_CONFIG.appEnv;
  const normalized = value.trim().toLowerCase() as AppEnvironment;
  if (APP_ENV_VALUES.indexOf(normalized) >= 0) return normalized;
  return DEFAULT_RUNTIME_CONFIG.appEnv;
};

const parseBoundedNumber = (
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
) => {
  const parsed = parseFloat(value ?? '');
  if (!isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

const parseBoolean = (value?: string, fallback = false) => {
  if (!value) return fallback;
  switch (value.trim().toLowerCase()) {
    case 'true':
    case '1':
    case 'yes':
    case 'y':
    case 'on':
      return true;
    case 'false':
    case '0':
    case 'no':
    case 'n':
    case 'off':
      return false;
    default:
      return fallback;
  }
};

export const isDevelopmentEnvironment = (appEnv: AppEnvironment) =>
  appEnv === 'development';

export const isProductionEnvironment = (appEnv: AppEnvironment) =>
  appEnv === 'production';

export const resolveRuntimeConfig = (
  env: RuntimeConfigEnv | undefined,
): RuntimeConfig => ({
  appEnv: parseAppEnvironment(env?.APP_ENV),
  logSampleRate: parseBoundedNumber(
    env?.LOG_SAMPLE_RATE,
    DEFAULT_RUNTIME_CONFIG.logSampleRate,
    0,
    1,
  ),
  logSlowRequestMs: parseBoundedNumber(
    env?.LOG_SLOW_REQUEST_MS,
    DEFAULT_RUNTIME_CONFIG.logSlowRequestMs,
    1,
    300_000,
  ),
  logForceAllRequests: parseBoolean(
    env?.LOG_FORCE_ALL_REQUESTS,
    DEFAULT_RUNTIME_CONFIG.logForceAllRequests,
  ),
});
