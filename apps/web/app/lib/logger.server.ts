import { AsyncLocalStorage } from 'node:async_hooks';

import { redactSensitiveLogData } from '@mediapeek/shared/log-redaction';
import {
  DEFAULT_RUNTIME_CONFIG,
  type RuntimeConfig,
} from '@mediapeek/shared/runtime-config';

// Hardcoded service metadata for now.
// In a real build pipeline, these would be injected via define variables or env vars.
const SERVICE_NAME = 'mediapeek-web';
const SERVICE_VERSION = '1.0.0'; // TODO: hook up to git commit hash

export interface LogContext {
  requestId: string;
  runtimeConfig?: RuntimeConfig;
  httpRequest?: {
    requestMethod: string;
    requestUrl: string;
    status: number;
    remoteIp?: string;
    userAgent?: string;
    latency?: string;
  };
  customContext?: Record<string, unknown>;
}

export const requestStorage = new AsyncLocalStorage<LogContext>();

export interface LogEvent {
  severity: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  requestId?: string; // Made optional as it can be inferred from store

  httpRequest?: LogContext['httpRequest'];
  context?: Record<string, unknown>;
  error?: unknown;

  [key: string]: unknown;
}

/**
 * Tail Sampling Logic:
 * - Always keep ERROR/WARNING
 * - Always keep slow requests (configurable threshold)
 * - Keep all logs if explicit force-all is enabled
 * - Sample healthy requests by configured rate
 */
function shouldSample(event: LogEvent, runtimeConfig: RuntimeConfig): boolean {
  // 1. Always keep errors and warnings
  if (event.severity === 'ERROR' || event.severity === 'WARNING') return true;

  // 2. Always keep slow requests (if latency available)
  if (event.httpRequest?.latency) {
    const latencySec = parseFloat(event.httpRequest.latency.replace('s', ''));
    if (
      !Number.isNaN(latencySec) &&
      latencySec * 1000 > runtimeConfig.logSlowRequestMs
    ) {
      return true;
    }
  }

  // 3. Keep everything if explicitly requested.
  if (runtimeConfig.logForceAllRequests) return true;

  // 4. Probabilistic sampling for healthy requests.
  return Math.random() < runtimeConfig.logSampleRate;
}

/**
 * Standardized JSON Logger
 * Adheres to: internal-docs/logging_standards.md
 * Output: Single line JSON object
 */
export function log(event: LogEvent, options?: { runtimeConfig?: RuntimeConfig }) {
  const store = requestStorage.getStore();
  const runtimeConfig =
    options?.runtimeConfig ?? store?.runtimeConfig ?? DEFAULT_RUNTIME_CONFIG;

  const mergedEvent: LogEvent = {
    ...event,
    requestId: event.requestId ?? store?.requestId ?? 'unknown',
    httpRequest: event.httpRequest ?? store?.httpRequest,
    context: {
      ...store?.customContext,
      ...event.context,
    },
  };

  if (!shouldSample(mergedEvent, runtimeConfig)) return;

  const sanitizedEvent = redactSensitiveLogData(mergedEvent) as LogEvent;

  const logPayload = JSON.stringify({
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    environment: runtimeConfig.appEnv,
    ...sanitizedEvent,
  });

  switch (sanitizedEvent.severity) {
    case 'ERROR':
      console.error(logPayload);
      break;
    case 'WARNING':
      console.warn(logPayload);
      break;
    case 'INFO':
    default:
      console.log(logPayload);
      break;
  }
}
