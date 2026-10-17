import { z } from "zod"

import { AnalyzeErrorSchema } from "./analyze-contract"

export const ANALYZE_PROGRESS_STREAM_CONTENT_TYPE = "application/x-ndjson"

export const AnalyzeProgressStageSchema = z.enum([
  "request_received",
  "source_probe_started",
  "source_probe_completed",
  "initial_fetch_started",
  "waiting_for_first_byte",
  "first_byte_received",
  "initial_segment_reading",
  "no_range_fallback_started",
  "source_range_unsupported",
  "remote_seek_fetch_started",
  "analysis_started",
  "analysis_completed",
])

export type AnalyzeProgressStage = z.infer<typeof AnalyzeProgressStageSchema>

export const AnalyzeStreamProgressEventSchema = z.object({
  type: z.literal("progress"),
  requestId: z.string(),
  stage: AnalyzeProgressStageSchema,
  title: z.string(),
  message: z.string(),
})

export const AnalyzeStreamSuccessEventSchema = z.object({
  type: z.literal("success"),
  requestId: z.string(),
  results: z.record(z.string(), z.string()),
})

export const AnalyzeStreamErrorEventSchema = z.object({
  type: z.literal("error"),
  requestId: z.string(),
  error: AnalyzeErrorSchema,
})

export const AnalyzeStreamEventSchema = z.union([
  AnalyzeStreamProgressEventSchema,
  AnalyzeStreamSuccessEventSchema,
  AnalyzeStreamErrorEventSchema,
])

export type AnalyzeStreamProgressEvent = z.infer<
  typeof AnalyzeStreamProgressEventSchema
>

export type AnalyzeStreamSuccessEvent = z.infer<
  typeof AnalyzeStreamSuccessEventSchema
>

export type AnalyzeStreamErrorEvent = z.infer<
  typeof AnalyzeStreamErrorEventSchema
>

export type AnalyzeStreamEvent = z.infer<typeof AnalyzeStreamEventSchema>

export const encodeAnalyzeStreamEvent = (event: AnalyzeStreamEvent) =>
  `${JSON.stringify(event)}\n`
