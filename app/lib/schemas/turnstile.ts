import { z } from 'zod';

export const TurnstileResponseSchema = z.object({
  success: z.boolean().describe('Whether the token was validated successfully'),
  challenge_ts: z.string().optional().describe('Timestamp of the challenge'),
  hostname: z
    .string()
    .optional()
    .describe('Hostname of the site where the challenge was solved'),
  'error-codes': z
    .array(z.string())
    .optional()
    .describe('List of error codes if validation failed'),
});

export type TurnstileResponse = z.infer<typeof TurnstileResponseSchema>;
