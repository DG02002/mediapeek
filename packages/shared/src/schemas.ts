import { Effect, Schema, SchemaGetter } from "effect"

import {
  analysisOutputFormats,
  AnalysisOutputIdSchema,
  type AnalysisOutputId,
} from "./analysis-output-formats"
import { AnalyzeFormatSchema } from "./analyze-contract"

const isValidUrl = (value: string): boolean => {
  try {
    const parsedUrl = new URL(value)

    return parsedUrl.href.length > 0
  } catch {
    return false
  }
}

const isHttpUrl = (value: string): boolean => {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

const httpUrlSchema = Schema.Trim.pipe(
  Schema.check(
    Schema.makeFilter(
      (value) => (isValidUrl(value) ? undefined : "Invalid URL provided."),
      { message: "Invalid URL provided." },
      true
    )
  ),
  Schema.check(
    Schema.makeFilter(
      (value) =>
        isHttpUrl(value)
          ? undefined
          : "Only HTTP and HTTPS URLs are supported.",
      { message: "Only HTTP and HTTPS URLs are supported." },
      true
    )
  )
)

const analyzeFormatSelectionSchema = Schema.UniqueArray(
  AnalyzeFormatSchema
).pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(5)))

const DEFAULT_ANALYZE_FORMATS: ReadonlyArray<AnalysisOutputId> = ["json"]

const canonicalAnalyzeFormatSchema = analyzeFormatSelectionSchema.pipe(
  Schema.decodeTo(Schema.Array(AnalysisOutputIdSchema), {
    decode: SchemaGetter.transform((formats) =>
      analysisOutputFormats.parse(formats)
    ),
    encode: SchemaGetter.transform((formats) => formats),
  })
)

export const AnalyzeInputSchema = Schema.Struct({
  url: httpUrlSchema,
  format: canonicalAnalyzeFormatSchema.pipe(
    Schema.withDecodingDefaultTypeKey(Effect.succeed(DEFAULT_ANALYZE_FORMATS))
  ),
})

export const analyzeSchema = Schema.toStandardSchemaV1(AnalyzeInputSchema)

export type AnalyzeInput = typeof AnalyzeInputSchema.Type

export const TurnstileResponseSchema = Schema.Struct({
  success: Schema.Boolean,
  "error-codes": Schema.optionalKey(Schema.Array(Schema.String)),
  challenge_ts: Schema.optionalKey(Schema.String),
  hostname: Schema.optionalKey(Schema.String),
  action: Schema.optionalKey(Schema.String),
  cdata: Schema.optionalKey(Schema.String),
})

export type TurnstileResponse = typeof TurnstileResponseSchema.Type
