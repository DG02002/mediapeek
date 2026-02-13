import { z } from 'zod';

export const PrivateBinResponseSchema = z.object({
  status: z.number().describe('Status code from PrivateBin API (0 = success)'),
  id: z.string().describe('Unique paste ID'),
  url: z.string().optional().describe('Full URL to the paste (optional)'),
  deletetoken: z.string().describe('Token used to delete the paste'),
  message: z.string().optional().describe('Error message if status != 0'),
});

export type PrivateBinResponse = z.infer<typeof PrivateBinResponseSchema>;
