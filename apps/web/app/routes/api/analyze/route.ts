import type { AnalyzeErrorCode } from '@mediapeek/shared/analyze-contract';
import { analyzeSchema } from '@mediapeek/shared/schemas';
import { hc } from 'hono/client';
import type { AppType } from 'mediapeek-analyzer';

import { log, type LogContext, requestStorage } from '~/lib/logger.server';
import { TurnstileResponseSchema } from '~/lib/schemas/turnstile';
import { mediaPeekEmitter } from '~/services/event-bus.server';
import { initTelemetry } from '~/services/telemetry.server';

import type { Route } from './+types/route';

const RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_PER_MINUTE = 30;
const rateLimitState = new Map<string, { count: number; resetAt: number }>();

const getRequestId = (request: Request) =>
  request.headers.get('cf-ray') ?? crypto.randomUUID();

const getApiKeyFromRequest = (request: Request): string | null => {
  const xApiKey = request.headers.get('x-api-key');
  if (xApiKey) return xApiKey;

  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  return authorization.slice('Bearer '.length).trim() || null;
};

const buildErrorResponse = (
  requestId: string,
  status: number,
  code: AnalyzeErrorCode,
  message: string,
  retryable: boolean,
) => {
  const payload: {
    success: false;
    requestId: string;
    error: {
      code: AnalyzeErrorCode;
      message: string;
      retryable: boolean;
    };
  } = {
    success: false,
    requestId,
    error: { code, message, retryable },
  };
  return Response.json(payload, { status });
};

const buildSuccessResponse = (
  requestId: string,
  results: Record<string, string>,
) =>
  Response.json({
    success: true,
    requestId,
    results,
  });

const isCpuLimitError = (error: unknown) => {
  if (!(error instanceof Error)) return false;
  return /(exceeded cpu|cpu budget exceeded)/i.test(error.message);
};

const applyRateLimit = (request: Request, maxPerMinute: number) => {
  const now = Date.now();
  const key =
    request.headers.get('CF-Connecting-IP') ??
    request.headers.get('x-real-ip') ??
    'anonymous';
  const current = rateLimitState.get(key);

  if (!current || now >= current.resetAt) {
    rateLimitState.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (current.count >= maxPerMinute) {
    return { allowed: false, retryAfterMs: current.resetAt - now };
  }

  current.count += 1;
  rateLimitState.set(key, current);

  // Keep memory bounded for long-lived isolates.
  if (rateLimitState.size > 4000) {
    for (const [entryKey, entry] of rateLimitState.entries()) {
      if (entry.resetAt <= now) {
        rateLimitState.delete(entryKey);
      }
    }
  }

  return { allowed: true, retryAfterMs: 0 };
};

const getRateLimitConfig = (env: Env) => {
  const configured = Number.parseInt(
    env.ANALYZE_RATE_LIMIT_PER_MINUTE ?? '',
    10,
  );
  if (Number.isNaN(configured) || configured <= 0) {
    return DEFAULT_RATE_LIMIT_PER_MINUTE;
  }
  return configured;
};

export async function loader({ request, context }: Route.LoaderArgs) {
  initTelemetry();

  const startTime = performance.now();
  const requestId = getRequestId(request);
  const url = new URL(request.url);

  const initialContext: LogContext = {
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
    const customContext =
      initialContext.customContext ?? (initialContext.customContext = {});

    try {
      const expectedApiKey = context.cloudflare.env.ANALYZE_API_KEY?.trim();
      if (expectedApiKey) {
        const providedApiKey = getApiKeyFromRequest(request);
        if (!providedApiKey) {
          status = 401;
          severity = 'WARNING';
          customContext.errorClass = 'ANALYZE_AUTH_FAILED';
          return buildErrorResponse(
            requestId,
            401,
            'AUTH_REQUIRED',
            'Missing API key.',
            false,
          );
        }
        if (providedApiKey !== expectedApiKey) {
          status = 403;
          severity = 'WARNING';
          customContext.errorClass = 'ANALYZE_AUTH_FAILED';
          return buildErrorResponse(
            requestId,
            403,
            'AUTH_INVALID',
            'Invalid API key.',
            false,
          );
        }
      }

      const rateLimitResult = applyRateLimit(
        request,
        getRateLimitConfig(context.cloudflare.env),
      );
      if (!rateLimitResult.allowed) {
        status = 429;
        severity = 'WARNING';
        customContext.errorClass = 'ANALYZE_RATE_LIMITED';
        return Response.json(
          {
            success: false,
            requestId,
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many analysis requests. Please retry shortly.',
              retryable: true,
            },
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(
                Math.max(1, Math.ceil(rateLimitResult.retryAfterMs / 1000)),
              ),
            },
          },
        );
      }

      const input: Record<string, unknown> = Object.fromEntries(
        url.searchParams,
      );
      if (url.searchParams.has('format')) {
        input.format = url.searchParams.getAll('format');
      }

      const validationResult = analyzeSchema.safeParse(input);
      if (!validationResult.success) {
        const errors = validationResult.error.issues;
        const urlError = errors.find((e) => e.path[0] === 'url')?.message;
        const formatError = errors.find((e) => e.path[0] === 'format')?.message;
        const serverError =
          urlError ?? formatError ?? 'The input provided is invalid.';

        status = 422;
        severity = 'WARNING';
        customContext.errorClass = 'ANALYZE_VALIDATION_FAILED';

        mediaPeekEmitter.emit('error', {
          error: new Error('Validation Failed'),
          context: { validationErrors: errors },
        });

        return buildErrorResponse(
          requestId,
          422,
          'VALIDATION_FAILED',
          serverError,
          false,
        );
      }

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
          customContext.errorClass = 'ANALYZE_AUTH_FAILED';
          mediaPeekEmitter.emit('turnstile:verify', {
            success: false,
            token: 'MISSING',
            outcome: { result: 'MISSING_TOKEN' },
          });
          return buildErrorResponse(
            requestId,
            403,
            'AUTH_REQUIRED',
            'Security verification is required. Please complete the check.',
            false,
          );
        }

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
            customContext.errorClass = 'ANALYZE_AUTH_FAILED';
            mediaPeekEmitter.emit('turnstile:verify', {
              success: false,
              token: turnstileToken,
              outcome,
            });
            return buildErrorResponse(
              requestId,
              403,
              'AUTH_INVALID',
              'Security check failed. Please refresh and try again.',
              false,
            );
          }

          mediaPeekEmitter.emit('turnstile:verify', {
            success: true,
            token: turnstileToken,
            outcome,
          });
        }
      }

      const initialUrl = validationResult.data.url;
      const requestedFormats = validationResult.data.format;

      mediaPeekEmitter.emit('request:start', {
        requestId,
        url: initialUrl,
      });

      // --- RPC Call to Analyzer Worker ---
      const client = hc<AppType>('https://analyzer', {
        fetch: context.cloudflare.env.ANALYZER.fetch.bind(
          context.cloudflare.env.ANALYZER,
        ),
      });

      const rpcResponse = await client.analyze.$post({
        json: {
          url: initialUrl,
          format: requestedFormats,
        },
      });

      const rpcData = await rpcResponse.json();

      if (!rpcData.success) {
        // Handle RPC Error
        const errorData = rpcData.error;

        if (Array.isArray(errorData)) {
          // Validation Error (Zod Issue[])
          const firstIssue = errorData[0];
          return buildErrorResponse(
            requestId,
            400,
            'VALIDATION_FAILED',
            firstIssue.message || 'Invalid request data',
            false,
          );
        }

        // Backend Error
        // Explicitly narrow the type for TS
        const backendError = errorData as {
          code: AnalyzeErrorCode;
          message: string;
        };
        const { code, message } = backendError;
        status = rpcResponse.status;
        severity = status >= 500 ? 'ERROR' : 'WARNING';
        customContext.errorClass = `ANALYZE_${code}`;

        throw new Error(message); // Re-throw to be caught by catch block below for unified error handling
      }

      const { results, diagnostics } = rpcData;

      // Check for CPU limit errors that were swallowed by the worker but returned in diagnostics
      if (
        diagnostics.analysis.formatErrors?.json &&
        diagnostics.analysis.formatErrors.json.includes('CPU budget exceeded')
      ) {
        throw new Error('CPU budget exceeded');
      }

      customContext.fetch = diagnostics.fetch;
      customContext.analysis = diagnostics.analysis;
      if (rpcData.fileSize) {
        customContext.fileSize = rpcData.fileSize;
      }
      customContext.filename = diagnostics.fetch.resolvedFilename;

      try {
        const json = JSON.parse(results.json || '{}') as {
          media?: { track: { '@type': string; Archive_Name?: string }[] };
        };
        const general = json.media?.track.find((t) => t['@type'] === 'General');
        if (general?.Archive_Name) {
          customContext.archiveName = general.Archive_Name;
          customContext.innerFilename = diagnostics.fetch.resolvedFilename;
        }
      } catch {
        // Ignore parse error
      }

      mediaPeekEmitter.emit('analyze:complete', {
        results,
        diagnostics: diagnostics.analysis,
      });

      return buildSuccessResponse(requestId, results);
    } catch (error) {
      status = 500;
      severity = 'ERROR';

      let code: AnalyzeErrorCode = 'INTERNAL_ERROR';
      let retryable = false;
      let errorMessage =
        error instanceof Error
          ? error.message
          : 'An unexpected error occurred.';

      if (isCpuLimitError(error)) {
        status = 503;
        code = 'CPU_BUDGET_EXCEEDED';
        retryable = true;
        errorMessage =
          'CPU budget exceeded while analyzing this source. Please retry with a smaller or simpler media file.';
        customContext.errorClass = 'CPU_LIMIT_EXCEEDED';
      } else if (
        errorMessage.includes('internal error; reference =') ||
        (error instanceof Error &&
          'remote' in error &&
          (error as { remote?: boolean }).remote)
      ) {
        status = 503;
        code = 'UPSTREAM_FETCH_FAILED';
        retryable = true;
        errorMessage =
          'Unable to retrieve the media file. The remote server may be incompatible with our fetcher.';
      }

      const errorObj = {
        code: status,
        message: errorMessage,
        details: error instanceof Error ? error.stack : String(error),
      };

      if (status === 503 && errorMessage.includes('CPU budget exceeded')) {
        status = 503;
        code = 'CPU_BUDGET_EXCEEDED';
        retryable = true;
        customContext.errorClass = 'CPU_LIMIT_EXCEEDED';
      } else if (status === 502 && errorMessage.includes('Fetch stream')) {
        status = 502;
        code = 'UPSTREAM_FETCH_FAILED';
        retryable = true;
      }

      customContext.errorClass ??= 'ANALYZE_INTERNAL_ERROR';
      mediaPeekEmitter.emit('error', {
        error,
        context: { errorObj, requestId, code },
      });

      return buildErrorResponse(
        requestId,
        status,
        code,
        errorMessage,
        retryable,
      );
    } finally {
      if (initialContext.httpRequest) {
        initialContext.httpRequest.status = status;
        initialContext.httpRequest.latency = `${String((performance.now() - startTime) / 1000)}s`;
      }

      log({
        severity,
        message: 'Media Analysis Request',
      });
    }
  });
}
