import {
  AnalyzeStreamEventSchema,
  ANALYZE_PROGRESS_STREAM_CONTENT_TYPE,
  type AnalyzeStreamEvent,
  type AnalyzeStreamErrorEvent,
  type AnalyzeStreamProgressEvent,
  type AnalyzeStreamSuccessEvent,
} from "@mediapeek/shared/analyze-progress"
import { Result, Schema } from "effect"

type AnalyzeStreamTerminalEvent =
  | AnalyzeStreamErrorEvent
  | AnalyzeStreamSuccessEvent

const parseAnalyzeStreamEvent = (line: string): AnalyzeStreamEvent | null => {
  let parsedJson: Schema.Json

  try {
    parsedJson = Schema.decodeUnknownSync(Schema.Json)(JSON.parse(line))
  } catch {
    throw new Error("The analysis response stream contains invalid JSON.")
  }

  const parsedEvent = Schema.decodeUnknownResult(AnalyzeStreamEventSchema)(
    parsedJson
  )

  if (Result.isFailure(parsedEvent)) {
    const parsedObject = Schema.decodeUnknownResult(
      Schema.Record(Schema.String, Schema.Json)
    )(parsedJson)

    if (
      Result.isSuccess(parsedObject) &&
      parsedObject.success.type === "progress"
    ) {
      return null
    }

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

    if (!event) {
      return
    }

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
