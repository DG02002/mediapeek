import { AsyncLocalStorage } from 'node:async_hooks';

// Hardcoded service metadata for now.
// In a real build pipeline, these would be injected via define variables or env vars.
const SERVICE_NAME = 'mediapeek-worker';
const SERVICE_VERSION = '1.0.0'; // TODO: hook up to git commit hash

export interface LogContext {
  requestId: string;
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
 * - Always keep slow requests (> 2s)
 * - Sample 10% of everything else
 */
function shouldSample(event: LogEvent): boolean {
  // 1. Always keep errors and warnings
  if (event.severity === 'ERROR' || event.severity === 'WARNING') return true;

  // 2. Always keep slow requests (if latency available)
  if (event.httpRequest?.latency) {
    const latencySec = parseFloat(event.httpRequest.latency.replace('s', ''));
    if (!isNaN(latencySec) && latencySec > 2.0) return true;
  }

  // 3. Probabilistic sampling for the rest (10%)
  // In development, we might want 100%, but let's stick to logic for now.
  // We'll trust the caller environment check if they want to force log.
  // Actually, for local dev, let's keep all.
  if (import.meta.env.DEV) return true;

  return Math.random() < 0.1;
}

/**
 * Standardized JSON Logger
 * Adheres to: internal-docs/logging_standards.md
 * Output: Single line JSON object
 */
export function log(event: LogEvent) {
  const store = requestStorage.getStore();

  const mergedEvent: LogEvent = {
    ...event,
    requestId: event.requestId ?? store?.requestId ?? 'unknown',
    httpRequest: event.httpRequest ?? store?.httpRequest,
    context: {
      ...store?.customContext,
      ...event.context,
    },
  };

  if (!shouldSample(mergedEvent)) return;

  const logPayload = JSON.stringify({
    timestamp: new Date().toISOString(),
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
    ...mergedEvent,
  });

  switch (mergedEvent.severity) {
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
