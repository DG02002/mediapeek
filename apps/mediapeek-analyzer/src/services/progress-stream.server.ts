import {
  ANALYZE_PROGRESS_STREAM_CONTENT_TYPE,
  encodeAnalyzeStreamEvent,
  type AnalyzeProgressReporter,
} from "@mediapeek/shared/analyze-progress"

import type { AnalysisExecutionInput } from "./analysis-execution.server"
import {
  classifyAnalyzeError,
  type AnalyzeRequestState,
  type AnalyzerAnalysisExecutor,
  type AnalyzerContext,
  type RunAnalyzeRequest,
  type SetLogContextValue,
} from "./analyze-responses.server"

interface ProgressStreamState extends AnalyzeRequestState {
  controller?: ReadableStreamDefaultController<Uint8Array>
  encoder: TextEncoder
  signal: AbortSignal
  finished: boolean
}

const createProgressReporter =
  (state: ProgressStreamState): AnalyzeProgressReporter =>
  (stage, title, message) => {
    if (state.finished || state.signal.aborted) {
      return
    }

    const { controller } = state

    if (!controller) {
      return
    }

    controller.enqueue(
      state.encoder.encode(
        encodeAnalyzeStreamEvent({
          type: "progress",
          requestId: state.requestId,
          stage,
          title,
          message,
        })
      )
    )
  }

const closeProgressStream = (state: ProgressStreamState): void => {
  state.finished = true
  state.controller?.close()
}

const writeProgressSuccess = (
  state: ProgressStreamState,
  results: Record<string, string>
): void => {
  if (state.finished || state.signal.aborted) {
    return
  }

  const { controller } = state

  if (!controller) {
    return
  }

  controller.enqueue(
    state.encoder.encode(
      encodeAnalyzeStreamEvent({
        type: "success",
        requestId: state.requestId,
        results,
      })
    )
  )

  closeProgressStream(state)
}

const writeProgressError = (
  state: ProgressStreamState,
  cause: unknown,
  setLogContextValue: SetLogContextValue
): void => {
  const classified = classifyAnalyzeError(
    cause,
    state.customContext,
    setLogContextValue
  )

  state.setStatus(classified.status)
  state.setSeverity(classified.severity)

  state.controller?.enqueue(
    state.encoder.encode(
      encodeAnalyzeStreamEvent({
        type: "error",
        requestId: state.requestId,
        error: {
          code: classified.code,
          message: classified.message,
          retryable: classified.retryable,
        },
      })
    )
  )

  closeProgressStream(state)
}

const finalizeProgressStream = (state: ProgressStreamState): void => {
  state.customContext.analysis_status = state.status
  state.finalize()
}

const runProgressAnalysis = async (options: {
  state: ProgressStreamState
  url: string
  formats: AnalysisExecutionInput["formats"]
  cpuBudgetMs: number
  analysisExecutor: AnalyzerAnalysisExecutor
  runAnalyzeRequest: RunAnalyzeRequest
  setLogContextValue: SetLogContextValue
}): Promise<void> => {
  const reportProgress = createProgressReporter(options.state)

  try {
    const result = await options.runAnalyzeRequest({
      url: options.url,
      formats: options.formats,
      cpuBudgetMs: options.cpuBudgetMs,
      customContext: options.state.customContext,
      reportProgress,
      signal: options.state.signal,
      analysisExecutor: options.analysisExecutor,
    })

    writeProgressSuccess(options.state, result.results)
  } catch (error) {
    if (options.state.finished) {
      return
    }

    if (options.state.signal.aborted) {
      options.state.finished = true
      options.state.controller?.error(options.state.signal.reason)

      return
    }

    writeProgressError(options.state, error, options.setLogContextValue)
  } finally {
    finalizeProgressStream(options.state)
  }
}

export const createProgressResponse = (options: {
  context: AnalyzerContext
  requestState: AnalyzeRequestState
  url: string
  formats: AnalysisExecutionInput["formats"]
  cpuBudgetMs: number
  analysisExecutor: AnalyzerAnalysisExecutor
  runAnalyzeRequest: RunAnalyzeRequest
  setLogContextValue: SetLogContextValue
}): Response => {
  const streamAbortController = new AbortController()

  const signal = AbortSignal.any([
    options.context.req.raw.signal,
    streamAbortController.signal,
  ])

  const streamState: ProgressStreamState = {
    ...options.requestState,
    get status() {
      return options.requestState.status
    },
    get severity() {
      return options.requestState.severity
    },
    controller: undefined,
    encoder: new TextEncoder(),
    signal,
    finished: false,
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamState.controller = controller

      void runProgressAnalysis({
        state: streamState,
        url: options.url,
        formats: options.formats,
        cpuBudgetMs: options.cpuBudgetMs,
        analysisExecutor: options.analysisExecutor,
        runAnalyzeRequest: options.runAnalyzeRequest,
        setLogContextValue: options.setLogContextValue,
      })
    },
    cancel() {
      streamState.finished = true
      streamAbortController.abort(
        new DOMException("Analysis stream cancelled.", "AbortError")
      )
    },
  })

  return new Response(stream, {
    headers: {
      "content-type": ANALYZE_PROGRESS_STREAM_CONTENT_TYPE,
      "cache-control": "no-store",
    },
  })
}
