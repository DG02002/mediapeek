import type {
  AnalysisOutputId,
  AnalysisOutputResults,
} from "@mediapeek/shared/analysis-output-formats"
import {
  AnalyzeResponseSchema,
  type AnalyzeResponse,
} from "@mediapeek/shared/analyze-contract"
import { ANALYZE_PROGRESS_STREAM_CONTENT_TYPE } from "@mediapeek/shared/analyze-progress"
import { Result, Schema } from "effect"

import {
  ANALYSIS_REQUEST_TIMEOUT_MS,
  ANALYSIS_RETRY_BACKOFF_MS,
  MAX_ANALYSIS_RETRIES,
} from "~/constants"
import {
  isAnalyzeProgressStreamResponse,
  readAnalyzeStreamResponse,
} from "~/lib/analyze-stream"

const RETRYABLE_HTTP_STATUSES = new Set([502, 503, 504])

class AnalysisRequestError extends Error {
  readonly retryable: boolean
  readonly status?: number
  readonly code?: string

  constructor(
    message: string,
    retryable = false,
    options: { readonly status?: number; readonly code?: string } = {}
  ) {
    super(message)
    this.retryable = retryable
    this.status = options.status
    this.code = options.code
  }
}

const waitForRetry = (durationMs: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal.removeEventListener("abort", handleAbort)
      resolve()
    }, durationMs)

    const handleAbort = () => {
      clearTimeout(timeoutId)
      signal.removeEventListener("abort", handleAbort)
      reject(signal.reason)
    }

    signal.addEventListener("abort", handleAbort, { once: true })
  })

export interface AnalysisResult {
  readonly url: string
  readonly requestId?: string
  readonly outputs: Readonly<AnalysisOutputResults>
}

export interface AnalysisProgress {
  readonly title: string
  readonly message: string
}

export type AnalysisSessionSnapshot =
  | { readonly phase: "idle" }
  | {
      readonly phase: "analyzing"
      readonly url: string
      readonly progress?: AnalysisProgress
    }
  | { readonly phase: "ready"; readonly analysis: AnalysisResult }
  | {
      readonly phase: "failed"
      readonly url: string
      readonly message: string
    }

export interface AnalysisSession {
  getSnapshot(): AnalysisSessionSnapshot
  subscribe(listener: () => void): () => void
  analyze(
    url: string,
    turnstileToken?: string,
    requestTurnstileToken?: () => Promise<string | null>
  ): Promise<AnalysisResult>
  output(
    format: AnalysisOutputId,
    requestTurnstileToken?: () => Promise<string | null>
  ): Promise<string>
  cancel(): void
  dispose(): void
}

interface AnalysisSessionOptions {
  readonly initialAnalysis?: AnalysisResult
  readonly allowMissingOutputs?: boolean
}

const readAnalyzeResponse = async (
  response: Response
): Promise<AnalyzeResponse> => {
  let payload: unknown

  try {
    payload = await response.json()
  } catch {
    throw new AnalysisRequestError(
      "Analyzer service returned malformed data.",
      true
    )
  }

  const parsed = Schema.decodeUnknownResult(AnalyzeResponseSchema)(payload)

  if (Result.isFailure(parsed)) {
    throw new AnalysisRequestError(
      "Analyzer service returned malformed data.",
      true
    )
  }

  return parsed.success
}

const requestInitialAnalysis = async (input: {
  readonly url: string
  readonly operationId: string
  readonly formats: ReadonlyArray<AnalysisOutputId>
  readonly useProgressStream: boolean
  readonly turnstileToken?: string
  readonly controller: AbortController
  readonly onProgress: (progress: AnalysisProgress) => void
}) => {
  const headers = new Headers({ "Content-Type": "application/json" })

  if (input.useProgressStream) {
    headers.set("Accept", ANALYZE_PROGRESS_STREAM_CONTENT_TYPE)
  }

  if (input.turnstileToken) {
    headers.set("CF-Turnstile-Response", input.turnstileToken)
  }

  const response = await fetch("/resource/analyze", {
    method: "POST",
    headers,
    body: JSON.stringify({
      url: input.url,
      format: input.formats,
      operationId: input.operationId,
    }),
    signal: input.controller.signal,
  })

  if (isAnalyzeProgressStreamResponse(response)) {
    const terminal = await readAnalyzeStreamResponse(response, (event) =>
      input.onProgress({ title: event.title, message: event.message })
    )

    if (terminal.type === "error") {
      throw new AnalysisRequestError(
        terminal.error.message,
        terminal.error.retryable,
        { status: response.status, code: terminal.error.code }
      )
    }

    return { requestId: terminal.requestId, outputs: terminal.results }
  }

  const data = await readAnalyzeResponse(response)

  if (!response.ok || !data.success) {
    throw new AnalysisRequestError(
      data.success
        ? "Unable to analyze the URL. Verify the link and try again."
        : data.error.message,
      RETRYABLE_HTTP_STATUSES.has(response.status) ||
        (!data.success && data.error.retryable),
      {
        status: response.status,
        code: data.success ? undefined : data.error.code,
      }
    )
  }

  return {
    requestId: data.requestId,
    outputs: data.results,
  }
}

interface AnalysisOutcome {
  readonly requestId: string
  readonly outputs: AnalysisOutputResults
}

interface AnalysisRetryInput {
  readonly url: string
  readonly formats: ReadonlyArray<AnalysisOutputId>
  readonly useProgressStream: boolean
  readonly turnstileToken?: string
  readonly requestTurnstileToken?: () => Promise<string | null>
  readonly turnstileRetryAttempted?: boolean
  readonly operationId: string
  readonly attempt: number
  readonly onProgress: (progress: AnalysisProgress) => void
  readonly onRetry: (attempt: number) => void
  readonly onController: (controller: AbortController) => void
  readonly onAttemptFinished: (controller: AbortController) => void
}

const isTurnstileChallenge = (error: unknown): error is AnalysisRequestError =>
  error instanceof AnalysisRequestError &&
  error.status === 403 &&
  (error.code === "AUTH_REQUIRED" || error.code === "AUTH_INVALID")

const createAnalysisRequestTimeout = (
  controller: AbortController,
  onController: (controller: AbortController) => void
) => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  onController(controller)

  const arm = () => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      controller.abort(
        new DOMException("Analysis request timed out.", "TimeoutError")
      )
    }, ANALYSIS_REQUEST_TIMEOUT_MS)
  }

  arm()

  return { arm, clear: () => clearTimeout(timeoutId) }
}

const requestAnalysisWithRetries = async (
  input: AnalysisRetryInput
): Promise<AnalysisOutcome> => {
  const controller = new AbortController()
  const timeout = createAnalysisRequestTimeout(controller, input.onController)

  try {
    return await requestInitialAnalysis({
      url: input.url,
      operationId: input.operationId,
      formats: input.formats,
      useProgressStream: input.useProgressStream,
      turnstileToken: input.turnstileToken,
      controller,
      onProgress: (progress) => {
        timeout.arm()
        input.onProgress(progress)
      },
    })
  } catch (error) {
    if (
      isTurnstileChallenge(error) &&
      input.requestTurnstileToken &&
      !input.turnstileRetryAttempted
    ) {
      timeout.clear()
      const turnstileToken = await input.requestTurnstileToken()

      if (!turnstileToken) {
        throw new AnalysisRequestError("Verification was cancelled.", false, {
          status: 403,
          code: error.code,
        })
      }

      if (controller.signal.aborted) {
        throw controller.signal.reason
      }

      return requestAnalysisWithRetries({
        ...input,
        turnstileToken,
        turnstileRetryAttempted: true,
      })
    }

    const retryable =
      error instanceof TypeError ||
      (error instanceof AnalysisRequestError && error.retryable)

    if (input.attempt >= MAX_ANALYSIS_RETRIES || !retryable) {
      throw error
    }

    input.onRetry(input.attempt + 1)
    await waitForRetry(
      ANALYSIS_RETRY_BACKOFF_MS * (input.attempt + 1),
      controller.signal
    )

    return requestAnalysisWithRetries({
      ...input,
      attempt: input.attempt + 1,
    })
  } finally {
    timeout.clear()
    input.onAttemptFinished(controller)
  }
}

export const createBrowserAnalysisSession = (
  options: AnalysisSessionOptions = {}
): AnalysisSession => {
  let snapshot: AnalysisSessionSnapshot = options.initialAnalysis
    ? { phase: "ready", analysis: options.initialAnalysis }
    : { phase: "idle" }

  const activeControllers = new Set<AbortController>()
  let isDisposed = false
  let analysisGeneration = 0
  const listeners = new Set<() => void>()
  const pendingOutputs = new Map<AnalysisOutputId, Promise<string>>()

  const publish = (nextSnapshot: AnalysisSessionSnapshot) => {
    if (isDisposed) {
      return
    }

    snapshot = nextSnapshot

    for (const listener of listeners) {
      listener()
    }
  }

  const analyze = async (
    url: string,
    turnstileToken?: string,
    requestTurnstileToken?: () => Promise<string | null>
  ) => {
    for (const controller of activeControllers) {
      controller.abort()
    }

    analysisGeneration += 1
    const generation = analysisGeneration
    pendingOutputs.clear()
    publish({ phase: "analyzing", url })

    try {
      const outcome = await requestAnalysisWithRetries({
        url,
        formats: ["json"],
        useProgressStream: true,
        turnstileToken,
        requestTurnstileToken,
        operationId: crypto.randomUUID(),
        attempt: 0,
        onProgress: (progress) => {
          if (generation === analysisGeneration) {
            publish({ phase: "analyzing", url, progress })
          }
        },
        onRetry: (attempt) => {
          if (generation === analysisGeneration) {
            publish({
              phase: "analyzing",
              url,
              progress: {
                title: "Retrying Request",
                message: `The request ended before analysis finished. Retrying now (${String(attempt)}/${String(MAX_ANALYSIS_RETRIES)}).`,
              },
            })
          }
        },
        onController: (controller) => {
          activeControllers.add(controller)
        },
        onAttemptFinished: (controller) => {
          activeControllers.delete(controller)
        },
      })

      const analysis: AnalysisResult = {
        url,
        requestId: outcome.requestId,
        outputs: outcome.outputs,
      }

      if (generation === analysisGeneration) {
        publish({ phase: "ready", analysis })
      }

      return analysis
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Analysis failed."

      if (generation === analysisGeneration) {
        publish({ phase: "failed", url, message })
      }

      throw error
    }
  }

  const output = async (
    format: AnalysisOutputId,
    requestTurnstileToken?: () => Promise<string | null>
  ): Promise<string> => {
    if (snapshot.phase !== "ready") {
      throw new Error("Analyze a URL before requesting another format.")
    }

    const cached = snapshot.analysis.outputs[format]

    if (cached !== undefined) {
      return cached
    }

    if (options.allowMissingOutputs === false) {
      throw new Error(
        `${format.toUpperCase()} output was not included in this saved report.`
      )
    }

    const pending = pendingOutputs.get(format)

    if (pending) {
      return pending
    }

    const { analysis } = snapshot

    const generation = analysisGeneration

    const request = requestAnalysisWithRetries({
      url: analysis.url,
      formats: [format],
      useProgressStream: false,
      requestTurnstileToken,
      operationId: crypto.randomUUID(),
      attempt: 0,
      onProgress: () => {},
      onRetry: () => {},
      onController: (controller) => {
        activeControllers.add(controller)
      },
      onAttemptFinished: (controller) => {
        activeControllers.delete(controller)
      },
    })
      .then((outcome) => {
        const content = outcome.outputs[format]

        if (content === undefined) {
          throw new Error(`No ${format.toUpperCase()} content returned.`)
        }

        const nextAnalysis: AnalysisResult = {
          ...analysis,
          outputs: { ...analysis.outputs, [format]: content },
        }

        if (
          generation === analysisGeneration &&
          snapshot.phase === "ready" &&
          snapshot.analysis === analysis
        ) {
          publish({ phase: "ready", analysis: nextAnalysis })
        }

        return content
      })
      .finally(() => {
        if (pendingOutputs.get(format) === request) {
          pendingOutputs.delete(format)
        }
      })

    pendingOutputs.set(format, request)

    return request
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)

      return () => listeners.delete(listener)
    },
    analyze,
    output,
    cancel() {
      for (const controller of activeControllers) {
        controller.abort(
          new DOMException("Analysis request cancelled.", "AbortError")
        )
      }
    },
    dispose() {
      isDisposed = true

      for (const controller of activeControllers) {
        controller.abort(
          new DOMException("Analysis request cancelled.", "AbortError")
        )
      }

      listeners.clear()
    },
  }
}

export const createBrowserAnalysisSessionForOutputs = (options: {
  readonly url: string
  readonly outputs: Readonly<AnalysisOutputResults>
  readonly allowMissingOutputs?: boolean
}): AnalysisSession =>
  createBrowserAnalysisSession({
    initialAnalysis: {
      url: options.url,
      outputs: options.outputs,
    },
    allowMissingOutputs: options.allowMissingOutputs,
  })
