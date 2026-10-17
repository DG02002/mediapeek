import type { AnalysisOutputId } from "@mediapeek/shared/analysis-output-formats"

import { fetchMediaChunk, type FetchDiagnostics } from "./media-fetch.server"
import {
  analyzeMediaBuffer,
  type AnalysisProgressReporter,
  type MediaInfoDiagnostics,
} from "./mediainfo.server"

export interface AnalysisExecutionInput {
  readonly url: string
  readonly formats: readonly AnalysisOutputId[]
  readonly cpuBudgetMs: number
  readonly signal: AbortSignal
  readonly reportProgress?: AnalysisProgressReporter
}

export interface AnalysisExecutionResult {
  readonly fileSize?: number
  readonly results: Record<string, string>
  readonly diagnostics: {
    readonly fetch: FetchDiagnostics
    readonly analysis: MediaInfoDiagnostics
  }
  readonly resolvedFilename: string
  readonly resolvedFilenameSource: string
  readonly cpuBudgetRemainingMs: number
}

export interface AnalysisExecutionDependencies {
  readonly fetchMediaChunk: typeof fetchMediaChunk
  readonly analyzeMediaBuffer: typeof analyzeMediaBuffer
}

const defaultAnalysisExecutionDependencies: AnalysisExecutionDependencies = {
  fetchMediaChunk,
  analyzeMediaBuffer,
}

export const createAnalysisExecutor =
  (
    dependencies: AnalysisExecutionDependencies = defaultAnalysisExecutionDependencies
  ) =>
  async ({
    url,
    formats,
    cpuBudgetMs,
    signal,
    reportProgress,
  }: AnalysisExecutionInput): Promise<AnalysisExecutionResult> => {
    signal.throwIfAborted()
    await reportProgress?.(
      "request_received",
      "Analyzer Started",
      "The analyzer accepted the request and is beginning the source fetch."
    )

    const source = await dependencies.fetchMediaChunk({
      initialUrl: url,
      reportProgress,
      signal,
    })

    signal.throwIfAborted()

    const analysis = await dependencies.analyzeMediaBuffer({
      fileBuffer: source.buffer,
      fileSize: source.fileSize,
      filename: source.filename,
      filenameSource: source.filenameSource,
      requestedFormats: formats,
      cpuBudgetMs,
      archiveEntry: source.archiveEntry,
      remoteReadChunk: source.byteSource?.readChunk,
      reportProgress,
      signal,
    })

    return {
      fileSize: source.fileSize,
      results: analysis.results,
      diagnostics: {
        fetch: source.diagnostics,
        analysis: analysis.diagnostics,
      },
      resolvedFilename: analysis.resolvedFilename,
      resolvedFilenameSource: analysis.resolvedFilenameSource,
      cpuBudgetRemainingMs: Math.max(
        0,
        cpuBudgetMs - analysis.diagnostics.totalAnalysisTimeMs
      ),
    }
  }

export const executeAnalysis = createAnalysisExecutor()
