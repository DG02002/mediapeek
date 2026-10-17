import type { AnalyzeProgressStage } from "@mediapeek/shared/analyze-progress"
import {
  ARCHIVE_SIZING_WARNING,
  type ArchiveEntryInspection,
} from "@mediapeek/shared/archive-inspection"
import {
  type FilenameSource,
  getMediaInfoMetadataFilename,
} from "@mediapeek/shared/filename-resolution"

import { DiagnosticsError } from "../lib/error-utils"
import {
  MediaInfoDataSchema,
  type MediaInfoData,
  extractFirstFileFromArchive,
  isArchiveExtension,
  mediaInfoResultSchema,
  normalizeMediaInfo,
  type MediaInfoResult,
} from "../lib/media-utils"
import { createMediaInfo, type MediaInfo } from "./mediainfo-factory.server"

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

type AnalysisProgressReporter = (
  stage: AnalyzeProgressStage,
  title: string,
  message: string
) => Promise<void> | void

type ReadChunk = (size: number, offset: number) => Promise<Uint8Array>

type AnalyzeMediaBufferOptions = {
  fileBuffer: Uint8Array
  fileSize?: number
  filename: string
  filenameSource?: FilenameSource
  requestedFormats?: string[]
  cpuBudgetMs?: number
  archiveEntry?: ArchiveEntryInspection
  remoteReadChunk?: ReadChunk
  reportProgress?: AnalysisProgressReporter
}

type FormatRequest = { type: MediaInfoFormat; key: string }

type FormatState = {
  results: Record<string, string>
  diagnostics: MediaInfoDiagnostics
  displayFilename: string
  resolvedFilenameSource: FilenameSource
}

type MediaInfoTrack = NonNullable<
  NonNullable<MediaInfoResult["media"]>["track"]
>[number]

const allFormats: FormatRequest[] = [
  { type: "object", key: "json" },
  { type: "Text", key: "text" },
  { type: "XML", key: "xml" },
  { type: "HTML", key: "html" },
]

const selectFormats = (requestedFormats: string[]): FormatRequest[] => {
  const selected = allFormats.filter(
    (format) =>
      requestedFormats.includes("all") ||
      requestedFormats.includes(format.key) ||
      requestedFormats.includes(format.type.toLowerCase())
  )

  return selected.length > 0 ? selected : [{ type: "object", key: "json" }]
}

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
  }): ReadChunk =>
  async (size, offset) => {
    checkCpuBudget(options.startTime, options.cpuBudgetMs)

    return options.remoteReadChunk
      ? options.remoteReadChunk(size, offset)
      : readLocalChunk(options.fileBuffer, size, offset)
  }

const resolveMediaInfoFormat = (
  type: MediaInfoFormat
): MediaInfo["options"]["format"] => {
  switch (type) {
    case "object":
      return "object"
    case "Text":
      return "Text"
    case "XML":
      return "XML"
    case "HTML":
      return "HTML"
  }

  return unsupportedMediaInfoFormat(type)
}

const unsupportedMediaInfoFormat = (type: never): never => {
  throw new Error("Unsupported MediaInfo format: " + String(type))
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

const setArchiveFields = (
  generalTrack: MediaInfoTrack,
  archiveEntry?: ArchiveEntryInspection
) => {
  if (!archiveEntry) {
    return
  }

  generalTrack.Archive_Sizing_Status = archiveEntry.sizeStatus
  generalTrack.Archive_Sizing_Source = archiveEntry.sizeSource

  if (archiveEntry.sizeStatus === "estimated") {
    generalTrack.Archive_Sizing_Warning = ARCHIVE_SIZING_WARNING
  }
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
    const json: MediaInfoResult = mediaInfoResultSchema.parse(normalizedResult)

    const generalTrack = json.media?.track?.find(
      (track) => track["@type"] === "General"
    )

    if (generalTrack) {
      const metadataFallback =
        options.state.resolvedFilenameSource === "url" &&
        options.filenameSource === "url"
          ? getMediaInfoMetadataFilename(generalTrack)
          : undefined

      if (metadataFallback) {
        options.state.displayFilename = metadataFallback.filename
        options.state.resolvedFilenameSource = metadataFallback.source
      }

      generalTrack.CompleteName = options.state.displayFilename

      if (options.archiveName) {
        generalTrack.Archive_Name = options.archiveName
      }

      setArchiveFields(generalTrack, options.archiveEntry)
    }

    return JSON.stringify(json)
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
  infoInstance: MediaInfo
  format: FormatRequest
  fileSize: number
  readChunk: ReadChunk
}): Promise<FormatAnalysisResult> => {
  options.infoInstance.options.format = resolveMediaInfoFormat(
    options.format.type
  )
  options.infoInstance.options.full =
    options.format.type === "object" || options.format.type === "Text"
  options.infoInstance.reset()

  const resultData = await options.infoInstance.analyzeData(
    () => options.fileSize,
    options.readChunk
  )

  if (options.format.type !== "object") {
    return { kind: "text", value: options.infoInstance.inform() }
  }

  try {
    return { kind: "object", data: MediaInfoDataSchema.parse(resultData) }
  } catch (error) {
    return {
      kind: "object_error",
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

const generateFormat = async (options: {
  infoInstance: MediaInfo
  format: FormatRequest
  fileSize: number
  readChunk: ReadChunk
  filename: string
  filenameSource: FilenameSource
  archiveName?: string
  archiveEntry?: ArchiveEntryInspection
  state: FormatState
}) => {
  const formatStart = performance.now()

  try {
    const resultData = await analyzeRawFormat({
      infoInstance: options.infoInstance,
      format: options.format,
      fileSize: options.fileSize,
      readChunk: options.readChunk,
    })

    const output = renderFormatResult(resultData, options)

    return {
      key: options.format.key,
      output,
      durationMs: Math.round(performance.now() - formatStart),
    }
  } catch (error) {
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
    infoInstance: MediaInfo
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
  infoInstance: MediaInfo
  options: {
    fileSize: number
    readChunk: ReadChunk
    filename: string
    filenameSource: FilenameSource
    archiveName?: string
    archiveEntry?: ArchiveEntryInspection
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
  },
  state: FormatState
) => {
  const factoryStart = performance.now()
  const infoInstance = await createMediaInfo()
  state.diagnostics.factoryCreateTimeMs = Math.round(
    performance.now() - factoryStart
  )

  try {
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
  requestedFormats = [],
  cpuBudgetMs = DEFAULT_ANALYSIS_CPU_BUDGET_MS,
  archiveEntry,
  remoteReadChunk,
  reportProgress,
}: AnalyzeMediaBufferOptions): Promise<MediaInfoAnalysis> {
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
        }),
        filename,
        filenameSource,
        archiveName,
        archiveEntry,
        reportProgress,
      },
      state
    )
  } catch (error) {
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
