import { Schema } from "effect"

import type { MediaInfoJSON } from "~/types/media"

const isMediaInfoScalar = (value: Schema.Json) =>
  Schema.is(
    Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.Null])
  )(value)

const isMediaInfoExtraEntry = (value: Schema.Json) => {
  if (!Schema.is(Schema.JsonObject)(value)) {
    return false
  }

  return Object.values(value).every(isMediaInfoExtraValue)
}

function isMediaInfoExtraValue(value: Schema.Json): boolean {
  if (isMediaInfoScalar(value)) {
    return true
  }

  return (
    Schema.is(Schema.Array(Schema.Json))(value) &&
    value.every(isMediaInfoExtraEntry)
  )
}

const isMediaInfoTrack = (value: Schema.Json) => {
  if (
    !Schema.is(Schema.JsonObject)(value) ||
    !Schema.is(Schema.String)(value["@type"])
  ) {
    return false
  }

  return Object.entries(value).every(([key, property]) =>
    key === "extra"
      ? Schema.is(Schema.JsonObject)(property) &&
        Object.values(property).every(isMediaInfoExtraValue)
      : isMediaInfoScalar(property)
  )
}

const isMediaInfoJSON = (value: unknown): value is MediaInfoJSON => {
  if (!Schema.is(Schema.JsonObject)(value)) {
    return false
  }

  if (value.media !== undefined) {
    if (!Schema.is(Schema.JsonObject)(value.media)) {
      return false
    }

    const tracks = value.media.track

    if (
      !Schema.is(Schema.Array(Schema.Json))(tracks) ||
      !tracks.every(isMediaInfoTrack)
    ) {
      return false
    }
  }

  if (value.creatingLibrary !== undefined) {
    if (
      !Schema.is(Schema.JsonObject)(value.creatingLibrary) ||
      !Schema.is(Schema.String)(value.creatingLibrary.name) ||
      !Schema.is(Schema.String)(value.creatingLibrary.version) ||
      !Schema.is(Schema.String)(value.creatingLibrary.url)
    ) {
      return false
    }
  }

  return true
}

export const MediaInfoJSONSchema =
  Schema.declare<MediaInfoJSON>(isMediaInfoJSON)
