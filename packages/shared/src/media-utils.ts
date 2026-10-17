import { Schema } from "effect"

import {
  FOUR_K_WIDTH_PX,
  HIGH_DEFINITION_WIDTH_PX,
  HIGH_RES_LOSSLESS_MIN_BIT_DEPTH_BITS,
  HIGH_RES_LOSSLESS_MIN_SAMPLE_RATE_HZ,
  IMAX_ASPECT_RATIO_TOLERANCE,
  IMAX_STANDARD_ASPECT_RATIO,
  IMAX_WIDE_ASPECT_RATIO,
  LOSSLESS_MIN_BIT_DEPTH_BITS,
  STANDARD_DEFINITION_WIDTH_PX,
} from "./constants"
import { MEDIA_CONSTANTS, type MediaTrackJSON } from "./media"

export interface AccessibilityFeatures {
  readonly hasSDH: boolean
  readonly hasCC: boolean
  readonly hasAD: boolean
}

export interface MediaBadgeInput {
  readonly videoTracks: readonly MediaTrackJSON[]
  readonly audioTracks: readonly MediaTrackJSON[]
  readonly textTracks: readonly MediaTrackJSON[]
  readonly generalTrack?: MediaTrackJSON
}

const isNumber = Schema.is(Schema.Number)
const isString = Schema.is(Schema.String)

const KNOWN_LOSSLESS_AUDIO_FORMATS = new Set([
  "alac",
  "flac",
  "pcm",
  "wave",
  "wav",
  "ape",
  "wavpack",
  "truehd",
  "mlp",
])

export const isAppleTvFilename = (filename: string): boolean => {
  const normalized = filename.toLowerCase()

  return (
    normalized.includes("aptv") ||
    normalized.includes("atvp") ||
    normalized.includes("apple tv+") ||
    normalized.includes("apple tv")
  )
}

export const getAccessibilityFeatures = (
  audioTracks: readonly MediaTrackJSON[],
  textTracks: readonly MediaTrackJSON[],
  generalTrack?: MediaTrackJSON
): AccessibilityFeatures => {
  const hasSDH = textTracks.some((track) => (track.Title ?? "").includes("SDH"))

  const hasCCFromSubtitle = textTracks.some((track) => {
    const title = (track.Title ?? "").toLowerCase()
    const format = (track.Format ?? "").toLowerCase()

    return (
      title.includes("cc") ||
      title.includes("closed captions") ||
      format.includes("closed captions")
    )
  })

  const filename = generalTrack?.File_Name ?? generalTrack?.CompleteName ?? ""

  const hasCCFromAppleTv =
    isAppleTvFilename(filename) &&
    textTracks.some((track) => {
      const format = (track.Format ?? "").toLowerCase()
      const codecId = (track.CodecID ?? "").toLowerCase()

      return (
        format.includes("srt") ||
        format.includes("subrip") ||
        format.includes("timed text") ||
        format.includes("utf-8") ||
        codecId.includes("tx3g") ||
        codecId.includes("utf8")
      )
    })

  const hasCC = hasCCFromSubtitle || hasCCFromAppleTv

  const hasAD = audioTracks.some((track) => {
    const title = (track.Title ?? "").toLowerCase()
    const serviceKind = (track.ServiceKind ?? "").toLowerCase()

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

const getResolutionBadge = (rawWidth?: string): string | undefined => {
  const width = Number(rawWidth ?? "0")

  if (Number.isNaN(width)) {
    return undefined
  }

  if (width >= FOUR_K_WIDTH_PX) {
    return MEDIA_CONSTANTS.BADGES.RESOLUTION_4K
  }

  if (width >= HIGH_DEFINITION_WIDTH_PX) {
    return MEDIA_CONSTANTS.BADGES.RESOLUTION_HD
  }

  if (width <= STANDARD_DEFINITION_WIDTH_PX) {
    return MEDIA_CONSTANTS.BADGES.RESOLUTION_SD
  }

  return undefined
}

const getVideoBadges = (
  videoTracks: readonly MediaTrackJSON[],
  generalTrack?: MediaTrackJSON
): string[] => {
  const badges: string[] = []
  const [firstVideoTrack] = videoTracks

  if (firstVideoTrack) {
    const resolutionBadge = getResolutionBadge(firstVideoTrack.Width)

    if (resolutionBadge) {
      badges.push(resolutionBadge)
    }

    const filename = generalTrack?.CompleteName ?? generalTrack?.File_Name ?? ""

    const displayFilename =
      filename.split("/").pop()?.split("\\").pop() ?? filename

    const aspectRatio = Number(firstVideoTrack.DisplayAspectRatio ?? 0)

    const hasImaxAspectRatio =
      Math.abs(aspectRatio - IMAX_STANDARD_ASPECT_RATIO) <
        IMAX_ASPECT_RATIO_TOLERANCE ||
      Math.abs(aspectRatio - IMAX_WIDE_ASPECT_RATIO) <
        IMAX_ASPECT_RATIO_TOLERANCE

    if (
      displayFilename.toUpperCase().includes(MEDIA_CONSTANTS.TOKENS.IMAX) ||
      hasImaxAspectRatio
    ) {
      badges.push(MEDIA_CONSTANTS.BADGES.IMAX)
    }

    badges.push(...getVideoHdrBadges(firstVideoTrack))

    if (videoTracks.some((track) => track.Format === "AV1")) {
      badges.push(MEDIA_CONSTANTS.BADGES.AV1)
    }
  }

  return badges
}

const getVideoHdrBadges = (track: MediaTrackJSON): string[] => {
  const badges: string[] = []
  const hdrFormat = track.HDR_Format ?? ""
  const hdrCompatibility = track.HDR_Format_Compatibility ?? ""

  if (
    hdrFormat.includes(MEDIA_CONSTANTS.TOKENS.HDR10_PLUS) ||
    hdrCompatibility.includes(MEDIA_CONSTANTS.TOKENS.HDR10_PLUS)
  ) {
    badges.push(MEDIA_CONSTANTS.BADGES.HDR10_PLUS)
  } else if (hdrFormat.includes("HDR") || hdrCompatibility.includes("HDR10")) {
    badges.push(MEDIA_CONSTANTS.BADGES.HDR)
  }

  if (hdrFormat.includes("Dolby Vision")) {
    badges.push(MEDIA_CONSTANTS.BADGES.DOLBY_VISION)
  }

  return badges
}

interface AudioCodecFlags {
  hasAtmos: boolean
  hasDtsX: boolean
  hasDts: boolean
  hasDolby: boolean
}

const getAudioTrackCodecFlags = (track: MediaTrackJSON): AudioCodecFlags => {
  const format = track.Format ?? ""
  const commercial = track.Format_Commercial_IfAny ?? ""
  const title = track.Title ?? ""
  const features = track.Format_AdditionalFeatures ?? ""
  const combined = `${format}${commercial}${title}`.toLowerCase()
  const isDtsX = features.includes("XLL X")

  return {
    hasAtmos: combined.includes(MEDIA_CONSTANTS.TOKENS.ATMOS),
    hasDtsX: isDtsX,
    hasDts:
      !isDtsX &&
      (features.includes(MEDIA_CONSTANTS.TOKENS.XLL) ||
        combined.includes(MEDIA_CONSTANTS.TOKENS.DTS)),
    hasDolby:
      combined.includes(MEDIA_CONSTANTS.TOKENS.DOLBY) ||
      combined.includes(MEDIA_CONSTANTS.TOKENS.AC3) ||
      combined.includes(MEDIA_CONSTANTS.TOKENS.EAC3),
  }
}

const getAudioCodecFlags = (
  audioTracks: readonly MediaTrackJSON[]
): AudioCodecFlags => {
  const flags: AudioCodecFlags = {
    hasAtmos: false,
    hasDtsX: false,
    hasDts: false,
    hasDolby: false,
  }

  for (const track of audioTracks) {
    const trackFlags = getAudioTrackCodecFlags(track)

    flags.hasAtmos ||= trackFlags.hasAtmos
    flags.hasDtsX ||= trackFlags.hasDtsX
    flags.hasDts ||= trackFlags.hasDts
    flags.hasDolby ||= trackFlags.hasDolby
  }

  return flags
}

const getAudioCodecBadges = (
  audioTracks: readonly MediaTrackJSON[]
): string[] => {
  const { hasAtmos, hasDtsX, hasDts, hasDolby } =
    getAudioCodecFlags(audioTracks)

  const badges: string[] = []

  if (hasAtmos) {
    badges.push(MEDIA_CONSTANTS.BADGES.DOLBY_ATMOS)
  } else if (hasDolby && !hasDts && !hasDtsX) {
    badges.push(MEDIA_CONSTANTS.BADGES.DOLBY_AUDIO)
  }

  if (hasDtsX) {
    badges.push(MEDIA_CONSTANTS.BADGES.DTS_X)
  } else if (hasDts) {
    badges.push(MEDIA_CONSTANTS.BADGES.DTS)
  }

  return badges
}

const getSampleRate = (value: string | number | undefined): number => {
  if (isNumber(value)) {
    return value
  }

  if (isString(value)) {
    const parsedRate = Number.parseFloat(value.replaceAll(/[^0-9.]/g, ""))

    return value.toLowerCase().includes("k") ? parsedRate * 1_000 : parsedRate
  }

  return 0
}

const getBitDepth = (
  value: string | number | undefined,
  title?: string
): number => {
  if (isNumber(value)) {
    return value
  }

  if (isString(value)) {
    const parsedDepth = Number.parseInt(value.replaceAll(/\D/g, ""), 10)

    if (parsedDepth) {
      return parsedDepth
    }
  }

  const titleMatch = title ? /(\d+)\s*bits?/i.exec(title) : null

  if (titleMatch) {
    return Number.parseInt(titleMatch[1], 10)
  }

  return 0
}

const getAudioQualityBadge = (
  audioTracks: readonly MediaTrackJSON[]
): string | undefined => {
  let hasHiResLossless = false
  let hasLossless = false

  for (const track of audioTracks) {
    const sampleRate = getSampleRate(track.SamplingRate)
    const bitDepth = getBitDepth(track.BitDepth, track.Title)

    const compressionMode = isString(track.Compression_Mode)
      ? track.Compression_Mode.toLowerCase()
      : ""

    const knownLosslessFormat = KNOWN_LOSSLESS_AUDIO_FORMATS.has(
      track.Format?.toLowerCase() ?? ""
    )

    const isLossless =
      compressionMode === "lossless" ||
      bitDepth >= LOSSLESS_MIN_BIT_DEPTH_BITS ||
      knownLosslessFormat

    if (!isLossless) {
      continue
    }

    if (
      bitDepth >= HIGH_RES_LOSSLESS_MIN_BIT_DEPTH_BITS &&
      sampleRate > HIGH_RES_LOSSLESS_MIN_SAMPLE_RATE_HZ
    ) {
      hasHiResLossless = true
    } else {
      hasLossless = true
    }
  }

  if (hasHiResLossless) {
    return MEDIA_CONSTANTS.BADGES.HI_RES_LOSSLESS
  }

  if (hasLossless) {
    return MEDIA_CONSTANTS.BADGES.LOSSLESS
  }

  return undefined
}

export const getMediaBadges = ({
  videoTracks,
  audioTracks,
  textTracks,
  generalTrack,
}: MediaBadgeInput): string[] => {
  const badges = getVideoBadges(videoTracks, generalTrack)

  badges.push(...getAudioCodecBadges(audioTracks))

  const audioQualityBadge = getAudioQualityBadge(audioTracks)

  if (audioQualityBadge) {
    badges.push(audioQualityBadge)
  }

  const accessibilityFeatures = getAccessibilityFeatures(
    audioTracks,
    textTracks,
    generalTrack
  )

  if (accessibilityFeatures.hasCC) {
    badges.push(MEDIA_CONSTANTS.BADGES.CC)
  }

  if (accessibilityFeatures.hasSDH) {
    badges.push(MEDIA_CONSTANTS.BADGES.SDH)
  }

  if (accessibilityFeatures.hasAD) {
    badges.push(MEDIA_CONSTANTS.BADGES.AD)
  }

  return badges
}
