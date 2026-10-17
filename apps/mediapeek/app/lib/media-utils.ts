import { extractFirstFileFromArchive as inspectFirstArchiveFile } from "@mediapeek/shared/archive-inspection"
import { Schema } from "effect"

import { MediaInfoJSONSchema } from "~/lib/media-info-schema"
import { MEDIA_CONSTANTS } from "~/lib/media/constants"
import type {
  MediaInfoJSON,
  MediaTrackExtra,
  MediaTrackJSON,
  MediaTrackValue,
} from "~/types/media"

export { isValidFilename } from "@mediapeek/shared/filename-resolution"

/**
 * Checks if the filename indicates an Apple TV source.
 */
const isAppleTvFilename = (filename: string): boolean => {
  const normalized = filename.toLowerCase()

  return (
    normalized.includes("aptv") ||
    normalized.includes("atvp") ||
    normalized.includes("apple tv+") ||
    normalized.includes("apple tv")
  )
}

/**
 * Derived accessibility feature flags.
 */
export interface AccessibilityFeatures {
  hasSDH: boolean
  hasCC: boolean
  hasAD: boolean
}

/**
 * Detects accessibility features present in the tracks.
 */
export const getAccessibilityFeatures = (
  audioTracks: MediaTrackJSON[],
  textTracks: MediaTrackJSON[],
  generalTrack?: MediaTrackJSON
): AccessibilityFeatures => {
  // Subtitle Tech (SDH & CC)
  const hasSDH = textTracks.some((t) => (t.Title ?? "").includes("SDH"))

  const hasCC =
    textTracks.some((t) => {
      const title = (t.Title ?? "").toLowerCase()
      const format = (t.Format ?? "").toLowerCase()

      return (
        title.includes("cc") ||
        title.includes("closed captions") ||
        format.includes("closed captions")
      )
    }) ||
    // Apple TV Check
    (() => {
      if (!generalTrack) {
        return false
      }

      const fileName = (
        generalTrack.File_Name ??
        generalTrack.CompleteName ?? // Fallback
        ""
      ).toLowerCase()

      if (!isAppleTvFilename(fileName)) {
        return false
      }

      // If Apple TV, check for SRT, tx3g, or UTF-8 text tracks
      return textTracks.some((t) => {
        const format = (t.Format ?? "").toLowerCase()
        const codecID = (t.CodecID ?? "").toLowerCase()

        return (
          format.includes("srt") ||
          format.includes("subrip") ||
          format.includes("timed text") ||
          format.includes("utf-8") ||
          codecID.includes("tx3g") ||
          codecID.includes("utf8")
        )
      })
    })()

  // Audio Description (AD)
  const hasAD = audioTracks.some((a) => {
    const title = (a.Title ?? "").toLowerCase()
    const serviceKind = (a.ServiceKind ?? "").toLowerCase()

    return (
      title.includes("ad") ||
      title.includes("audio description") ||
      title.includes("commentary") ||
      serviceKind.includes("audio description") ||
      serviceKind.includes("visually impaired")
    )
  })

  return { hasSDH, hasCC, hasAD }
}

const getVideoDimensionBadges = (
  videoTrack: MediaTrackJSON,
  generalTrack: MediaTrackJSON | undefined
) => {
  const { BADGES, TOKENS } = MEDIA_CONSTANTS
  const badges: string[] = []
  const width = Number(videoTrack.Width ?? "0")

  if (!Number.isNaN(width)) {
    if (width >= 3840) {
      badges.push(BADGES.RESOLUTION_4K)
    } else if (width >= 1920) {
      badges.push(BADGES.RESOLUTION_HD)
    } else if (width <= 1280) {
      badges.push(BADGES.RESOLUTION_SD)
    }
  }

  const aspectRatio = Number(videoTrack.DisplayAspectRatio ?? 0)

  const isImaxRatio =
    Math.abs(aspectRatio - 1.43) < 0.02 || Math.abs(aspectRatio - 1.9) < 0.02

  const filename = generalTrack?.CompleteName ?? generalTrack?.File_Name ?? ""

  const displayFilename =
    filename.split("/").pop()?.split("\\").pop() ?? filename

  if (
    displayFilename.toUpperCase().includes(TOKENS.IMAX.toUpperCase()) ||
    isImaxRatio
  ) {
    badges.push(BADGES.IMAX)
  }

  return badges
}

const getVideoFormatBadges = (videoTrack: MediaTrackJSON) => {
  const { BADGES, TOKENS } = MEDIA_CONSTANTS
  const badges: string[] = []
  const hdrFormat = videoTrack.HDR_Format ?? ""
  const hdrCompatibility = videoTrack.HDR_Format_Compatibility ?? ""

  if (
    hdrFormat.includes(TOKENS.HDR10_PLUS) ||
    hdrCompatibility.includes(TOKENS.HDR10_PLUS)
  ) {
    badges.push(BADGES.HDR10_PLUS)
  } else if (hdrFormat.includes("HDR") || hdrCompatibility.includes("HDR10")) {
    badges.push(BADGES.HDR)
  }

  if (hdrFormat.includes("Dolby Vision")) {
    badges.push(BADGES.DOLBY_VISION)
  }

  if (videoTrack.Format === "AV1") {
    badges.push(BADGES.AV1)
  }

  return badges
}

const getVideoBadges = (
  videoTracks: MediaTrackJSON[],
  generalTrack: MediaTrackJSON | undefined
) => {
  const primaryVideoTrack = videoTracks.at(0)

  if (!primaryVideoTrack) {
    return []
  }

  return [
    ...getVideoDimensionBadges(primaryVideoTrack, generalTrack),
    ...getVideoFormatBadges(primaryVideoTrack),
  ]
}

const getAudioTechnologyFeatures = (track: MediaTrackJSON) => {
  const { TOKENS } = MEDIA_CONSTANTS

  const combined =
    `${track.Format ?? ""}${track.Format_Commercial_IfAny ?? ""}${track.Title ?? ""}`.toLowerCase()

  const additionalFeatures = track.Format_AdditionalFeatures ?? ""
  const hasDTSX = additionalFeatures.includes("XLL X")

  return {
    hasAtmos: combined.includes(TOKENS.ATMOS),
    hasDTSX,
    hasDTS:
      !hasDTSX &&
      (additionalFeatures.includes(TOKENS.XLL) ||
        combined.includes(TOKENS.DTS)),
    hasDolby:
      combined.includes(TOKENS.DOLBY) ||
      combined.includes(TOKENS.AC3) ||
      combined.includes(TOKENS.EAC3),
  }
}

const getAudioTechnologyBadges = (audioTracks: MediaTrackJSON[]) => {
  const { BADGES } = MEDIA_CONSTANTS
  const features = audioTracks.map(getAudioTechnologyFeatures)
  const hasAtmos = features.some(({ hasAtmos: includesAtmos }) => includesAtmos)
  const hasDTSX = features.some(({ hasDTSX: includesDTSX }) => includesDTSX)
  const hasDTS = features.some(({ hasDTS: includesDTS }) => includesDTS)
  const hasDolby = features.some(({ hasDolby: includesDolby }) => includesDolby)
  const badges: string[] = []

  if (hasAtmos) {
    badges.push(BADGES.DOLBY_ATMOS)
  } else if (hasDolby && !hasDTS && !hasDTSX) {
    badges.push(BADGES.DOLBY_AUDIO)
  }

  if (hasDTSX) {
    badges.push(BADGES.DTS_X)
  } else if (hasDTS) {
    badges.push(BADGES.DTS)
  }

  return badges
}

const parseTrackNumber = (value: MediaTrackValue) => {
  if (Schema.is(Schema.Number)(value)) {
    return value
  }

  return Schema.is(Schema.String)(value) ? Number(value) : 0
}

const getSamplingRate = (track: MediaTrackJSON) => {
  const rawRate = track.SamplingRate

  if (!Schema.is(Schema.String)(rawRate)) {
    return parseTrackNumber(rawRate)
  }

  const parsedRate = Number.parseFloat(rawRate.replaceAll(/[^0-9.]/g, ""))

  return rawRate.toLowerCase().includes("k") ? parsedRate * 1000 : parsedRate
}

const getBitDepth = (track: MediaTrackJSON) => {
  const rawDepth = track.BitDepth

  if (Schema.is(Schema.Number)(rawDepth)) {
    return rawDepth
  }

  if (Schema.is(Schema.String)(rawDepth)) {
    return Number.parseInt(rawDepth.replaceAll(/\D/g, ""), 10)
  }

  const title = track.Title ?? ""
  const titleMatch = /(\d+)\s*bits?/i.exec(title)

  return titleMatch ? Number.parseInt(titleMatch[1] ?? "", 10) : 0
}

const isLosslessTrack = (track: MediaTrackJSON) => {
  const bitDepth = getBitDepth(track)
  const samplingRate = getSamplingRate(track)

  const compressionMode = Schema.is(Schema.String)(track.Compression_Mode)
    ? track.Compression_Mode.toLowerCase()
    : ""

  const format = track.Format?.toLowerCase() ?? ""

  const isKnownLosslessFormat = [
    "alac",
    "flac",
    "pcm",
    "wave",
    "wav",
    "ape",
    "wavpack",
    "truehd",
    "mlp",
  ].includes(format)

  return {
    lossless:
      compressionMode === "lossless" || bitDepth >= 16 || isKnownLosslessFormat,
    hiRes: bitDepth >= 24 && samplingRate > 44100,
  }
}

const getAudioQualityBadge = (audioTracks: MediaTrackJSON[]) => {
  const { BADGES } = MEDIA_CONSTANTS
  let hasHiResLossless = false
  let hasLossless = false

  for (const track of audioTracks) {
    const quality = isLosslessTrack(track)

    if (quality.lossless && quality.hiRes) {
      hasHiResLossless = true
    } else if (quality.lossless) {
      hasLossless = true
    }
  }

  if (hasHiResLossless) {
    return BADGES.HI_RES_LOSSLESS
  }

  return hasLossless ? BADGES.LOSSLESS : undefined
}

export interface MediaBadgeInput {
  videoTracks: MediaTrackJSON[]
  audioTracks: MediaTrackJSON[]
  textTracks: MediaTrackJSON[]
  generalTrack?: MediaTrackJSON
}

export const getMediaBadges = ({
  videoTracks,
  audioTracks,
  textTracks,
  generalTrack,
}: MediaBadgeInput): string[] => {
  const badges = getVideoBadges(videoTracks, generalTrack)
  badges.push(...getAudioTechnologyBadges(audioTracks))
  const audioQualityBadge = getAudioQualityBadge(audioTracks)

  if (audioQualityBadge) {
    badges.push(audioQualityBadge)
  }

  const accessibility = getAccessibilityFeatures(
    audioTracks,
    textTracks,
    generalTrack
  )

  const { BADGES } = MEDIA_CONSTANTS

  if (accessibility.hasCC) {
    badges.push(BADGES.CC)
  }

  if (accessibility.hasSDH) {
    badges.push(BADGES.SDH)
  }

  if (accessibility.hasAD) {
    badges.push(BADGES.AD)
  }

  return badges
}

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

/**
 * Extracts the filename of the first significant file (non-directory) from a Zip or Tar archive buffer.
 *
 * Supported formats:
 * - ZIP (Standard PKZip)
 * - TAR (USTAR/GNU Tar with LongLink support)
 *
 * @param buffer - The raw byte buffer of the archive (verified safe for Node.js/Cloudflare Workers)
 */
export function extractFirstFileFromArchive(buffer: Uint8Array): string | null {
  return inspectFirstArchiveFile(buffer)
}
