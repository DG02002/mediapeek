import { isValidFilename } from "@mediapeek/shared/filename-resolution"
import { Result, Schema } from "effect"

import { cleanAudioTrackTitle, cleanSubtitleTrackTitle } from "~/lib/formatters"
import { MediaTrackJSONSchema } from "~/lib/media-info-schema"
import {
  isMediaStructureArray,
  isMediaStructureNumber,
  isMediaStructureRecord,
  isMediaStructureString,
  type MediaStructureObject,
  type MediaStructureValue,
} from "~/lib/media-structure"
import { getAccessibilityFeatures, getMediaBadges } from "~/lib/media-utils"
import type { MediaTrackJSON } from "~/types/media"

interface MediaReportParseError {
  readonly code: "missing-json" | "invalid-json" | "invalid-document"
  readonly message: string
}

interface ArchiveSizingReport {
  readonly confidence: "verified" | "estimated" | "unknown"
  readonly source?:
    | "zip-local-header"
    | "zip-central-directory"
    | "tar-header"
    | "unknown"
  readonly warning?: string
}

interface MediaFileReport {
  readonly displayName: string
  readonly duration?: string
  readonly size?: string
  readonly archive?: {
    readonly name: string
    readonly sizing: ArchiveSizingReport
  }
}

interface MediaFormatReport {
  readonly name?: string
  readonly info?: string
  readonly profile?: string
  readonly version?: string
}

interface ContainerReport {
  readonly format: MediaFormatReport
  readonly codecId?: string
  readonly compatibleCodecIds?: string
  readonly encodedDate?: string
  readonly encodedApplication?: string
  readonly uniqueId?: string
}

interface VideoTrackReport {
  readonly key: string
  readonly id?: string
  readonly uniqueId?: string
  readonly formatName?: string
  readonly formatInfo?: string
  readonly codecId?: string
  readonly formatProfile?: string
  readonly formatLevel?: string
  readonly formatTier?: string
  readonly width?: string
  readonly height?: string
  readonly displayAspectRatio?: string
  readonly displayAspectRatioText?: string
  readonly bitrate?: string
  readonly overallBitrate?: string
  readonly bitrateMode?: string
  readonly bitrateModeText?: string
  readonly bitsPerPixelFrame?: string
  readonly frameRate?: string
  readonly frameRateText?: string
  readonly originalFrameRate?: string
  readonly frameRateMode?: string
  readonly frameRateModeText?: string
  readonly colorPrimaries?: string
  readonly matrixCoefficients?: string
  readonly transferCharacteristics?: string
  readonly hdrFormat?: string
  readonly hdrProfile?: string
  readonly hdrCompatibility?: string
  readonly masteringDisplayPrimaries?: string
  readonly masteringDisplayLuminance?: string
  readonly colorSpace?: string
  readonly chromaSubsampling?: string
  readonly chromaSubsamplingText?: string
  readonly chromaSubsamplingPosition?: string
  readonly colorRange?: string
  readonly bitDepth?: string
  readonly bitDepthText?: string
  readonly standard?: string
  readonly scanType?: string
  readonly scanStoreMethod?: string
  readonly scanOrder?: string
  readonly encodedLibrary?: string
  readonly encodedLibraryName?: string
  readonly encodedLibraryVersion?: string
  readonly codecConfigurationBox?: string
}

interface AudioTrackReport {
  readonly key: string
  readonly order?: string
  readonly id?: string
  readonly uniqueId?: string
  readonly formatName?: string
  readonly formatText?: string
  readonly formatInfo?: string
  readonly formatCommercial?: string
  readonly formatCommercialIfAny?: string
  readonly formatProfile?: string
  readonly formatLevel?: string
  readonly formatTier?: string
  readonly formatEndianness?: string
  readonly formatSign?: string
  readonly formatMode?: string
  readonly codecId?: string
  readonly codecInfo?: string
  readonly language: string
  readonly title?: string
  readonly displayTitle?: string
  readonly channels?: string
  readonly channelsText?: string
  readonly channelPositions?: string
  readonly channelLayout?: string
  readonly isDefault: boolean
  readonly isForced: boolean
  readonly bitrate?: string
  readonly maximumBitrate?: string
  readonly bitrateMode?: string
  readonly bitrateModeText?: string
  readonly samplingRate?: string
  readonly samplingRateText?: string
  readonly bitDepth?: string
  readonly bitDepthText?: string
  readonly delay?: string
  readonly sourceDelay?: string
  readonly sourceDelaySource?: string
  readonly dialogueNormalization?: string
  readonly compressionMode?: string
  readonly compressionModeText?: string
  readonly encodedLibrary?: string
  readonly encodedLibraryText?: string
  readonly serviceKind?: string
  readonly serviceKindText?: string
  readonly codecConfigurationBox?: string
  readonly objectCount: number
  readonly globalStructure: MediaStructureObject
  readonly presentations: readonly MediaStructureValue[]
  readonly signalGroups: readonly MediaStructureValue[]
}

interface SubtitleTrackReport {
  readonly key: string
  readonly order?: string
  readonly id?: string
  readonly uniqueId?: string
  readonly formatName?: string
  readonly formatInfo?: string
  readonly codecId?: string
  readonly codecInfo?: string
  readonly language: string
  readonly title?: string
  readonly displayTitle?: string
  readonly isDefault: boolean
  readonly isForced: boolean
}

interface ChapterReport {
  readonly time: string
  readonly name: string
}

interface MediaAccessibilityReport {
  readonly sdh: boolean
  readonly closedCaptions: boolean
  readonly audioDescription: boolean
}

interface MediaReport {
  readonly file: MediaFileReport
  readonly container?: ContainerReport
  readonly videos: readonly VideoTrackReport[]
  readonly audios: readonly AudioTrackReport[]
  readonly subtitles: readonly SubtitleTrackReport[]
  readonly chapters: readonly ChapterReport[]
  readonly accessibility: MediaAccessibilityReport
  readonly badges: readonly string[]
  readonly engine?: {
    readonly name: string
    readonly version: string
    readonly url: string
  }
}

export type MediaReportParseResult =
  | MediaReportParseSuccess
  | { readonly ok: false; readonly error: MediaReportParseError }

interface MediaReportParseSuccess {
  readonly ok: true
  readonly report: MediaReport
}

type RawRecord = MediaStructureObject

type RawValue = MediaStructureValue

type NormalizedValue = RawValue | undefined

interface MutableRawRecord {
  [key: string]: RawValue
}

const normalizeValue = (value: RawValue): NormalizedValue => {
  if (isMediaStructureArray(value)) {
    return value
      .map(normalizeValue)
      .filter((item): item is RawValue => item !== undefined && item !== "")
  }

  if (!isMediaStructureRecord(value)) {
    return value === "" ? undefined : value
  }

  if ("#value" in value) {
    return normalizeValue(value["#value"])
  }

  const normalized: MutableRawRecord = {}

  for (const [key, child] of Object.entries(value)) {
    const normalizedChild = normalizeValue(child)

    if (normalizedChild !== undefined && normalizedChild !== "") {
      normalized[key] = normalizedChild
    }
  }

  return normalized
}

const text = (
  record: RawRecord | MediaTrackJSON | undefined,
  ...keys: string[]
) => {
  for (const key of keys) {
    const value = record?.[key]

    if (isMediaStructureString(value) && value.trim()) {
      return value
    }

    if (isMediaStructureNumber(value) && Number.isFinite(value)) {
      return String(value)
    }
  }

  return undefined
}

const trackKey = (kind: string, track: MediaTrackJSON, index: number) =>
  `${kind}:${text(track, "@typeorder", "ID", "UniqueID") ?? String(index + 1)}`

const format = (track: MediaTrackJSON): MediaFormatReport => ({
  name: text(track, "Format"),
  info: text(track, "Format_Info", "Format/Info"),
  profile: text(track, "Format_Profile"),
  version: text(track, "Format_Version"),
})

const language = (track: MediaTrackJSON) =>
  text(track, "Language_String", "Language") ?? "Unknown"

const yes = (track: MediaTrackJSON, key: string) =>
  text(track, key)?.toLowerCase() === "yes"

const audioStructure = (track: MediaTrackJSON) => {
  const extra = isMediaStructureRecord(track.extra) ? track.extra : {}

  const globalKeys = [
    "SignalGroupCount",
    "DrcSets_Count",
    "DrcSets_Effects",
    "Loudness_Count",
    "SamplePeakLevel",
    "Loudness_Anchor",
    "Loudness_Program",
    "ChannelMode",
    "BedChannelConfiguration",
  ]

  const globalStructure = Object.fromEntries(
    globalKeys.flatMap((key) =>
      extra[key] === undefined ? [] : [[key, extra[key]]]
    )
  )

  const presentations = isMediaStructureArray(extra.Presentation)
    ? extra.Presentation
    : []

  const signalGroups = isMediaStructureArray(extra.SignalGroup)
    ? extra.SignalGroup
    : []

  const dynamicObjectCount = Number(text(extra, "NumberOfDynamicObjects") ?? 0)
  let signalObjectCount = 0

  for (const group of signalGroups) {
    if (!isMediaStructureRecord(group)) {
      continue
    }

    signalObjectCount += Number(text(group, "NumberOfObjects") ?? 0)
  }

  return {
    extra,
    globalStructure,
    presentations,
    signalGroups,
    objectCount: dynamicObjectCount || signalObjectCount,
  }
}

const parseChapters = (track: MediaTrackJSON | undefined): ChapterReport[] => {
  const extra = isMediaStructureRecord(track?.extra) ? track.extra : undefined

  if (!extra) {
    return []
  }

  return Object.entries(extra)
    .flatMap(([key, value]) => {
      const match = /^_(\d{2})_(\d{2})_(\d{2})_(\d{3})$/.exec(key)

      if (!match || !isMediaStructureString(value)) {
        return []
      }

      return [
        {
          time: `${match[1]}:${match[2]}:${match[3]}.${match[4]}`,
          name: value.replace(/^[a-z]{2}:/, ""),
        },
      ]
    })
    .toSorted((first, second) => first.time.localeCompare(second.time))
}

const basename = (sourceUrl: string) => {
  try {
    const { pathname } = new URL(sourceUrl)

    return decodeURIComponent(pathname.split("/").pop() ?? "") || "Unknown"
  } catch {
    return "Unknown"
  }
}

const displayName = (value: string | undefined, sourceUrl: string) => {
  const name = value?.split("/").pop()?.split("\\").pop() ?? value

  return name && isValidFilename(name) ? name : basename(sourceUrl)
}

const createFileReport = (
  general: MediaTrackJSON | undefined,
  sourceUrl: string
): MediaFileReport => {
  const archiveName = text(general, "Archive_Name")
  const archiveStatus = text(general, "Archive_Sizing_Status")

  const fileBase = {
    displayName: displayName(
      text(general, "CompleteName", "File_Name"),
      sourceUrl
    ),
    duration: text(general, "Duration_String", "Duration/String", "Duration"),
    size: text(general, "FileSize_String", "FileSize/String", "FileSize"),
  }

  if (!archiveName) {
    return fileBase
  }

  const archiveSizingSource = Schema.decodeUnknownResult(
    Schema.Literals([
      "zip-local-header",
      "zip-central-directory",
      "tar-header",
      "unknown",
    ])
  )(text(general, "Archive_Sizing_Source"))

  return {
    ...fileBase,
    archive: {
      name: displayName(archiveName, ""),
      sizing: {
        confidence:
          archiveStatus === "verified" || archiveStatus === "estimated"
            ? archiveStatus
            : "unknown",
        source: Result.isSuccess(archiveSizingSource)
          ? archiveSizingSource.success
          : undefined,
        warning: text(general, "Archive_Sizing_Warning"),
      },
    },
  }
}

const toAudioTrackReport = (
  track: MediaTrackJSON,
  index: number
): AudioTrackReport => {
  const structure = audioStructure(track)
  const trackLanguage = language(track)
  const title = text(track, "Title")
  const displayTitle = cleanAudioTrackTitle(title, track, trackLanguage)

  const audioReport: AudioTrackReport = {
    key: trackKey("audio", track, index),
    order: text(track, "@typeorder"),
    id: text(track, "ID"),
    uniqueId: text(track, "UniqueID"),
    formatName: text(track, "Format"),
    formatText: text(track, "Format_String"),
    formatInfo: text(track, "Format_Info"),
    formatCommercial: text(track, "Format_Commercial"),
    formatCommercialIfAny: text(track, "Format_Commercial_IfAny"),
    formatProfile: text(track, "Format_Profile"),
    formatLevel: text(track, "Format_Level"),
    formatTier: text(track, "Format_Tier"),
    formatEndianness: text(track, "Format_Settings_Endianness"),
    formatSign: text(track, "Format_Settings_Sign"),
    formatMode: text(track, "Format_Settings_Mode"),
    codecId: text(track, "CodecID"),
    codecInfo: text(track, "CodecID_Info"),
    language: trackLanguage,
    title,
    channels: text(track, "Channels", "Channel(s)"),
    channelsText: text(track, "Channels_String", "Channel(s)_String"),
    channelPositions: text(track, "ChannelPositions"),
    channelLayout: text(track, "ChannelLayout"),
    isDefault: yes(track, "Default"),
    isForced: yes(track, "Forced"),
    bitrate: text(track, "BitRate_String"),
    maximumBitrate: text(track, "BitRate_Maximum_String"),
    bitrateMode: text(track, "BitRate_Mode"),
    bitrateModeText: text(track, "BitRate_Mode_String"),
    samplingRate: text(track, "SamplingRate"),
    samplingRateText: text(track, "SamplingRate_String"),
    bitDepth: text(track, "BitDepth"),
    bitDepthText: text(track, "BitDepth_String"),
    delay: text(track, "Delay"),
    sourceDelay: text(structure.extra, "Source_Delay"),
    sourceDelaySource: text(structure.extra, "Source_Delay_Source"),
    dialogueNormalization: text(structure.extra, "dialnorm_String", "dialnorm"),
    compressionMode: text(track, "Compression_Mode"),
    compressionModeText: text(track, "Compression_Mode_String"),
    encodedLibrary: text(track, "Encoded_Library"),
    encodedLibraryText: text(track, "Encoded_Library_String"),
    serviceKind: text(track, "ServiceKind"),
    serviceKindText: text(track, "ServiceKind_String"),
    codecConfigurationBox: text(structure.extra, "CodecConfigurationBox"),
    objectCount: structure.objectCount,
    globalStructure: structure.globalStructure,
    presentations: structure.presentations,
    signalGroups: structure.signalGroups,
  }

  return displayTitle ? { ...audioReport, displayTitle } : audioReport
}

const toSubtitleTrackReport = (
  track: MediaTrackJSON,
  index: number
): SubtitleTrackReport => {
  const trackLanguage = language(track)
  const title = text(track, "Title")
  const displayTitle = cleanSubtitleTrackTitle(title, track, trackLanguage)

  const subtitleReport: SubtitleTrackReport = {
    key: trackKey("subtitle", track, index),
    order: text(track, "@typeorder"),
    id: text(track, "ID"),
    uniqueId: text(track, "UniqueID"),
    formatName: text(track, "Format"),
    formatInfo: text(track, "Format_Info"),
    codecId: text(track, "CodecID"),
    codecInfo: text(track, "CodecID_Info"),
    language: trackLanguage,
    title,
    isDefault: yes(track, "Default"),
    isForced: yes(track, "Forced"),
  }

  return displayTitle ? { ...subtitleReport, displayTitle } : subtitleReport
}

const toVideoTrackReport = (
  track: MediaTrackJSON,
  index: number
): VideoTrackReport => ({
  key: trackKey("video", track, index),
  id: text(track, "ID"),
  uniqueId: text(track, "UniqueID"),
  formatName: text(track, "Format"),
  formatInfo: text(track, "Format_Info", "Format/Info"),
  codecId: text(track, "CodecID"),
  formatProfile: text(track, "Format_Profile"),
  formatLevel: text(track, "Format_Level"),
  formatTier: text(track, "Format_Tier"),
  width: text(track, "Width"),
  height: text(track, "Height"),
  displayAspectRatio: text(track, "DisplayAspectRatio"),
  displayAspectRatioText: text(track, "DisplayAspectRatio_String"),
  bitrate: text(track, "BitRate_String"),
  overallBitrate: text(track, "OverallBitRate_String"),
  bitrateMode: text(track, "BitRate_Mode"),
  bitrateModeText: text(track, "BitRate_Mode_String"),
  bitsPerPixelFrame: text(track, "BitsPixel_Frame"),
  frameRate: text(track, "FrameRate"),
  frameRateText: text(track, "FrameRate_String"),
  originalFrameRate: text(track, "FrameRate_Original"),
  frameRateMode: text(track, "FrameRate_Mode"),
  frameRateModeText: text(track, "FrameRate_Mode_String"),
  colorPrimaries: text(track, "colour_primaries"),
  matrixCoefficients: text(track, "matrix_coefficients"),
  transferCharacteristics: text(track, "transfer_characteristics"),
  hdrFormat: text(track, "HDR_Format"),
  hdrProfile: text(track, "HDR_Format_Profile"),
  hdrCompatibility: text(track, "HDR_Format_Compatibility"),
  masteringDisplayPrimaries: text(track, "MasteringDisplay_ColorPrimaries"),
  masteringDisplayLuminance: text(track, "MasteringDisplay_Luminance"),
  colorSpace: text(track, "ColorSpace"),
  chromaSubsampling: text(track, "ChromaSubsampling"),
  chromaSubsamplingText: text(track, "ChromaSubsampling_String"),
  chromaSubsamplingPosition: text(track, "ChromaSubsampling_Position"),
  colorRange: text(track, "colour_range"),
  bitDepth: text(track, "BitDepth"),
  bitDepthText: text(track, "BitDepth_String"),
  standard: text(track, "Standard"),
  scanType: text(track, "ScanType"),
  scanStoreMethod: text(track, "ScanType_StoreMethod"),
  scanOrder: text(track, "ScanOrder"),
  encodedLibrary: text(track, "Encoded_Library"),
  encodedLibraryName: text(track, "Encoded_Library_Name"),
  encodedLibraryVersion: text(track, "Encoded_Library_Version"),
  codecConfigurationBox: text(
    isMediaStructureRecord(track.extra) ? track.extra : undefined,
    "CodecConfigurationBox"
  ),
})

const groupTrackRecords = (records: MediaTrackJSON[]) => ({
  general: records.find((track) => text(track, "@type") === "General"),
  menu: records.find((track) => text(track, "@type") === "Menu"),
  videos: records.filter((track) => text(track, "@type") === "Video"),
  audios: records.filter((track) => text(track, "@type") === "Audio"),
  subtitles: records.filter((track) => text(track, "@type") === "Text"),
})

const createContainerReport = (general: MediaTrackJSON): ContainerReport => ({
  format: format(general),
  codecId: text(general, "CodecID"),
  compatibleCodecIds: text(general, "CodecID_Compatible"),
  encodedDate: text(general, "Encoded_Date"),
  encodedApplication: text(general, "Encoded_Application"),
  uniqueId: text(general, "UniqueID_String", "UniqueID"),
})

const createEngineReport = (document: RawRecord) => {
  const library = isMediaStructureRecord(document.creatingLibrary)
    ? document.creatingLibrary
    : undefined

  const name = text(library, "name")
  const version = text(library, "version")
  const url = text(library, "url")

  return name && version && url ? { name, version, url } : undefined
}

const createMediaReport = (
  document: RawRecord,
  records: MediaTrackJSON[],
  sourceUrl: string
): MediaReportParseSuccess => {
  const tracks = groupTrackRecords(records)

  const accessibility = getAccessibilityFeatures(
    tracks.audios,
    tracks.subtitles,
    tracks.general
  )

  const container = tracks.general
    ? createContainerReport(tracks.general)
    : undefined

  const engine = createEngineReport(document)

  const report = {
    file: createFileReport(tracks.general, sourceUrl),
    videos: tracks.videos.map(toVideoTrackReport),
    audios: tracks.audios.map(toAudioTrackReport),
    subtitles: tracks.subtitles.map(toSubtitleTrackReport),
    chapters: parseChapters(tracks.menu),
    accessibility: {
      sdh: accessibility.hasSDH,
      closedCaptions: accessibility.hasCC,
      audioDescription: accessibility.hasAD,
    },
    badges: getMediaBadges({
      videoTracks: tracks.videos,
      audioTracks: tracks.audios,
      textTracks: tracks.subtitles,
      generalTrack: tracks.general,
    }),
  }

  if (container && engine) {
    return { ok: true, report: { ...report, container, engine } }
  }

  if (container) {
    return { ok: true, report: { ...report, container } }
  }

  if (engine) {
    return { ok: true, report: { ...report, engine } }
  }

  return { ok: true, report }
}

const invalidDocument = (): MediaReportParseResult => ({
  ok: false,
  error: {
    code: "invalid-document",
    message: "Analysis JSON does not contain media tracks.",
  },
})

export const parseMediaReport = ({
  json,
  sourceUrl,
}: {
  json: string
  sourceUrl: string
}): MediaReportParseResult => {
  if (!json.trim()) {
    return {
      ok: false,
      error: {
        code: "missing-json",
        message: "No JSON analysis is available.",
      },
    }
  }

  let parsedJson: unknown

  try {
    parsedJson = JSON.parse(json)
  } catch {
    return {
      ok: false,
      error: { code: "invalid-json", message: "Analysis JSON is malformed." },
    }
  }

  const decodedDocument = Schema.decodeUnknownResult(Schema.JsonObject)(
    parsedJson
  )

  if (Result.isFailure(decodedDocument)) {
    return invalidDocument()
  }

  const document = normalizeValue(decodedDocument.success)

  if (!isMediaStructureRecord(document)) {
    return invalidDocument()
  }

  const media = isMediaStructureRecord(document.media) ? document.media : null
  const tracks = media?.track

  if (!isMediaStructureArray(tracks)) {
    return invalidDocument()
  }

  const records = tracks.flatMap((track) => {
    const decodedTrack = Schema.decodeUnknownResult(MediaTrackJSONSchema)(track)

    return Result.isSuccess(decodedTrack) ? [decodedTrack.success] : []
  })

  return createMediaReport(document, records, sourceUrl)
}
