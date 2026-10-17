import type {
  AnalysisOutputId,
  AnalysisOutputResults,
} from "@mediapeek/shared/analysis-output-formats"
import { AnalyzeResponseSchema } from "@mediapeek/shared/analyze-contract"
import {
  ANALYZE_PROGRESS_STREAM_CONTENT_TYPE,
  AnalyzeStreamEventSchema,
} from "@mediapeek/shared/analyze-progress"
import { Result, Schema } from "effect"

import {
  ANALYSIS_REQUEST_TIMEOUT_MS,
  ANALYSIS_RETRY_BACKOFF_MS,
  MAX_ANALYSIS_RETRIES,
} from "~/constants"

const RETRYABLE_HTTP_STATUSES = new Set([502, 503, 504])

type AnalysisStreamTerminal = Exclude<
  typeof AnalyzeStreamEventSchema.Type,
  { readonly type: "progress" }
>

class AnalysisRequestError extends Error {
  readonly retryable: boolean

  constructor(message: string, retryable = false) {
    super(message)
    this.retryable = retryable
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
  readonly durationMs: number
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
  analyze(url: string, turnstileToken?: string): Promise<AnalysisResult>
  output(format: AnalysisOutputId): Promise<string>
  cancel(): void
  dispose(): void
}

const parseStreamLine = (line: string) => {
  try {
    const parsed = Schema.decodeUnknownResult(AnalyzeStreamEventSchema)(
      JSON.parse(line)
    )

    if (Result.isSuccess(parsed)) {
      return parsed.success
    }
  } catch {
    // Normalize malformed JSON and malformed event shapes identically.
  }

  throw new Error("Analyzer stream returned malformed progress data.")
}

const handleStreamLine = (
  line: string,
  onProgress: (progress: AnalysisProgress) => void
) => {
  if (!line.trim()) {
    return undefined
  }

  const event = parseStreamLine(line)

  if (event.type === "progress") {
    onProgress({ title: event.title, message: event.message })

    return undefined
  }

  return event
}

const readStream = (
  response: Response,
  onProgress: (progress: AnalysisProgress) => void
): Promise<AnalysisStreamTerminal> => {
  const reader = response.body?.getReader()

  if (!reader) {
    throw new Error("Analyzer stream did not include a readable body.")
  }

  const decoder = new TextDecoder()
  let buffered = ""

  const readNextChunk = async (): Promise<AnalysisStreamTerminal> => {
    const { done, value } = await reader.read()
    buffered += decoder.decode(value ?? new Uint8Array(0), { stream: !done })
    const lines = buffered.split("\n")
    buffered = lines.pop() ?? ""

    for (const line of lines) {
      const event = handleStreamLine(line, onProgress)

      if (event) {
        return event
      }
    }

    if (done) {
      if (buffered.trim()) {
        const event = handleStreamLine(buffered, onProgress)

        if (event) {
          return event
        }
      }

      throw new Error("Analyzer stream ended before sending a final result.")
    }

    return readNextChunk()
  }

  return readNextChunk()
}

const requestInitialAnalysis = async (input: {
  readonly url: string
  readonly operationId: string
  readonly turnstileToken?: string
  readonly controller: AbortController
  readonly onProgress: (progress: AnalysisProgress) => void
}) => {
  const headers = new Headers({
    "Content-Type": "application/json",
    Accept: ANALYZE_PROGRESS_STREAM_CONTENT_TYPE,
  })

  if (input.turnstileToken) {
    headers.set("CF-Turnstile-Response", input.turnstileToken)
  }

  const response = await fetch("/resource/analyze", {
    method: "POST",
    headers,
    body: JSON.stringify({
      url: input.url,
      format: ["json"],
      operationId: input.operationId,
    }),
    signal: input.controller.signal,
  })

  const contentType = response.headers.get("content-type")?.toLowerCase()

  if (contentType?.includes(ANALYZE_PROGRESS_STREAM_CONTENT_TYPE)) {
    const terminal = await readStream(response, input.onProgress)

    if (terminal.type === "error") {
      throw new AnalysisRequestError(
        terminal.error.message,
        terminal.error.retryable
      )
    }

    return { requestId: terminal.requestId, outputs: terminal.results }
  }

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

  if (!response.ok || !parsed.success.success) {
    throw new AnalysisRequestError(
      parsed.success.success
        ? "Unable to analyze the URL. Verify the link and try again."
        : parsed.success.error.message,
      RETRYABLE_HTTP_STATUSES.has(response.status) ||
        (!parsed.success.success && parsed.success.error.retryable)
    )
  }

  return {
    requestId: parsed.success.requestId,
    outputs: parsed.success.results,
  }
}

interface AnalysisOutcome {
  readonly requestId: string
  readonly outputs: AnalysisOutputResults
}

interface AnalysisRetryInput {
  readonly url: string
  readonly turnstileToken?: string
  readonly operationId: string
  readonly attempt: number
  readonly onProgress: (progress: AnalysisProgress) => void
  readonly onRetry: (attempt: number) => void
  readonly onController: (controller: AbortController) => void
  readonly onAttemptFinished: () => void
}

const requestAnalysisWithRetries = async (
  input: AnalysisRetryInput
): Promise<AnalysisOutcome> => {
  const controller = new AbortController()
  input.onController(controller)

  const timeoutId = setTimeout(() => {
    controller.abort(
      new DOMException("Analysis request timed out.", "TimeoutError")
    )
  }, ANALYSIS_REQUEST_TIMEOUT_MS)

  try {
    return await requestInitialAnalysis({
      url: input.url,
      operationId: input.operationId,
      turnstileToken: input.turnstileToken,
      controller,
      onProgress: input.onProgress,
    })
  } catch (error) {
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
    clearTimeout(timeoutId)
    input.onAttemptFinished()
  }
}

export const createBrowserAnalysisSession = (): AnalysisSession => {
  let snapshot: AnalysisSessionSnapshot = { phase: "idle" }
  let activeController: AbortController | null = null
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

  const analyze = async (url: string, turnstileToken?: string) => {
    activeController?.abort()
    analysisGeneration += 1
    const generation = analysisGeneration
    pendingOutputs.clear()
    const startedAt = performance.now()
    publish({ phase: "analyzing", url })

    try {
      const outcome = await requestAnalysisWithRetries({
        url,
        turnstileToken,
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
          activeController = controller
        },
        onAttemptFinished: () => {
          if (generation === analysisGeneration) {
            activeController = null
          }
        },
      })

      const analysis: AnalysisResult = {
        url,
        requestId: outcome.requestId,
        outputs: outcome.outputs,
        durationMs: performance.now() - startedAt,
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

  const output = async (format: AnalysisOutputId): Promise<string> => {
    if (snapshot.phase !== "ready") {
      throw new Error("Analyze a URL before requesting another format.")
    }

    const cached = snapshot.analysis.outputs[format]

    if (cached) {
      return cached
    }

    const pending = pendingOutputs.get(format)

    if (pending) {
      return pending
    }

    const { analysis } = snapshot

    const request = (async () => {
      const operationId = crypto.randomUUID()

      const requestOnce = async () => {
        const response = await fetch("/resource/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: analysis.url,
            format: [format],
            operationId,
          }),
        })

        let payload: unknown

        try {
          payload = await response.json()
        } catch {
          throw new Error("Analyzer service returned malformed data.")
        }

        const parsed = Schema.decodeUnknownResult(AnalyzeResponseSchema)(
          payload
        )

        if (Result.isFailure(parsed)) {
          throw new Error("Analyzer service returned malformed data.")
        }

        return { response, data: parsed.success }
      }

      const outcome = await requestOnce()

      if (!outcome.response.ok || !outcome.data.success) {
        throw new Error(
          outcome.data.success
            ? `No ${format.toUpperCase()} content returned.`
            : outcome.data.error.message
        )
      }

      const content = outcome.data.results[format]

      if (!content) {
        throw new Error(`No ${format.toUpperCase()} content returned.`)
      }

      const nextAnalysis: AnalysisResult = {
        ...analysis,
        outputs: { ...analysis.outputs, [format]: content },
      }

      if (snapshot.phase === "ready" && snapshot.analysis === analysis) {
        publish({ phase: "ready", analysis: nextAnalysis })
      }

      return content
    })().finally(() => {
      pendingOutputs.delete(format)
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
      activeController?.abort(
        new DOMException("Analysis request cancelled.", "AbortError")
      )
    },
    dispose() {
      isDisposed = true
      activeController?.abort(
        new DOMException("Analysis request cancelled.", "AbortError")
      )
      listeners.clear()
    },
  }
}
