import {
  analysisOutputFormats,
  type AnalysisOutputId,
} from "@mediapeek/shared/analysis-output-formats"
import type { AnalyzeProgressStage } from "@mediapeek/shared/analyze-progress"
import {
  ARCHIVE_SIZING_WARNING,
  type ArchiveEntryInspection,
} from "@mediapeek/shared/archive-inspection"
import {
  type FilenameSource,
  getMediaInfoMetadataFilename,
} from "@mediapeek/shared/filename-resolution"
import { Schema } from "effect"

import { DiagnosticsError } from "../lib/error-utils"
import {
  MediaInfoResultSchema,
  extractFirstFileFromArchive,
  isArchiveExtension,
  normalizeMediaInfo,
  type JsonMediaInfo,
  type MediaInfoTrack,
} from "../lib/media-utils"
import {
  createMediaInfo,
  type MediaInfoInstance,
} from "./mediainfo-factory.server"

export class CpuBudgetExceededError extends Error {
  constructor(message = "CPU budget exceeded") {
    super(message)
    this.name = "CpuBudgetExceededError"
  }
}

export const DEFAULT_ANALYSIS_CPU_BUDGET_MS = 25_000

const checkCpuBudget = (
  start: number,
  limitMs = DEFAULT_ANALYSIS_CPU_BUDGET_MS
) => {
  if (performance.now() - start > limitMs) {
    throw new CpuBudgetExceededError()
  }
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

export type AnalysisProgressReporter = (
  stage: AnalyzeProgressStage,
  title: string,
  message: string
) => Promise<void> | void

export interface MediaInfoAnalysisDependencies {
  readonly createMediaInfo: () => Promise<MediaInfoInstance>
}

const defaultMediaInfoAnalysisDependencies: MediaInfoAnalysisDependencies = {
  createMediaInfo,
}

type ReadChunk = (size: number, offset: number) => Promise<Uint8Array>

export interface AnalyzeMediaBufferOptions {
  fileBuffer: Uint8Array
  fileSize?: number
  filename: string
  filenameSource?: FilenameSource
  requestedFormats?: readonly AnalysisOutputId[]
  cpuBudgetMs?: number
  archiveEntry?: ArchiveEntryInspection
  remoteReadChunk?: ReadChunk
  reportProgress?: AnalysisProgressReporter
  signal?: AbortSignal
  dependencies?: MediaInfoAnalysisDependencies
}

type FormatRequest = { type: MediaInfoFormat; key: AnalysisOutputId }

type FormatState = {
  results: Record<string, string>
  diagnostics: MediaInfoDiagnostics
  displayFilename: string
  resolvedFilenameSource: FilenameSource
}

type MediaInfoData = JsonMediaInfo

const resolveFormatType = (format: AnalysisOutputId): MediaInfoFormat => {
  switch (format) {
    case "json":
      return "object"
    case "text":
      return "Text"
    case "xml":
      return "XML"
    case "html":
      return "HTML"

    default:
      return unsupportedAnalysisOutput(format)
  }
}

const unsupportedAnalysisOutput = (format: never): never => {
  throw new Error("Unsupported analysis output: " + String(format))
}

const selectFormats = (
  requestedFormats?: readonly AnalysisOutputId[]
): FormatRequest[] =>
  analysisOutputFormats.parse(requestedFormats).map((key) => ({
    key,
    type: resolveFormatType(key),
  }))

const getArchiveFilename = (
  fileBuffer: Uint8Array,
  filename: string,
  archiveEntry?: ArchiveEntryInspection
) =>
  archiveEntry?.name ??
  (isArchiveExtension(filename)
    ? extractFirstFileFromArchive(fileBuffer)
    : null)

const readLocalChunk = (
  fileBuffer: Uint8Array,
  chunkSize: number,
  offset: number
) => {
  if (offset >= fileBuffer.byteLength) {
    return new Uint8Array(0)
  }

  const end = Math.min(offset + chunkSize, fileBuffer.byteLength)

  return fileBuffer.subarray(offset, end)
}

const createReadChunk =
  (options: {
    fileBuffer: Uint8Array
    startTime: number
    cpuBudgetMs: number
    remoteReadChunk?: ReadChunk
    signal?: AbortSignal
  }): ReadChunk =>
  async (size, offset) => {
    options.signal?.throwIfAborted()

    checkCpuBudget(options.startTime, options.cpuBudgetMs)

    return options.remoteReadChunk
      ? options.remoteReadChunk(size, offset)
      : readLocalChunk(options.fileBuffer, size, offset)
  }

const findTextFilenameInsertIndex = (lines: string[], generalIndex: number) => {
  for (let index = generalIndex + 1; index < lines.length; index += 1) {
    if (lines[index].trim().startsWith("Unique ID")) {
      return index + 1
    }

    if (lines[index].trim() === "") {
      break
    }
  }

  return generalIndex + 1
}

const insertTextFilename = (result: string, filename: string) => {
  if (result.includes("Complete name")) {
    return result
  }

  const lines = result.split("\n")

  const generalIndex = lines.findIndex((line) =>
    line.trim().startsWith("General")
  )

  if (generalIndex === -1) {
    return result
  }

  const insertIndex = findTextFilenameInsertIndex(lines, generalIndex)
  const padding = " ".repeat(41 - "Complete name".length)
  lines.splice(insertIndex, 0, "Complete name" + padding + ": " + filename)

  return lines.join("\n")
}

interface ArchiveSizingFields {
  Archive_Sizing_Status: ArchiveEntryInspection["sizeStatus"]
  Archive_Sizing_Source: ArchiveEntryInspection["sizeSource"]
  Archive_Sizing_Warning?: string
}

const getArchiveFields = (
  archiveEntry: ArchiveEntryInspection
): ArchiveSizingFields => {
  const fields: ArchiveSizingFields = {
    Archive_Sizing_Status: archiveEntry.sizeStatus,
    Archive_Sizing_Source: archiveEntry.sizeSource,
  }

  if (archiveEntry.sizeStatus === "estimated") {
    fields.Archive_Sizing_Warning = ARCHIVE_SIZING_WARNING
  }

  return fields
}

const applyArchiveFields = (
  track: MediaInfoTrack,
  archiveEntry?: ArchiveEntryInspection
): void => {
  if (!archiveEntry) {
    return
  }

  Object.assign(track, getArchiveFields(archiveEntry))
}

const processObjectResult = (options: {
  resultData: MediaInfoData
  filename: string
  filenameSource: FilenameSource
  archiveName?: string
  archiveEntry?: ArchiveEntryInspection
  state: FormatState
}) => {
  try {
    const normalizedResult = normalizeMediaInfo(options.resultData)

    const json = Schema.decodeUnknownSync(MediaInfoResultSchema)(
      normalizedResult
    )

    if (!json.media?.track) {
      return JSON.stringify(json)
    }

    const tracks = json.media.track.map((track) => {
      if (track["@type"] !== "General") {
        return track
      }

      const metadataFallback =
        options.state.resolvedFilenameSource === "url" &&
        options.filenameSource === "url"
          ? getMediaInfoMetadataFilename(track)
          : undefined

      if (metadataFallback) {
        options.state.displayFilename = metadataFallback.filename
        options.state.resolvedFilenameSource = metadataFallback.source
      }

      const updatedTrack = {
        ...track,
        CompleteName: options.state.displayFilename,
      }

      if (options.archiveName) {
        Object.assign(updatedTrack, { Archive_Name: options.archiveName })
      }

      applyArchiveFields(updatedTrack, options.archiveEntry)

      return updatedTrack
    })

    return JSON.stringify({
      ...json,
      media: { ...json.media, track: tracks },
    })
  } catch (error) {
    options.state.diagnostics.objectProcessError =
      error instanceof Error ? error.message : String(error)

    return "{}"
  }
}

type FormatAnalysisResult =
  | { kind: "object"; data: MediaInfoData }
  | { kind: "object_error"; message: string }
  | { kind: "text"; value: string }

const analyzeRawFormat = async (options: {
  infoInstance: MediaInfoInstance
  format: FormatRequest
  fileSize: number
  readChunk: ReadChunk
  signal?: AbortSignal
}): Promise<FormatAnalysisResult> => {
  options.signal?.throwIfAborted()

  analysisOutputFormats.configure(options.format.key, options.infoInstance)
  options.infoInstance.reset()

  const resultData = await options.infoInstance.analyzeData(
    () => options.fileSize,
    options.readChunk
  )

  if (options.format.type !== "object") {
    return { kind: "text", value: options.infoInstance.inform() }
  }

  return { kind: "object", data: resultData }
}

const generateFormat = async (options: {
  infoInstance: MediaInfoInstance
  format: FormatRequest
  fileSize: number
  readChunk: ReadChunk
  filename: string
  filenameSource: FilenameSource
  archiveName?: string
  archiveEntry?: ArchiveEntryInspection
  state: FormatState
  signal?: AbortSignal
}) => {
  const formatStart = performance.now()

  try {
    const resultData = await analyzeRawFormat({
      infoInstance: options.infoInstance,
      format: options.format,
      fileSize: options.fileSize,
      readChunk: options.readChunk,
      signal: options.signal,
    })

    const output = renderFormatResult(resultData, options)

    return {
      key: options.format.key,
      output,
      durationMs: Math.round(performance.now() - formatStart),
    }
  } catch (error) {
    options.signal?.throwIfAborted()

    return {
      key: options.format.key,
      output: "Error generating " + options.format.type + " view.",
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

const renderFormatResult = (
  resultData: FormatAnalysisResult,
  options: {
    infoInstance: MediaInfoInstance
    format: FormatRequest
    filename: string
    filenameSource: FilenameSource
    archiveName?: string
    archiveEntry?: ArchiveEntryInspection
    state: FormatState
  }
) => {
  if (resultData.kind === "object_error") {
    options.state.diagnostics.objectProcessError = resultData.message

    return "{}"
  }

  if (resultData.kind === "object") {
    return processObjectResult({
      resultData: resultData.data,
      filename: options.filename,
      filenameSource: options.filenameSource,
      archiveName: options.archiveName,
      archiveEntry: options.archiveEntry,
      state: options.state,
    })
  }

  return options.format.type === "Text"
    ? insertTextFilename(resultData.value, options.state.displayFilename)
    : resultData.value
}

const generateFormatsSequentially = async (parameters: {
  index: number
  formats: FormatRequest[]
  infoInstance: MediaInfoInstance
  options: {
    fileSize: number
    readChunk: ReadChunk
    filename: string
    filenameSource: FilenameSource
    archiveName?: string
    archiveEntry?: ArchiveEntryInspection
    signal?: AbortSignal
  }
  state: FormatState
}): Promise<void> => {
  const format = parameters.formats[parameters.index]

  if (!format) {
    return
  }

  const result = await generateFormat({
    infoInstance: parameters.infoInstance,
    format,
    fileSize: parameters.options.fileSize,
    readChunk: parameters.options.readChunk,
    filename: parameters.options.filename,
    filenameSource: parameters.options.filenameSource,
    archiveName: parameters.options.archiveName,
    archiveEntry: parameters.options.archiveEntry,
    state: parameters.state,
    signal: parameters.options.signal,
  })

  parameters.state.results[result.key] = result.output

  if (result.error !== undefined) {
    parameters.state.diagnostics.formatErrors[result.key] = result.error
  } else {
    parameters.state.diagnostics.formatGenerationTimes[result.key] =
      result.durationMs
  }

  await generateFormatsSequentially({
    ...parameters,
    index: parameters.index + 1,
  })
}

const runMediaInfo = async (
  formats: FormatRequest[],
  options: {
    fileSize: number
    readChunk: ReadChunk
    filename: string
    filenameSource: FilenameSource
    archiveName?: string
    archiveEntry?: ArchiveEntryInspection
    reportProgress?: AnalysisProgressReporter
    signal?: AbortSignal
    dependencies: MediaInfoAnalysisDependencies
  },
  state: FormatState
) => {
  const factoryStart = performance.now()
  const infoInstance = await options.dependencies.createMediaInfo()
  state.diagnostics.factoryCreateTimeMs = Math.round(
    performance.now() - factoryStart
  )

  try {
    options.signal?.throwIfAborted()

    infoInstance.options.chunkSize = 5 * 1024 * 1024
    infoInstance.options.coverData = false
    await options.reportProgress?.(
      "analysis_started",
      "Running Media Analysis",
      "MediaInfo is parsing the bytes fetched from the source."
    )
    await generateFormatsSequentially({
      index: 0,
      formats,
      infoInstance,
      options,
      state,
    })
  } finally {
    infoInstance.close()
  }
}

export async function analyzeMediaBuffer({
  fileBuffer,
  fileSize,
  filename,
  filenameSource = "url",
  requestedFormats,
  cpuBudgetMs = DEFAULT_ANALYSIS_CPU_BUDGET_MS,
  archiveEntry,
  remoteReadChunk,
  reportProgress,
  signal,
  dependencies = defaultMediaInfoAnalysisDependencies,
}: AnalyzeMediaBufferOptions): Promise<MediaInfoAnalysis> {
  signal?.throwIfAborted()

  const startTime = performance.now()
  const effectiveFileSize = fileSize ?? fileBuffer.byteLength

  const archiveInnerName = getArchiveFilename(
    fileBuffer,
    filename,
    archiveEntry
  )

  const archiveName = archiveInnerName ? filename : undefined

  const state: FormatState = {
    results: {},
    diagnostics: {
      wasmLoadTimeMs: 0,
      factoryCreateTimeMs: 0,
      formatGenerationTimes: {},
      totalAnalysisTimeMs: 0,
      formatErrors: {},
    },
    displayFilename: archiveInnerName ?? filename,
    resolvedFilenameSource: archiveInnerName ? "archive-inner" : filenameSource,
  }

  try {
    await runMediaInfo(
      selectFormats(requestedFormats),
      {
        fileSize: effectiveFileSize,
        readChunk: createReadChunk({
          fileBuffer,
          startTime,
          cpuBudgetMs,
          remoteReadChunk,
          signal,
        }),
        filename,
        filenameSource,
        archiveName,
        archiveEntry,
        reportProgress,
        signal,
        dependencies,
      },
      state
    )
  } catch (error) {
    signal?.throwIfAborted()

    state.diagnostics.wasmLoadError =
      error instanceof Error ? error.message : String(error)
    throw new DiagnosticsError(
      state.diagnostics.wasmLoadError,
      state.diagnostics,
      error
    )
  }

  state.diagnostics.totalAnalysisTimeMs = Math.round(
    performance.now() - startTime
  )
  await reportProgress?.(
    "analysis_completed",
    "Analysis Complete",
    "Media analysis finished. Preparing the final response."
  )

  return {
    results: state.results,
    diagnostics: state.diagnostics,
    resolvedFilename: state.displayFilename,
    resolvedFilenameSource: state.resolvedFilenameSource,
  }
}
