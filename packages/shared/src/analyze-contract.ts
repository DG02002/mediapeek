import { z } from 'zod';

export const AnalyzeErrorCodeSchema = z.enum([
  'AUTH_REQUIRED',
  'AUTH_INVALID',
  'RATE_LIMITED',
  'VALIDATION_FAILED',
  'CPU_BUDGET_EXCEEDED',
  'UPSTREAM_FETCH_FAILED',
  'INTERNAL_ERROR',
]);

export type AnalyzeErrorCode = z.infer<typeof AnalyzeErrorCodeSchema>;

export const AnalyzeErrorSchema = z.object({
  code: AnalyzeErrorCodeSchema,
  message: z.string(),
  retryable: z.boolean(),
});

export const AnalyzeSuccessResponseSchema = z.object({
  success: z.literal(true),
  requestId: z.string(),
  results: z.record(z.string(), z.string()),
});

export const AnalyzeErrorResponseSchema = z.object({
  success: z.literal(false),
  requestId: z.string(),
  error: AnalyzeErrorSchema,
});

export const AnalyzeResponseSchema = z.union([
  AnalyzeSuccessResponseSchema,
  AnalyzeErrorResponseSchema,
]);

export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;
export type AnalyzeError = z.infer<typeof AnalyzeErrorSchema>;
