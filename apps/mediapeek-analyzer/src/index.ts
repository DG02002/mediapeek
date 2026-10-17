import { sValidator } from '@hono/standard-validator';
import { AnalyzeErrorCode } from '@mediapeek/shared/analyze-contract';
import {
  ANALYZE_PROGRESS_STREAM_CONTENT_TYPE,
  encodeAnalyzeStreamEvent,
  type AnalyzeProgressStage,
} from '@mediapeek/shared/analyze-progress';
import { redactSensitiveUrl } from '@mediapeek/shared/log-redaction';
import { resolveRuntimeConfig } from '@mediapeek/shared/runtime-config';
import { analyzeSchema } from '@mediapeek/shared/schemas';
import { Hono } from 'hono';

import { log, type LogContext, requestStorage } from './lib/logger.server';
import { fetchMediaChunk } from './services/media-fetch.server';
import {
  analyzeMediaBuffer,
  CpuBudgetExceededError,
  DEFAULT_ANALYSIS_CPU_BUDGET_MS,
} from './services/mediainfo.server';

type Bindings = {
  ANALYZE_API_KEY?: string;
  ANALYZE_CPU_BUDGET_MS?: string;
  APP_ENV?: string;
  LOG_SAMPLE_RATE?: string;
  LOG_SLOW_REQUEST_MS?: string;
  LOG_FORCE_ALL_REQUESTS?: string;
};

const MIN_ANALYSIS_CPU_BUDGET_MS = 5_000;
const MAX_ANALYSIS_CPU_BUDGET_MS = 29_000;

const getRequestId = (request: Request) =>
  request.headers.get('cf-ray') ?? crypto.randomUUID();

const getApiKeyFromRequest = (request: Request): string | null => {
  const xApiKey = request.headers.get('x-api-key');
  if (xApiKey) return xApiKey;

  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return null;
  return authorization.slice('Bearer '.length).trim() || null;
};

const resolveCpuBudgetMs = (rawValue?: string) => {
  const parsed = Number.parseInt(rawValue ?? '', 10);
  if (Number.isNaN(parsed)) {
    return DEFAULT_ANALYSIS_CPU_BUDGET_MS;
  }

  return Math.min(
    MAX_ANALYSIS_CPU_BUDGET_MS,
    Math.max(MIN_ANALYSIS_CPU_BUDGET_MS, parsed),
  );
};

const isCpuLimitError = (error: unknown) => {
  if (error instanceof CpuBudgetExceededError) return true;
  if (!(error instanceof Error)) return false;
  return /cpu budget exceeded/i.test(error.message);
};

const isRateLimitedFetchError = (message: string) =>
  /rate-limited/i.test(message);

const isValidationFetchError = (message: string) =>
  /webpage, not a media file|provide a direct link|media file not found|access denied/i.test(
    message,
  );

const wantsProgressStream = (request: Request) =>
  request.headers
    .get('accept')
    ?.toLowerCase()
    .includes(ANALYZE_PROGRESS_STREAM_CONTENT_TYPE) ?? false;

type RequestSeverity = 'INFO' | 'WARNING' | 'ERROR';

type AnalyzeProgressReporter = (
  stage: AnalyzeProgressStage,
  title: string,
  message: string,
) => Promise<void> | void;

type AnalyzeExecutionResult = {
  fileSize?: number;
  results: Record<string, string>;
  diagnostics: {
    fetch: Awaited<ReturnType<typeof fetchMediaChunk>>['diagnostics'];
    analysis: Awaited<ReturnType<typeof analyzeMediaBuffer>>['diagnostics'] & {
      resolvedFilename: string;
      resolvedFilenameSource: string;
    };
  };
};

const classifyAnalyzeError = (
  error: unknown,
  customContext: Record<string, unknown>,
): {
  status: number;
  code: AnalyzeErrorCode;
  message: string;
  retryable: boolean;
  severity: RequestSeverity;
} => {
  let status = 500;
  let code: AnalyzeErrorCode = 'INTERNAL_ERROR';
  let message = 'Internal Server Error';
  let retryable = false;
  let severity: RequestSeverity = 'ERROR';

  if (isCpuLimitError(error)) {
    status = 503;
    code = 'CPU_BUDGET_EXCEEDED';
    message =
      'Analysis exceeded the configured CPU budget. Retry with a smaller or simpler source.';
    retryable = true;
    customContext.errorClass = 'CPU_LIMIT_EXCEEDED';
  } else if (error instanceof Error) {
    message = error.message;
    if (isRateLimitedFetchError(message)) {
      status = 429;
      code = 'RATE_LIMITED';
      retryable = true;
      severity = 'WARNING';
      customContext.errorClass = 'ANALYZE_RATE_LIMITED';
    } else if (isValidationFetchError(message)) {
      status = 400;
      code = 'VALIDATION_FAILED';
      retryable = false;
      severity = 'WARNING';
      customContext.errorClass = 'ANALYZE_VALIDATION_FAILED';
    } else if (/fetch stream|unable to access file/i.test(message)) {
      status = 502;
      code = 'UPSTREAM_FETCH_FAILED';
      retryable = true;
      customContext.errorClass = 'UPSTREAM_FETCH_FAILED';
    } else {
      customContext.errorClass = 'ANALYZER_INTERNAL_ERROR';
    }
  }

  customContext.error = {
    code,
    message,
    details: error instanceof Error ? error.stack : String(error),
  };

  return {
    status,
    code,
    message,
    retryable,
    severity,
  };
};

const runAnalyzeRequest = async ({
  url,
  format,
  cpuBudgetMs,
  customContext,
  reportProgress,
}: {
  url: string;
  format: string[];
  cpuBudgetMs: number;
  customContext: Record<string, unknown>;
  reportProgress?: AnalyzeProgressReporter;
}): Promise<AnalyzeExecutionResult> => {
  await reportProgress?.(
    'request_received',
    'Analyzer Started',
    'The analyzer accepted the request and is beginning the source fetch.',
  );

  const {
    buffer,
    byteSource,
    fileSize,
    filename,
    filenameSource,
    diagnostics: fetchDiag,
    archiveEntry,
  } = await fetchMediaChunk(url, undefined, reportProgress);
  customContext.fetch = fetchDiag;
  customContext.fileSize = fileSize;
  customContext.filename = fetchDiag.resolvedFilename ?? filename;

  const {
    results,
    diagnostics: analysisDiag,
    resolvedFilename,
    resolvedFilenameSource,
  } = await analyzeMediaBuffer(
    buffer,
    fileSize,
    filename,
    filenameSource,
    format,
    cpuBudgetMs,
    archiveEntry,
    byteSource?.readChunk,
    reportProgress,
  );

  customContext.analysis = analysisDiag;
  customContext.filename = resolvedFilename;
  customContext.filenameSource = resolvedFilenameSource;
  customContext.cpuBudgetRemainingMs = Math.max(
    0,
    cpuBudgetMs - analysisDiag.totalAnalysisTimeMs,
  );

  return {
    fileSize,
    results,
    diagnostics: {
      fetch: fetchDiag,
      analysis: {
        ...analysisDiag,
        resolvedFilename,
        resolvedFilenameSource,
      },
    },
  };
};

const app = new Hono<{ Bindings: Bindings }>();

// Health check
app.get('/', (c) => c.text('MediaPeek Analyzer API'));

// RPC Route
const routes = app.post(
  '/analyze',
  sValidator('json', analyzeSchema),
  async (c) => {
    const startTime = performance.now();
    const requestId = getRequestId(c.req.raw);
    const runtimeConfig = resolveRuntimeConfig(c.env);
    const initialContext: LogContext = {
      requestId,
      runtimeConfig,
      httpRequest: {
        requestMethod: c.req.method,
        requestUrl: c.req.path,
        status: 200,
        remoteIp: c.req.header('CF-Connecting-IP') ?? undefined,
        userAgent: c.req.header('User-Agent') ?? undefined,
        latency: '0s',
      },
      customContext: {},
    };

    return requestStorage.run(initialContext, async () => {
      let status = 200;
      let severity: 'INFO' | 'WARNING' | 'ERROR' = 'INFO';
      const customContext =
        initialContext.customContext ?? (initialContext.customContext = {});

      const cf = (c.req.raw as Request & { cf?: Record<string, unknown> }).cf;
      if (cf) {
        customContext.cloudflare = {
          colo: cf.colo,
          country: cf.country,
        };
      }

      const expectedApiKey = c.env.ANALYZE_API_KEY?.trim();
      if (expectedApiKey) {
        const providedApiKey = getApiKeyFromRequest(c.req.raw);
        if (!providedApiKey) {
          customContext.errorClass = 'ANALYZER_AUTH_REQUIRED';
          return c.json(
            {
              success: false as const,
              requestId,
              error: {
                code: 'AUTH_REQUIRED' as AnalyzeErrorCode,
                message: 'Missing analyzer API key.',
                retryable: false,
              },
            },
            401,
          );
        }

        if (providedApiKey !== expectedApiKey) {
          customContext.errorClass = 'ANALYZER_AUTH_INVALID';
          return c.json(
            {
              success: false as const,
              requestId,
              error: {
                code: 'AUTH_INVALID' as AnalyzeErrorCode,
                message: 'Invalid analyzer API key.',
                retryable: false,
              },
            },
            403,
          );
        }
      }

      const cpuBudgetMs = resolveCpuBudgetMs(c.env.ANALYZE_CPU_BUDGET_MS);
      customContext.cpuBudgetMs = cpuBudgetMs;

      const { url, format } = c.req.valid('json');
      customContext.targetUrl = redactSensitiveUrl(url);
      const streamProgress = wantsProgressStream(c.req.raw);
      let skipFinallyLog = false;

      try {
        if (streamProgress) {
          skipFinallyLog = true;
          let streamStatus = 200;
          let streamSeverity: RequestSeverity = 'INFO';
          const encoder = new TextEncoder();

          const stream = new ReadableStream<Uint8Array>({
            start(controller) {
              const reportProgress: AnalyzeProgressReporter = async (
                stage,
                title,
                message,
              ) => {
                controller.enqueue(
                  encoder.encode(
                    encodeAnalyzeStreamEvent({
                      type: 'progress',
                      requestId,
                      stage,
                      title,
                      message,
                    }),
                  ),
                );
              };

              void (async () => {
                try {
                  const result = await runAnalyzeRequest({
                    url,
                    format,
                    cpuBudgetMs,
                    customContext,
                    reportProgress,
                  });

                  controller.enqueue(
                    encoder.encode(
                      encodeAnalyzeStreamEvent({
                        type: 'success',
                        requestId,
                        results: result.results,
                      }),
                    ),
                  );
                  controller.close();
                } catch (error) {
                  const classified = classifyAnalyzeError(error, customContext);
                  streamStatus = classified.status;
                  streamSeverity = classified.severity;

                  controller.enqueue(
                    encoder.encode(
                      encodeAnalyzeStreamEvent({
                        type: 'error',
                        requestId,
                        error: {
                          code: classified.code,
                          message: classified.message,
                          retryable: classified.retryable,
                        },
                      }),
                    ),
                  );
                  controller.close();
                } finally {
                  if (initialContext.httpRequest) {
                    initialContext.httpRequest.status = streamStatus;
                    initialContext.httpRequest.latency = `${String((performance.now() - startTime) / 1000)}s`;
                  }

                  log({
                    severity: streamSeverity,
                    message: 'Analyzer Request',
                  });
                }
              })();
            },
          });

          return new Response(stream, {
            headers: {
              'content-type': ANALYZE_PROGRESS_STREAM_CONTENT_TYPE,
              'cache-control': 'no-store',
            },
          });
        }

        const result = await runAnalyzeRequest({
          url,
          format,
          cpuBudgetMs,
          customContext,
        });

        return c.json({
          success: true as const,
          requestId,
          fileSize: result.fileSize,
          results: result.results,
          diagnostics: result.diagnostics,
        });
      } catch (error) {
        const classified = classifyAnalyzeError(error, customContext);
        status = classified.status;
        severity = classified.severity;

        return c.json(
          {
            success: false as const,
            requestId,
            error: {
              code: classified.code,
              message: classified.message,
              retryable: classified.retryable,
            },
          },
          status as 500,
        );
      } finally {
        if (!skipFinallyLog) {
          if (initialContext.httpRequest) {
            initialContext.httpRequest.status = status;
            initialContext.httpRequest.latency = `${String((performance.now() - startTime) / 1000)}s`;
          }

          log({
            severity,
            message: 'Analyzer Request',
          });
        }
      }
    });
  },
);

export const route = app.route('/', routes);

export type AppType = typeof route;
export default app;
