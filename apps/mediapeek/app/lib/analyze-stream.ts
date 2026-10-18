import type { AnalyzeErrorCode } from "@mediapeek/shared/analyze-contract"
import {
  ANALYZE_PROGRESS_STREAM_CONTENT_TYPE,
  type AnalyzeProgressStage,
  type AnalyzeStreamErrorEvent,
  type AnalyzeStreamProgressEvent,
  type AnalyzeStreamSuccessEvent,
} from "@mediapeek/shared/analyze-progress"
import { Result, Schema } from "effect"

type AnalyzeStreamTerminalEvent =
  | AnalyzeStreamErrorEvent
  | AnalyzeStreamSuccessEvent

const ANALYZE_PROGRESS_STAGES = [
  "request_received",
  "source_probe_started",
  "source_probe_completed",
  "initial_fetch_started",
  "waiting_for_first_byte",
  "first_byte_received",
  "initial_segment_reading",
  "no_range_fallback_started",
  "source_range_unsupported",
  "remote_seek_fetch_started",
  "analysis_started",
  "analysis_completed",
] as const satisfies readonly AnalyzeProgressStage[]

const ANALYZE_ERROR_CODES = [
  "AUTH_REQUIRED",
  "AUTH_INVALID",
  "RATE_LIMITED",
  "VALIDATION_FAILED",
  "CPU_BUDGET_EXCEEDED",
  "UPSTREAM_FETCH_FAILED",
  "INTERNAL_ERROR",
] as const satisfies readonly AnalyzeErrorCode[]

const analyzeStreamEventSchema = Schema.Union([
  Schema.Struct({
    type: Schema.Literal("progress"),
    requestId: Schema.String,
    stage: Schema.Literals(ANALYZE_PROGRESS_STAGES),
    title: Schema.String,
    message: Schema.String,
  }),
  Schema.Struct({
    type: Schema.Literal("success"),
    requestId: Schema.String,
    results: Schema.Record(Schema.String, Schema.String),
  }),
  Schema.Struct({
    type: Schema.Literal("error"),
    requestId: Schema.String,
    error: Schema.Struct({
      code: Schema.Literals(ANALYZE_ERROR_CODES),
      message: Schema.String,
      retryable: Schema.Boolean,
    }),
  }),
])

type AnalyzeStreamEvent = typeof analyzeStreamEventSchema.Type

const parseAnalyzeStreamEvent = (line: string): AnalyzeStreamEvent => {
  let parsedJson: Schema.Json

  try {
    parsedJson = Schema.decodeUnknownSync(Schema.Json)(JSON.parse(line))
  } catch {
    throw new Error("The analysis response stream contains invalid JSON.")
  }

  const parsedEvent = Schema.decodeUnknownResult(analyzeStreamEventSchema)(
    parsedJson
  )

  if (Result.isFailure(parsedEvent)) {
    throw new Error("The analysis response stream contains an invalid event.")
  }

  return parsedEvent.success
}

export function isAnalyzeProgressStreamResponse(response: Response): boolean {
  return (
    response.headers
      .get("content-type")
      ?.includes(ANALYZE_PROGRESS_STREAM_CONTENT_TYPE) ?? false
  )
}

const processAvailableLines = (
  input: string,
  processLine: (line: string) => void
) => {
  let buffer = input
  let newlineIndex = buffer.indexOf("\n")

  while (newlineIndex >= 0) {
    processLine(buffer.slice(0, newlineIndex))
    buffer = buffer.slice(newlineIndex + 1)
    newlineIndex = buffer.indexOf("\n")
  }

  return buffer
}

interface ConsumeStreamOptions {
  reader: ReadableStreamDefaultReader<Uint8Array>
  decoder: TextDecoder
  buffer: string
  processLine: (line: string) => void
}

const consumeStream = async ({
  reader,
  decoder,
  buffer,
  processLine,
}: ConsumeStreamOptions): Promise<string> => {
  const chunk = await reader.read()

  if (chunk.done) {
    return buffer + decoder.decode()
  }

  const nextBuffer = buffer + decoder.decode(chunk.value, { stream: true })
  const remaining = processAvailableLines(nextBuffer, processLine)

  return consumeStream({ reader, decoder, buffer: remaining, processLine })
}

export async function readAnalyzeStreamResponse(
  response: Response,
  onProgress: (event: AnalyzeStreamProgressEvent) => void
): Promise<AnalyzeStreamTerminalEvent> {
  const reader = response.body?.getReader()

  if (!reader) {
    throw new Error("The analysis response stream has no readable body.")
  }

  const decoder = new TextDecoder()
  let terminalEvent: AnalyzeStreamTerminalEvent | undefined

  const processLine = (line: string) => {
    const normalizedLine = line.trim()

    if (!normalizedLine) {
      return
    }

    const event = parseAnalyzeStreamEvent(normalizedLine)

    if (terminalEvent) {
      throw new Error("The analysis response stream contains multiple results.")
    }

    if (event.type === "progress") {
      onProgress(event)

      return
    }

    terminalEvent = event
  }

  try {
    const finalBuffer = await consumeStream({
      reader,
      decoder,
      buffer: "",
      processLine,
    })

    processLine(finalBuffer)

    if (!terminalEvent) {
      throw new Error(
        "The analysis response stream ended before a result arrived."
      )
    }

    return terminalEvent
  } finally {
    reader.releaseLock()
  }
}
