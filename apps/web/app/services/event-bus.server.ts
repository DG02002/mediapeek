import { EventEmitter } from 'node:events';

import type { FetchDiagnostics } from '~/services/media-fetch.server';
import type { MediaInfoDiagnostics } from '~/services/mediainfo.server';

/**
 * Event payloads for type safety
 */
export interface MediaPeekEvents {
  'request:start': { requestId: string; url: string };
  'turnstile:verify': {
    success: boolean;
    tokenPresent: boolean;
    tokenLength: number;
    outcome?: unknown;
  };
  'fetch:complete': {
    diagnostics: FetchDiagnostics;
    fileSize?: number;
    filename: string;
    hash?: string;
  };
  'analyze:complete': {
    results: Record<string, string>;
    diagnostics: MediaInfoDiagnostics;
  };
  error: { error: unknown; context?: Record<string, unknown> };
}

/**
 * Typed EventEmitter for MediaPeek
 */
export class MediaPeekEmitter extends EventEmitter {
  constructor() {
    super({ captureRejections: true });
  }

  emit<K extends keyof MediaPeekEvents>(
    eventName: K,
    payload: MediaPeekEvents[K],
  ): boolean {
    return super.emit(eventName, payload);
  }

  on<K extends keyof MediaPeekEvents>(
    eventName: K,
    listener: (payload: MediaPeekEvents[K]) => void | Promise<void>,
  ): this {
    return super.on(eventName, (payload: MediaPeekEvents[K]) => {
      void listener(payload);
    });
  }

  once<K extends keyof MediaPeekEvents>(
    eventName: K,
    listener: (payload: MediaPeekEvents[K]) => void | Promise<void>,
  ): this {
    return super.once(eventName, (payload: MediaPeekEvents[K]) => {
      void listener(payload);
    });
  }
}

// Global singleton instance
export const mediaPeekEmitter = new MediaPeekEmitter();

// Ensure errors are handled to prevent unhandled rejections
mediaPeekEmitter.on('error', (payload) => {
  // We rely on the TelemetryService to log this, but we need a no-op listener
  // to prevent the EventEmitter from throwing if no other listeners are attached.
  // The actual logging happens in TelemetryService.
  void payload;
});
