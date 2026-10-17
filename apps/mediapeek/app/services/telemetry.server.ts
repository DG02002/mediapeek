import { redactSensitiveUrl } from '@mediapeek/shared/log-redaction';

import { requestStorage } from '~/lib/logger.server';
import { mediaPeekEmitter } from '~/services/event-bus.server';

/**
 * TelemetryService subscribing to application events.
 * It strictly adheres to the "Wide Events" philosophy by updating the
 * AsyncLocalStorage context rather than logging immediately.
 * The actual log is emitted by the Request Handler's `finally` block in `logger.server.ts`.
 */
export class TelemetryService {
  constructor() {
    this.setupListeners();
  }

  private setupListeners() {
    mediaPeekEmitter.on('fetch:complete', (payload) => {
      this.updateContext('fetch', {
        diagnostics: payload.diagnostics,
        fileSize: payload.fileSize,
        filename: payload.filename,
        hash: payload.hash,
      });
    });

    mediaPeekEmitter.on('analyze:complete', (payload) => {
      this.updateContext('analysis', payload.diagnostics);
      // We generally don't log the full results payload as it's too large,
      // but the diagnostics are crucial.
    });

    mediaPeekEmitter.on('turnstile:verify', (payload) => {
      this.updateContext('turnstile', payload);
    });

    mediaPeekEmitter.on('error', (payload) => {
      const store = requestStorage.getStore();
      if (store) {
        // If we are in a request context, attach the error to the log event
        // We use a custom key or just 'error' if the logger supports it in 'customContext'
        // But logger.server.ts handles 'error' explicitly in the log() function params,
        // so here we might just want to store it in context for debugging if needed.
        // However, the route.ts catch block is the primary place that calls log({ error }).
        // This listener is useful for "background" errors that don't crash the request but need visibility.
        this.updateContext('backgroundError', {
          message:
            payload.error instanceof Error
              ? payload.error.message
              : String(payload.error),
          stack:
            payload.error instanceof Error ? payload.error.stack : undefined,
          context: payload.context,
        });
      } else {
        // Fallback for non-request context errors (should be rare in this architecture)
        console.error('Global/Background Error:', payload.error);
      }
    });

    mediaPeekEmitter.on('request:start', (payload) => {
      // Useful if we wanted to log "Start" events, but we stick to "One Log Per Request".
      // We could use this to init metrics if needed.
      this.updateContext('targetUrl', redactSensitiveUrl(payload.url));
    });
  }

  /**
   * Helper to safely update the AsyncLocalStorage store.
   */
  private updateContext(key: string, value: unknown) {
    const store = requestStorage.getStore();
    if (store) {
      store.customContext ??= {};
      store.customContext[key] = value;
    }
  }
}

// Singleton instance to ensure listeners are attached only once
export const telemetryService = new TelemetryService();

/**
 * Idempotent initialization function.
 * Since the service is a global singleton instantiated on module load,
 * this function is just a no-op marker to ensure the module is imported
 * and the side effects (listeners) are active.
 * calling this inside `loader` ensures the module is imported but allows
 * tree-shaking to strip it from client bundles.
 */
export function initTelemetry() {
  // No-op: The import itself triggered the singleton instantiation.
  // We return the instance just in case.
  return telemetryService;
}
