import { z } from 'zod';

export const analyzeSchema = z.object({
  url: z.string().url({ message: 'Invalid URL provided.' }).trim(),
  format: z.array(z.string()).default(['JSON']),
});

export const TurnstileResponseSchema = z.object({
  success: z.boolean(),
  'error-codes': z.array(z.string()).optional(),
  challenge_ts: z.string().optional(),
  hostname: z.string().optional(),
  action: z.string().optional(),
  cdata: z.string().optional(),
});

export type AnalyzeInput = z.infer<typeof analyzeSchema>;
export type TurnstileResponse = z.infer<typeof TurnstileResponseSchema>;
