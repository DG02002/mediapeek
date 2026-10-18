import { ANALYZE_PROGRESS_STREAM_CONTENT_TYPE } from "@mediapeek/shared/analyze-progress"
import { Result, Schema } from "effect"

const encoder = new TextEncoder()

const AnalyzeTestRequestSchema = Schema.Struct({
  url: Schema.String,
})

/**
 * A held stream stays open until the test ends, which keeps its queue item in
 * the analyzing state while the test asserts on intermediate progress.
 */
interface HeldAnalyzeStream {
  readonly emitProgress: (title: string, message: string) => void
}

interface StreamControllerRef {
  current: ReadableStreamDefaultController<Uint8Array> | null
}

type AnalyzeScript =
  | { readonly kind: "success"; readonly results: Record<string, string> }
  | { readonly kind: "error"; readonly message: string }
  | {
      readonly kind: "held"
      readonly respond: (init?: RequestInit) => Response
      readonly emitProgress: (title: string, message: string) => void
    }

export interface AnalyzeServer {
  readonly fetch: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>
  readonly enqueueSuccess: (
    url: string,
    results: Record<string, string>
  ) => void
  readonly enqueueError: (url: string, message: string) => void
  readonly hold: (url: string) => HeldAnalyzeStream
}

const ndjsonResponse = (events: ReadonlyArray<object>) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
        }

        controller.close()
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": ANALYZE_PROGRESS_STREAM_CONTENT_TYPE },
    }
  )

const errorEvent = (requestId: string, message: string) => ({
  type: "error",
  requestId,
  error: {
    code: "UPSTREAM_FETCH_FAILED",
    message,
    retryable: false,
  },
})

const progressEvent = (requestId: string, title: string, message: string) => ({
  type: "progress",
  requestId,
  stage: "source_probe_started",
  title,
  message,
})

const parseRequestUrl = (init?: RequestInit): string => {
  const body = init?.body

  if (!Schema.is(Schema.String)(body)) {
    return ""
  }

  try {
    const decoded = Schema.decodeUnknownResult(AnalyzeTestRequestSchema)(
      JSON.parse(body)
    )

    return Result.isSuccess(decoded) ? decoded.success.url : ""
  } catch {
    return ""
  }
}

export const createAnalyzeServer = (): AnalyzeServer => {
  const scripts = new Map<string, AnalyzeScript[]>()

  const push = (url: string, script: AnalyzeScript) => {
    const queue = scripts.get(url) ?? []

    queue.push(script)
    scripts.set(url, queue)
  }

  return {
    enqueueSuccess: (url, results) => {
      push(url, { kind: "success", results })
    },
    enqueueError: (url, message) => {
      push(url, { kind: "error", message })
    },
    hold: (url) => {
      let requestId = ""
      const controllerRef: StreamControllerRef = { current: null }

      const emitProgress = (title: string, message: string) => {
        controllerRef.current?.enqueue(
          encoder.encode(
            `${JSON.stringify(progressEvent(requestId, title, message))}\n`
          )
        )
      }

      const respond = (init?: RequestInit) => {
        requestId = crypto.randomUUID()

        const signal = init?.signal

        if (signal) {
          signal.addEventListener(
            "abort",
            () => {
              controllerRef.current?.error(signal.reason)
            },
            { once: true }
          )
        }

        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controllerRef.current = controller
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": ANALYZE_PROGRESS_STREAM_CONTENT_TYPE },
          }
        )
      }

      push(url, { kind: "held", respond, emitProgress })

      return { emitProgress }
    },
    fetch: async (_input, init) => {
      const url = parseRequestUrl(init)

      const script = scripts.get(url)?.shift()

      if (!script) {
        return ndjsonResponse([
          errorEvent(
            crypto.randomUUID(),
            `No analysis was scripted for ${url}.`
          ),
        ])
      }

      if (script.kind === "success") {
        return ndjsonResponse([
          {
            type: "success",
            requestId: crypto.randomUUID(),
            results: script.results,
          },
        ])
      }

      if (script.kind === "error") {
        return ndjsonResponse([errorEvent(crypto.randomUUID(), script.message)])
      }

      return script.respond(init)
    },
  }
}
