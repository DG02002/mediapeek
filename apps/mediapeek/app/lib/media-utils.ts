import { Schema } from "effect"

import { MediaInfoJSONSchema } from "~/lib/media-info-schema"
import type {
  MediaInfoJSON,
  MediaTrackExtra,
  MediaTrackJSON,
  MediaTrackValue,
} from "~/types/media"

const safeJsonString = (value: Schema.Json): string => {
  if (Schema.is(Schema.String)(value)) {
    return value
  }

  if (Schema.is(Schema.Number)(value) || Schema.is(Schema.Boolean)(value)) {
    return String(value)
  }

  if (Schema.is(Schema.Array(Schema.Json))(value)) {
    return value.map(safeJsonString).join(", ")
  }

  return Schema.is(Schema.JsonObject)(value) ? "[Object]" : ""
}

const safeMediaTrackValueString = (
  value: MediaTrackValue | MediaTrackExtra[keyof MediaTrackExtra]
): string => {
  if (value === undefined) {
    return ""
  }

  if (value === null) {
    return "null"
  }

  const serialized = JSON.stringify(value) ?? "null"
  const parsed = Schema.decodeUnknownSync(Schema.Json)(JSON.parse(serialized))

  return safeJsonString(parsed)
}

const removeEmptyJsonStrings = (
  value: Schema.Json
): Schema.Json | undefined => {
  if (Schema.is(Schema.String)(value)) {
    return value === "" ? undefined : value
  }

  if (Schema.is(Schema.Array(Schema.Json))(value)) {
    return value
      .map(removeEmptyJsonStrings)
      .filter((entry): entry is Schema.Json => entry !== undefined)
  }

  if (Schema.is(Schema.JsonObject)(value)) {
    const normalized: Record<string, Schema.Json> = {}

    for (const [key, property] of Object.entries(value)) {
      const cleaned = removeEmptyJsonStrings(property)

      if (cleaned !== undefined) {
        normalized[key] = cleaned
      }
    }

    return normalized
  }

  return value
}

export function removeEmptyStrings(data: MediaInfoJSON): MediaInfoJSON {
  const serialized = JSON.stringify(data) ?? "null"
  const parsed = Schema.decodeUnknownSync(Schema.Json)(JSON.parse(serialized))
  const cleaned = removeEmptyJsonStrings(parsed) ?? {}

  return Schema.decodeUnknownSync(MediaInfoJSONSchema)(cleaned)
}

export interface ChapterItem {
  time: string
  name: string
}

export const parseChapters = (
  menuTrack: MediaTrackJSON | undefined
): ChapterItem[] => {
  if (!menuTrack?.extra) {
    return []
  }

  // Extract chapters from 'extra' object
  // Keys like "_00_00_00_000"
  const timeRegex = /^_\d{2}_\d{2}_\d{2}_\d{3}$/

  return Object.entries(menuTrack.extra)
    .filter(([key]) => timeRegex.test(key))
    .map(([key, value]) => {
      // Convert "_00_00_00_000" to "00:00:00.000"
      const time = key.substring(1).replaceAll("_", (_match, offset) => {
        if (offset === 8) {
          return "."
        }

        return ":"
      })

      return {
        time,
        name: safeMediaTrackValueString(value),
      }
    })
    .toSorted((left, right) => left.time.localeCompare(right.time))
}
