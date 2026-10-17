import { Schema } from "effect"

import { AnalyzeErrorSchema } from "./analyze-contract"

export const ANALYZE_PROGRESS_STREAM_CONTENT_TYPE = "application/x-ndjson"

export const AnalyzeProgressStageSchema = Schema.Literals([
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

export type AnalyzeProgressStage = typeof AnalyzeProgressStageSchema.Type

export const AnalyzeStreamProgressEventSchema = Schema.Struct({
  type: Schema.Literal("progress"),
  requestId: Schema.String,
  stage: AnalyzeProgressStageSchema,
  title: Schema.String,
  message: Schema.String,
})

export const AnalyzeStreamSuccessEventSchema = Schema.Struct({
  type: Schema.Literal("success"),
  requestId: Schema.String,
  results: Schema.Record(Schema.String, Schema.String),
})

export const AnalyzeStreamErrorEventSchema = Schema.Struct({
  type: Schema.Literal("error"),
  requestId: Schema.String,
  error: AnalyzeErrorSchema,
})

export const AnalyzeStreamEventSchema = Schema.Union([
  AnalyzeStreamProgressEventSchema,
  AnalyzeStreamSuccessEventSchema,
  AnalyzeStreamErrorEventSchema,
])

export type AnalyzeStreamProgressEvent =
  typeof AnalyzeStreamProgressEventSchema.Type

export type AnalyzeStreamSuccessEvent =
  typeof AnalyzeStreamSuccessEventSchema.Type

export type AnalyzeStreamErrorEvent = typeof AnalyzeStreamErrorEventSchema.Type

export type AnalyzeStreamEvent = typeof AnalyzeStreamEventSchema.Type

export const encodeAnalyzeStreamEvent = (event: AnalyzeStreamEvent) =>
  `${JSON.stringify(event)}\n`
