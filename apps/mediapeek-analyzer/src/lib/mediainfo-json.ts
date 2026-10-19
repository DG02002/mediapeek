import { Result, Schema } from "effect"
import type { MediaInfoResult as LibraryMediaInfoResult } from "mediainfo.js"

export type JsonMediaInfo = typeof Schema.Json.Type

const JsonRecord = Schema.Record(Schema.String, Schema.Json)

const MediaInfoTrackSchema = Schema.StructWithRest(
  Schema.Struct({
    "@type": Schema.String,
    CompleteName: Schema.optionalKey(Schema.String),
    Complete_name: Schema.optionalKey(Schema.String),
    File_Name: Schema.optionalKey(Schema.String),
    Title: Schema.optionalKey(Schema.String),
    Movie: Schema.optionalKey(Schema.String),
    Archive_Name: Schema.optionalKey(Schema.String),
    Archive_Sizing_Status: Schema.optionalKey(
      Schema.Literals(["verified", "estimated"])
    ),
    Archive_Sizing_Source: Schema.optionalKey(
      Schema.Literals([
        "zip-local-header",
        "zip-central-directory",
        "tar-header",
        "unknown",
      ])
    ),
    Archive_Sizing_Warning: Schema.optionalKey(Schema.String),
  }),
  [JsonRecord]
)

const MediaInfoMediaSchema = Schema.StructWithRest(
  Schema.Struct({
    track: Schema.optionalKey(Schema.Array(MediaInfoTrackSchema)),
  }),
  [JsonRecord]
)

export const MediaInfoResultSchema = Schema.StructWithRest(
  Schema.Struct({ media: Schema.optionalKey(MediaInfoMediaSchema) }),
  [JsonRecord]
)

export type MediaInfoResult = typeof MediaInfoResultSchema.Type

export type MediaInfoTrack = NonNullable<
  NonNullable<MediaInfoResult["media"]>["track"]
>[number]

const isJsonArray = Schema.is(Schema.Array(Schema.Json))
const isJsonObject = Schema.is(Schema.JsonObject)

const normalizeJsonMediaInfo = (data: JsonMediaInfo): JsonMediaInfo => {
  if (isJsonArray(data)) {
    return data.map((item) => normalizeJsonMediaInfo(item))
  }

  if (isJsonObject(data)) {
    const wrappedValue = data["#value"]

    if (wrappedValue !== undefined) {
      return normalizeJsonMediaInfo(wrappedValue)
    }

    const normalized: Record<string, JsonMediaInfo> = {}

    for (const [key, value] of Object.entries(data)) {
      normalized[key] = normalizeJsonMediaInfo(value)
    }

    return normalized
  }

  return data
}

export const normalizeMediaInfo = (
  data: JsonMediaInfo | LibraryMediaInfoResult
): JsonMediaInfo => {
  const decoded = Schema.decodeUnknownResult(Schema.Json)(data)

  if (Result.isFailure(decoded)) {
    throw new Error("MediaInfo returned a non-JSON result.")
  }

  return normalizeJsonMediaInfo(decoded.success)
}
