import { sValidator } from '@hono/standard-validator';
import { AnalyzeErrorCode } from '@mediapeek/shared/analyze-contract';
import { analyzeSchema } from '@mediapeek/shared/schemas';
import { Hono } from 'hono';

import { fetchMediaChunk } from './services/media-fetch.server';
import { analyzeMediaBuffer } from './services/mediainfo.server';
import { CpuBudgetExceededError } from './services/mediainfo.server';

type Bindings = {
  // Service Bindings are secure by default, but we can verify a shared secret if needed.
  // Generally not required if "private: true" is set in wrangler.jsonc
  ANALYZE_API_KEY?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Health check
app.get('/', (c) => c.text('MediaPeek Analyzer API'));

// RPC Route
const routes = app.post(
  '/analyze',
  sValidator('json', analyzeSchema),
  async (c) => {
    const { url, format } = c.req.valid('json');

    try {
      // 1. Fetch
      const {
        buffer,
        fileSize,
        filename,
        diagnostics: fetchDiag,
      } = await fetchMediaChunk(url);

      // 2. Analyze (with CPU budget check)
      const { results, diagnostics: analysisDiag } = await analyzeMediaBuffer(
        buffer,
        fileSize,
        filename,
        format,
      );

      return c.json({
        success: true as const,
        requestId: c.req.header('cf-ray') || crypto.randomUUID(),
        fileSize,
        results,
        diagnostics: {
          fetch: fetchDiag,
          analysis: analysisDiag,
        },
      });
    } catch (error) {
      console.error('Analysis Failed:', error);
      let status = 500;
      let code: AnalyzeErrorCode = 'INTERNAL_ERROR';
      let message = 'Internal Server Error';
      let retryable = false;

      if (error instanceof CpuBudgetExceededError) {
        status = 503;
        code = 'CPU_BUDGET_EXCEEDED';
        message = 'Analysis too heavy for this worker tier.';
        retryable = true;
      } else if (error instanceof Error) {
        message = error.message;
        if (message.includes('Fetch stream')) {
          code = 'UPSTREAM_FETCH_FAILED';
          status = 502;
          retryable = true;
        }
      }

      return c.json(
        {
          success: false as const,
          requestId: c.req.header('cf-ray') || crypto.randomUUID(),
          error: {
            code,
            message,
            retryable,
          },
        },
        status as 500,
      );
    }
  },
);

export const route = app.route('/', routes);

export type AppType = typeof route;
export default app;
