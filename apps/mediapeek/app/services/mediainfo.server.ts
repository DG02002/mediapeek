import {
  ARCHIVE_SIZING_WARNING,
  type ArchiveEntryInspection,
} from "@mediapeek/shared/archive-inspection"
import {
  type FilenameSource,
  getMediaInfoMetadataFilename,
} from "@mediapeek/shared/filename-resolution"
import { Match, Option, Schema } from "effect"

import { DiagnosticsError } from "~/lib/error-utils"
import {
  extractFirstFileFromArchive,
  isArchiveExtension,
  normalizeMediaInfo,
} from "~/lib/media-utils"
import { createMediaInfo as createDefaultMediaInfo } from "~/services/mediainfo-factory.server"

const JsonRecord = Schema.Record(Schema.String, Schema.Json)

const MediaInfoTrackSchema = Schema.StructWithRest(
  Schema.Struct({ "@type": Schema.String }),
  [JsonRecord]
)

const MediaInfoMediaSchema = Schema.StructWithRest(
  Schema.Struct({
    track: Schema.optional(Schema.Array(MediaInfoTrackSchema)),
  }),
  [JsonRecord]
)

const MediaInfoResultSchema = Schema.StructWithRest(
  Schema.Struct({
    media: Schema.optional(MediaInfoMediaSchema),
  }),
  [JsonRecord]
)

export type MediaInfoResult = typeof MediaInfoResultSchema.Type

type MediaInfoTrack = typeof MediaInfoTrackSchema.Type

type MediaInfoData = MediaInfoResult | string

interface MutableMediaInfoTrack {
  "@type": string
  [key: string]: Schema.Json
}

export interface MediaInfoDiagnostics {
  wasmLoadTimeMs: number
  factoryCreateTimeMs: number
  formatGenerationTimes: Record<string, number>
  totalAnalysisTimeMs: number
  wasmLoadError?: string
  objectProcessError?: string
  formatErrors: Record<string, string>
}

export interface MediaInfoAnalysis {
  results: Record<string, string>
  diagnostics: MediaInfoDiagnostics
  resolvedFilename: string
  resolvedFilenameSource: FilenameSource
}

type MediaInfoFormat = "object" | "Text" | "XML" | "HTML"

export interface MediaInfoPort {
  options: {
    chunkSize: number
    coverData: boolean
    format: MediaInfoFormat
    full: boolean
  }
  analyzeData: (
    fileSize: () => number,
    readChunk: (
      chunkSize: number,
      offset: number
    ) => Uint8Array | Promise<Uint8Array>
  ) => Promise<MediaInfoData>
  inform: () => string
  reset: () => void
  close: () => void
}

export interface AnalyzeMediaBufferOptions {
  fileBuffer: Uint8Array
  fileSize?: number
  filename: string
  filenameSource?: FilenameSource
  requestedFormats?: string[]
  archiveEntry?: ArchiveEntryInspection
  createMediaInfo?: () => Promise<MediaInfoPort>
}

interface FormatRequest {
  type: MediaInfoFormat
  key: string
}

interface FilenameResolutionState {
  archiveInnerName: string | null
  displayFilename: string
  resolvedFilenameSource: FilenameSource
  archiveName: string | undefined
}

interface FormatGenerationOptions {
  formats: FormatRequest[]
  index: number
  infoInstance: MediaInfoPort
  effectiveFileSize: number
  readChunk: (chunkSize: number, offset: number) => Uint8Array
  filenameState: FilenameResolutionState
  filenameSource: FilenameSource
  archiveEntry: ArchiveEntryInspection | undefined
  diagnostics: MediaInfoDiagnostics
  results: Record<string, string>
}

const ALL_FORMATS: FormatRequest[] = [
  { type: "object", key: "json" },
  { type: "Text", key: "text" },
  { type: "XML", key: "xml" },
  { type: "HTML", key: "html" },
]

class DisposableMediaInfo implements Disposable {
  constructor(readonly instance: MediaInfoPort) {}

  [Symbol.dispose]() {
    this.instance.close()
  }
}

const createDiagnostics = (): MediaInfoDiagnostics => ({
  wasmLoadTimeMs: 0,
  factoryCreateTimeMs: 0,
  formatGenerationTimes: {},
  totalAnalysisTimeMs: 0,
  formatErrors: {},
})

const createFilenameState = (options: AnalyzeMediaBufferOptions) => {
  const archiveInnerName =
    options.archiveEntry?.name ??
    (isArchiveExtension(options.filename)
      ? extractFirstFileFromArchive(options.fileBuffer)
      : null)

  return {
    archiveInnerName,
    displayFilename: archiveInnerName ?? options.filename,
    resolvedFilenameSource: archiveInnerName
      ? "archive-inner"
      : (options.filenameSource ?? "url"),
    archiveName: archiveInnerName ? options.filename : undefined,
  } satisfies FilenameResolutionState
}

const selectFormats = (requestedFormats: string[] = []): FormatRequest[] => {
  const shouldGenerateAll = requestedFormats.includes("all")

  const selected = ALL_FORMATS.filter(
    (format) =>
      shouldGenerateAll ||
      requestedFormats.includes(format.key) ||
      requestedFormats.includes(format.type.toLowerCase())
  )

  return selected.length > 0 ? selected : [{ type: "object", key: "json" }]
}

const readLocalChunk =
  (fileBuffer: Uint8Array) => (chunkSize: number, offset: number) => {
    if (offset >= fileBuffer.byteLength) {
      return new Uint8Array(0)
    }

    return fileBuffer.subarray(
      offset,
      Math.min(offset + chunkSize, fileBuffer.byteLength)
    )
  }

const getErrorMessage = (cause: Error | string) =>
  cause instanceof Error ? cause.message : cause

const getTrackText = (track: MediaInfoTrack, key: string) => {
  const value = track[key]

  return Schema.is(Schema.String)(value) ? value : undefined
}

export const parseMediaInfoResultJson = (source: string): MediaInfoResult =>
  Schema.decodeUnknownSync(MediaInfoResultSchema)(JSON.parse(source))

const decodeObjectResult = (
  resultData: MediaInfoData,
  diagnostics: MediaInfoDiagnostics
) => {
  if (Schema.is(Schema.String)(resultData)) {
    diagnostics.objectProcessError =
      "MediaInfo returned text for the object format."

    return Option.none()
  }

  const serialized = JSON.stringify(resultData) ?? "null"

  const jsonResult = Schema.decodeUnknownSync(Schema.Json)(
    JSON.parse(serialized)
  )

  const normalized = normalizeMediaInfo(jsonResult)
  const decoded = Schema.decodeUnknownOption(MediaInfoResultSchema)(normalized)

  if (Option.isNone(decoded)) {
    diagnostics.objectProcessError =
      "MediaInfo returned data outside its JSON result contract."
  }

  return decoded
}

const updateGeneralTrack = (
  generalTrack: MediaInfoTrack,
  options: Pick<
    FormatGenerationOptions,
    "filenameState" | "filenameSource" | "archiveEntry"
  >
) => {
  const metadataFallback =
    !options.filenameState.archiveInnerName && options.filenameSource === "url"
      ? getMediaInfoMetadataFilename({
          Title: getTrackText(generalTrack, "Title"),
          Movie: getTrackText(generalTrack, "Movie"),
        })
      : undefined

  if (metadataFallback) {
    options.filenameState.displayFilename = metadataFallback.filename
    options.filenameState.resolvedFilenameSource = metadataFallback.source
  }

  const updatedTrack: MutableMediaInfoTrack = {
    ...generalTrack,
    CompleteName: options.filenameState.displayFilename,
  }

  if (options.filenameState.archiveName) {
    updatedTrack.Archive_Name = options.filenameState.archiveName
  }

  if (options.archiveEntry) {
    updatedTrack.Archive_Sizing_Status = options.archiveEntry.sizeStatus
    updatedTrack.Archive_Sizing_Source = options.archiveEntry.sizeSource

    if (options.archiveEntry.sizeStatus === "estimated") {
      updatedTrack.Archive_Sizing_Warning = ARCHIVE_SIZING_WARNING
    }
  }

  return updatedTrack
}

const serializeObjectResult = (
  resultData: MediaInfoData,
  options: Pick<
    FormatGenerationOptions,
    "filenameState" | "filenameSource" | "archiveEntry" | "diagnostics"
  >
) => {
  const decoded = decodeObjectResult(resultData, options.diagnostics)

  if (Option.isNone(decoded)) {
    return "{}"
  }

  const result = Option.getOrThrow(decoded)
  const tracks = result.media?.track

  if (!tracks) {
    return JSON.stringify(result)
  }

  const generalTrack = tracks.find((track) => track["@type"] === "General")

  if (!generalTrack) {
    return JSON.stringify(result)
  }

  const updatedTrack = updateGeneralTrack(generalTrack, options)

  return JSON.stringify({
    ...result,
    media: {
      ...result.media,
      track: tracks.map((track) =>
        track === generalTrack ? updatedTrack : track
      ),
    },
  })
}

const insertTextFilename = (source: string, filename: string) => {
  if (source.includes("Complete name")) {
    return source
  }

  const lines = source.split("\n")

  const generalIndex = lines.findIndex((line) =>
    line.trim().startsWith("General")
  )

  if (generalIndex === -1) {
    return source
  }

  const uniqueIdIndex = lines.findIndex(
    (line, index) => index > generalIndex && line.trim().startsWith("Unique ID")
  )

  const firstBlankIndex = lines.findIndex(
    (line, index) => index > generalIndex && line.trim() === ""
  )

  let insertIndex = generalIndex + 1

  if (uniqueIdIndex !== -1) {
    insertIndex = uniqueIdIndex + 1
  } else if (firstBlankIndex !== -1) {
    insertIndex = firstBlankIndex
  }

  const padding = " ".repeat(41 - "Complete name".length)

  lines.splice(insertIndex, 0, `Complete name${padding}: ${filename}`)

  return lines.join("\n")
}

const analyzeOneFormat = async (options: FormatGenerationOptions) => {
  const format = options.formats[options.index]

  if (!format) {
    return
  }

  const formatStart = performance.now()

  try {
    options.infoInstance.options.format = format.type
    options.infoInstance.options.full =
      format.type === "object" || format.type === "Text"
    options.infoInstance.reset()

    const resultData = await options.infoInstance.analyzeData(
      () => options.effectiveFileSize,
      options.readChunk
    )

    const output = Match.value(format.type).pipe(
      Match.when("object", () => serializeObjectResult(resultData, options)),
      Match.when("Text", () =>
        insertTextFilename(
          options.infoInstance.inform(),
          options.filenameState.displayFilename
        )
      ),
      Match.orElse(() => options.infoInstance.inform())
    )

    options.results[format.key] = output
    options.diagnostics.formatGenerationTimes[format.key] = Math.round(
      performance.now() - formatStart
    )
  } catch (cause) {
    options.diagnostics.formatErrors[format.key] = getErrorMessage(
      cause instanceof Error ? cause : String(cause)
    )
    options.results[format.key] = `Error generating ${format.type} view.`
  }

  await analyzeOneFormat({ ...options, index: options.index + 1 })
}

export async function analyzeMediaBuffer(
  options: AnalyzeMediaBufferOptions
): Promise<MediaInfoAnalysis> {
  const startTime = performance.now()
  const diagnostics = createDiagnostics()
  const filenameState = createFilenameState(options)
  const formats = selectFormats(options.requestedFormats)
  const results: Record<string, string> = {}
  const effectiveFileSize = options.fileSize ?? options.fileBuffer.byteLength
  const createMediaInfo = options.createMediaInfo ?? createDefaultMediaInfo

  try {
    const factoryStart = performance.now()
    using info = new DisposableMediaInfo(await createMediaInfo())
    info.instance.options.chunkSize = 5 * 1024 * 1024
    info.instance.options.coverData = false
    diagnostics.factoryCreateTimeMs = Math.round(
      performance.now() - factoryStart
    )

    await analyzeOneFormat({
      formats,
      index: 0,
      infoInstance: info.instance,
      effectiveFileSize,
      readChunk: readLocalChunk(options.fileBuffer),
      filenameState,
      filenameSource: options.filenameSource ?? "url",
      archiveEntry: options.archiveEntry,
      diagnostics,
      results,
    })
  } catch (cause) {
    diagnostics.wasmLoadError = getErrorMessage(
      cause instanceof Error ? cause : String(cause)
    )

    throw new DiagnosticsError(diagnostics.wasmLoadError, diagnostics, cause)
  }

  diagnostics.totalAnalysisTimeMs = Math.round(performance.now() - startTime)

  return {
    results,
    diagnostics,
    resolvedFilename: filenameState.displayFilename,
    resolvedFilenameSource: filenameState.resolvedFilenameSource,
  }
}
