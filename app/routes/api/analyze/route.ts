// Initialize Telemetry Service (Singleton) - Ensures listeners are active
import { log, requestStorage } from '~/lib/logger.server';
import { analyzeSchema } from '~/lib/schemas';
import { TurnstileResponseSchema } from '~/lib/schemas/turnstile';
import { mediaPeekEmitter } from '~/services/event-bus.server';
import { fetchMediaChunk } from '~/services/media-fetch.server';
import { analyzeMediaBuffer } from '~/services/mediainfo.server';
// Initialize Telemetry Service (Singleton) - Ensures listeners are active
import { initTelemetry } from '~/services/telemetry.server';

import type { Route } from './+types/route';

export async function loader({ request, context }: Route.LoaderArgs) {
  // Ensure Telemetry Service is initialized (Singleton)
  initTelemetry();

  const startTime = performance.now();
  const url = new URL(request.url);

  // Generate Request ID immediately for correlation
  const requestId = request.headers.get('cf-ray') ?? crypto.randomUUID();

  const initialContext = {
    requestId,
    httpRequest: {
      requestMethod: request.method,
      requestUrl: url.pathname,
      status: 200,
      remoteIp: request.headers.get('CF-Connecting-IP') ?? undefined,
      userAgent: request.headers.get('User-Agent') ?? undefined,
      latency: '0s',
    },
    customContext: {},
  };

  return requestStorage.run(initialContext, async () => {
    let status = 200;
    let severity: 'INFO' | 'WARNING' | 'ERROR' = 'INFO';

    try {
      const validationResult = analyzeSchema.safeParse(
        Object.fromEntries(url.searchParams),
      );

      // Turnstile Validation
      const turnstileToken = request.headers.get('CF-Turnstile-Response');
      const secretKey = import.meta.env.DEV
        ? '1x00000000000000000000AA'
        : context.cloudflare.env.TURNSTILE_SECRET_KEY;

      if (
        (context.cloudflare.env.ENABLE_TURNSTILE as string) === 'true' &&
        secretKey
      ) {
        if (!turnstileToken) {
          status = 403;
          severity = 'WARNING';
          mediaPeekEmitter.emit('turnstile:verify', {
            success: false,
            token: 'MISSING',
            outcome: { result: 'MISSING_TOKEN' },
          });
          return Response.json(
            {
              error:
                'Security verification is required. Please complete the check.',
            },
            { status: 403 },
          );
        }

        // Bypass verification for localhost mock token
        if (turnstileToken === 'localhost-mock-token' || import.meta.env.DEV) {
          mediaPeekEmitter.emit('turnstile:verify', {
            success: true,
            token: turnstileToken,
            outcome: { result: 'BYPASS_DEV' },
          });
        } else {
          const formData = new FormData();
          formData.append('secret', secretKey);
          formData.append('response', turnstileToken);
          formData.append(
            'remoteip',
            request.headers.get('CF-Connecting-IP') ?? '',
          );

          const result = await fetch(
            'https://challenges.cloudflare.com/turnstile/v0/siteverify',
            {
              method: 'POST',
              body: formData,
            },
          );

          const json = await result.json();
          const outcome = TurnstileResponseSchema.parse(json);

          if (!outcome.success) {
            status = 403;
            severity = 'WARNING';
            mediaPeekEmitter.emit('turnstile:verify', {
              success: false,
              token: turnstileToken,
              outcome,
            });
            return Response.json(
              {
                error: 'Security check failed. Please refresh and try again.',
              },
              { status: 403 },
            );
          }
          mediaPeekEmitter.emit('turnstile:verify', {
            success: true,
            token: turnstileToken,
            outcome,
          });
        }
      }

      if (!validationResult.success) {
        const errors = validationResult.error.issues;
        const urlError = errors.find((e) => e.path[0] === 'url')?.message;
        const formatError = errors.find((e) => e.path[0] === 'format')?.message;

        const serverError =
          urlError ?? formatError ?? 'The input provided is invalid.';

        status = 400;
        severity = 'WARNING';

        // Log raw Zod errors for debugging
        mediaPeekEmitter.emit('error', {
          error: new Error('Validation Failed'),
          context: { validationErrors: errors },
        });

        return Response.json({ error: serverError }, { status: 400 });
      }

      const { url: initialUrl, format: requestedFormats } =
        validationResult.data;

      // START REQUEST - Explicitly track start if needed, or rely on end log
      mediaPeekEmitter.emit('request:start', {
        requestId,
        url: initialUrl,
      });

      // Fetch Media Chunk (includes validation, resolution, streaming)
      // fetchMediaChunk now emits 'fetch:complete' internally!
      const { buffer, fileSize, filename } = await fetchMediaChunk(initialUrl);

      // Analyze
      const { results, diagnostics: analysisDiagnostics } =
        await analyzeMediaBuffer(buffer, fileSize, filename, requestedFormats);

      // Emit Analysis Telemetry
      mediaPeekEmitter.emit('analyze:complete', {
        results,
        diagnostics: analysisDiagnostics,
      });

      return Response.json({ results });
    } catch (error) {
      status = 500;
      severity = 'ERROR';

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred.';

      const errorObj = {
        code: 500,
        message: errorMessage,
        details: error instanceof Error ? error.stack : String(error),
      };

      mediaPeekEmitter.emit('error', {
        error,
        context: { errorObj },
      });

      return Response.json({ error: errorMessage }, { status: 500 });
    } finally {
      initialContext.httpRequest.status = status;
      initialContext.httpRequest.latency = `${String((performance.now() - startTime) / 1000)}s`;
      log({
        severity,
        message: 'Media Analysis Request',
        // Request context is automatically injected by logger via ALS!
      });
    }
  });
}
