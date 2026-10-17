import { Schema } from "effect"

import {
  AnalysisOutputRequestSchema,
  type AnalysisOutputRequest,
} from "./analysis-output-formats"

export const AnalyzeErrorCodeSchema = Schema.Literals([
  "AUTH_REQUIRED",
  "AUTH_INVALID",
  "RATE_LIMITED",
  "VALIDATION_FAILED",
  "CPU_BUDGET_EXCEEDED",
  "UPSTREAM_FETCH_FAILED",
  "INTERNAL_ERROR",
])

export type AnalyzeErrorCode = typeof AnalyzeErrorCodeSchema.Type

export const AnalyzeFormatSchema = AnalysisOutputRequestSchema

export const AnalyzeErrorSchema = Schema.Struct({
  code: AnalyzeErrorCodeSchema,
  message: Schema.String,
  retryable: Schema.Boolean,
})

export const AnalyzeSuccessResponseSchema = Schema.Struct({
  success: Schema.Literal(true),
  requestId: Schema.String,
  results: Schema.Record(Schema.String, Schema.String),
})

export const AnalyzeErrorResponseSchema = Schema.Struct({
  success: Schema.Literal(false),
  requestId: Schema.String,
  error: AnalyzeErrorSchema,
})

export const AnalyzeResponseSchema = Schema.Union([
  AnalyzeSuccessResponseSchema,
  AnalyzeErrorResponseSchema,
])

export const AnalyzerFetchDiagnosticsSchema = Schema.Struct({
  headRequestDurationMs: Schema.Number,
  fetchRequestDurationMs: Schema.Number,
  totalDurationMs: Schema.Number,
  isGoogleDrive: Schema.Boolean,
  resolvedFilename: Schema.String,
  resolvedFilenameSource: Schema.String,
  responseStatus: Schema.Number,
  probeMethod: Schema.String,
  firstByteReadTimeoutMs: Schema.optionalKey(Schema.Number),
  firstByteReadRetries: Schema.optionalKey(Schema.Number),
  firstByteReadStrategy: Schema.optionalKey(
    Schema.Literals(["range", "no_range_fallback"])
  ),
  seekFetchCount: Schema.optionalKey(Schema.Number),
  seekBytesFetched: Schema.optionalKey(Schema.Number),
  streamCloseError: Schema.optionalKey(Schema.String),
})

export const AnalyzerAnalysisDiagnosticsSchema = Schema.Struct({
  wasmLoadTimeMs: Schema.Number,
  factoryCreateTimeMs: Schema.Number,
  formatGenerationTimes: Schema.Record(Schema.String, Schema.Number),
  totalAnalysisTimeMs: Schema.Number,
  wasmLoadError: Schema.optionalKey(Schema.String),
  objectProcessError: Schema.optionalKey(Schema.String),
  formatErrors: Schema.Record(Schema.String, Schema.String),
  resolvedFilename: Schema.optionalKey(Schema.String),
  resolvedFilenameSource: Schema.optionalKey(Schema.String),
})

export const AnalyzerRpcSuccessResponseSchema = Schema.Struct({
  success: Schema.Literal(true),
  requestId: Schema.optionalKey(Schema.String),
  fileSize: Schema.optionalKey(Schema.Number),
  results: Schema.Record(Schema.String, Schema.String),
  diagnostics: Schema.Struct({
    fetch: AnalyzerFetchDiagnosticsSchema,
    analysis: AnalyzerAnalysisDiagnosticsSchema,
  }),
})

export const AnalyzerValidationIssueSchema = Schema.StructWithRest(
  Schema.Struct({ message: Schema.String }),
  [Schema.Record(Schema.String, Schema.Json)]
)

export const AnalyzerRpcErrorResponseSchema = Schema.Struct({
  success: Schema.Literal(false),
  requestId: Schema.optionalKey(Schema.String),
  error: Schema.Union([
    AnalyzeErrorSchema,
    Schema.Array(AnalyzerValidationIssueSchema),
  ]),
})

export const AnalyzerRpcResponseSchema = Schema.Union([
  AnalyzerRpcSuccessResponseSchema,
  AnalyzerRpcErrorResponseSchema,
])

export type AnalyzeResponse = typeof AnalyzeResponseSchema.Type

export type AnalyzeError = typeof AnalyzeErrorSchema.Type

export type AnalyzeFormat = AnalysisOutputRequest

export type AnalyzerRpcResponse = typeof AnalyzerRpcResponseSchema.Type

export type AnalyzerRpcSuccessResponse =
  typeof AnalyzerRpcSuccessResponseSchema.Type
