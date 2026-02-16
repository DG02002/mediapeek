import { sValidator } from '@hono/standard-validator';
import { AnalyzeErrorCode } from '@mediapeek/shared/analyze-contract';
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

      try {
        // 1. Fetch
        const {
          buffer,
          fileSize,
          filename,
          diagnostics: fetchDiag,
        } = await fetchMediaChunk(url);
        customContext.fetch = fetchDiag;
        customContext.fileSize = fileSize;
        customContext.filename = fetchDiag.resolvedFilename ?? filename;

        // 2. Analyze (with explicit CPU budget check)
        const { results, diagnostics: analysisDiag } = await analyzeMediaBuffer(
          buffer,
          fileSize,
          filename,
          format,
          cpuBudgetMs,
        );

        customContext.analysis = analysisDiag;
        customContext.cpuBudgetRemainingMs = Math.max(
          0,
          cpuBudgetMs - analysisDiag.totalAnalysisTimeMs,
        );

        return c.json({
          success: true as const,
          requestId,
          fileSize,
          results,
          diagnostics: {
            fetch: fetchDiag,
            analysis: analysisDiag,
          },
        });
      } catch (error) {
        status = 500;
        severity = 'ERROR';

        let code: AnalyzeErrorCode = 'INTERNAL_ERROR';
        let message = 'Internal Server Error';
        let retryable = false;

        if (isCpuLimitError(error)) {
          status = 503;
          code = 'CPU_BUDGET_EXCEEDED';
          message =
            'Analysis exceeded the configured CPU budget. Retry with a smaller or simpler source.';
          retryable = true;
          customContext.errorClass = 'CPU_LIMIT_EXCEEDED';
        } else if (error instanceof Error) {
          message = error.message;
          if (/fetch stream|unable to access file/i.test(message)) {
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

        return c.json(
          {
            success: false as const,
            requestId,
            error: {
              code,
              message,
              retryable,
            },
          },
          status as 500,
        );
      } finally {
        if (initialContext.httpRequest) {
          initialContext.httpRequest.status = status;
          initialContext.httpRequest.latency = `${String((performance.now() - startTime) / 1000)}s`;
        }

        log({
          severity,
          message: 'Analyzer Request',
        });
      }
    });
  },
);

export const route = app.route('/', routes);

export type AppType = typeof route;
export default app;
