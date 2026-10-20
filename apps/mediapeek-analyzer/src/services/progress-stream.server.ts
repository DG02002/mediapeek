import type { AnalyzeWarningCode } from "@mediapeek/shared/analyze-contract"
import {
  ANALYZE_PROGRESS_STREAM_CONTENT_TYPE,
  encodeAnalyzeStreamEvent,
  type AnalyzeProgressReporter,
} from "@mediapeek/shared/analyze-progress"

import type { AnalysisExecutionInput } from "./analysis-execution.server"
import {
  classifyAnalyzeError,
  getAnalysisWarnings,
  type AnalyzeRequestState,
  type AnalyzerAnalysisExecutor,
  type AnalyzerResponder,
  type RunAnalyzeRequest,
  type SetLogContextValue,
} from "./analyze-responses.server"

interface ProgressStreamState {
  requestState: AnalyzeRequestState
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
          requestId: state.requestState.requestId,
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
  results: Record<string, string>,
  warnings?: Array<AnalyzeWarningCode>
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
        requestId: state.requestState.requestId,
        results,
        warnings,
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
    state.requestState.context,
    setLogContextValue
  )

  state.requestState.setStatus(classified.status)
  state.requestState.setSeverity(classified.severity)

  state.controller?.enqueue(
    state.encoder.encode(
      encodeAnalyzeStreamEvent({
        type: "error",
        requestId: state.requestState.requestId,
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

const classifyProgressAbort = (
  state: ProgressStreamState,
  setLogContextValue: SetLogContextValue
): void => {
  const classified = classifyAnalyzeError(
    state.signal.reason,
    state.requestState.context,
    setLogContextValue
  )

  state.requestState.setStatus(classified.status)
  state.requestState.setSeverity(classified.severity)
}

const finalizeProgressStream = (state: ProgressStreamState): void => {
  const { requestState } = state
  requestState.context.analysis_status = requestState.status
  requestState.finalize()
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
      logContext: options.state.requestState.context,
      reportProgress,
      signal: options.state.signal,
      analysisExecutor: options.analysisExecutor,
    })

    writeProgressSuccess(
      options.state,
      result.results,
      getAnalysisWarnings(result.diagnostics)
    )
  } catch (error) {
    if (options.state.finished) {
      return
    }

    if (options.state.signal.aborted) {
      classifyProgressAbort(options.state, options.setLogContextValue)
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
  context: AnalyzerResponder
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
    requestState: options.requestState,
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
