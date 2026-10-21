import {
  AnalyzeStreamEventSchema,
  encodeAnalyzeStreamEvent,
  type AnalyzeStreamEvent,
} from "@mediapeek/shared/analyze-progress"
import { Result, Schema } from "effect"
import { describe, expect, it, vi } from "vitest"

import {
  isAnalyzeProgressStreamResponse,
  readAnalyzeStreamResponse,
} from "./analyze-stream"

function createStreamResponse(chunks: readonly string[]) {
  const encoder = new TextEncoder()

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }

      controller.close()
    },
  })

  return new Response(body, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8" },
  })
}

describe("analyze stream", () => {
  it("recognizes the progress stream content type", () => {
    expect(
      isAnalyzeProgressStreamResponse(
        new Response(null, {
          headers: { "content-type": "application/x-ndjson; charset=utf-8" },
        })
      )
    ).toBe(true)
    expect(isAnalyzeProgressStreamResponse(new Response(null))).toBe(false)
  })

  it("reads progress events and a terminal success across chunk boundaries", async () => {
    const progressEvent = JSON.stringify({
      type: "progress",
      requestId: "request-1",
      stage: "analysis_started",
      title: "Analyzing media",
      message: "Reading media tracks.",
    })

    const successEvent = JSON.stringify({
      type: "success",
      requestId: "request-1",
      results: { json: '{"media":{}}' },
    })

    const onProgress = vi.fn()

    const result = await readAnalyzeStreamResponse(
      createStreamResponse([
        progressEvent.slice(0, 17),
        `${progressEvent.slice(17)}\n${successEvent.slice(0, 12)}`,
        successEvent.slice(12),
      ]),
      onProgress
    )

    expect(onProgress).toHaveBeenCalledWith({
      type: "progress",
      requestId: "request-1",
      stage: "analysis_started",
      title: "Analyzing media",
      message: "Reading media tracks.",
    })
    expect(result).toEqual({
      type: "success",
      requestId: "request-1",
      results: { json: '{"media":{}}' },
    })
  })

  it("accepts events defined by the shared stream contract", async () => {
    const events: readonly AnalyzeStreamEvent[] = [
      {
        type: "progress",
        requestId: "request-shared",
        stage: "source_range_unsupported",
        title: "Using a full response",
        message: "The source does not support byte ranges.",
      },
      {
        type: "success",
        requestId: "request-shared",
        results: { json: '{"media":{}}' },
      },
    ]

    for (const event of events) {
      expect(
        Result.isSuccess(
          Schema.decodeUnknownResult(AnalyzeStreamEventSchema)(event)
        )
      ).toBe(true)
    }

    const onProgress = vi.fn()

    const result = await readAnalyzeStreamResponse(
      createStreamResponse(events.map(encodeAnalyzeStreamEvent)),
      onProgress
    )

    expect(onProgress).toHaveBeenCalledWith(events[0])
    expect(result).toEqual(events[1])
  })

  it("returns an error terminal event", async () => {
    const errorEvent = JSON.stringify({
      type: "error",
      requestId: "request-2",
      error: {
        code: "UPSTREAM_FETCH_FAILED",
        message: "The source could not be fetched.",
        retryable: true,
      },
    })

    await expect(
      readAnalyzeStreamResponse(createStreamResponse([errorEvent]), vi.fn())
    ).resolves.toEqual({
      type: "error",
      requestId: "request-2",
      error: {
        code: "UPSTREAM_FETCH_FAILED",
        message: "The source could not be fetched.",
        retryable: true,
      },
    })
  })

  it("skips unknown progress stages and continues to the terminal event", async () => {
    const onProgress = vi.fn()

    await expect(
      readAnalyzeStreamResponse(
        createStreamResponse([
          '{"type":"progress","requestId":"request-new","stage":"future_stage","title":"New stage","message":"New progress."}\n',
          '{"type":"success","requestId":"request-new","results":{"json":"{}"}}\n',
        ]),
        onProgress
      )
    ).resolves.toEqual({
      type: "success",
      requestId: "request-new",
      results: { json: "{}" },
    })

    expect(onProgress).not.toHaveBeenCalled()
  })

  it("rejects malformed events and streams without a terminal result", async () => {
    await expect(
      readAnalyzeStreamResponse(
        createStreamResponse(['{"type":"unknown"}\n']),
        vi.fn()
      )
    ).rejects.toThrow("The analysis response stream contains an invalid event.")

    await Promise.all(
      [
        '{"type":"success","results":{"json":"{}"}}\n',
        '{"type":"success","requestId":3,"results":{"json":"{}"}}\n',
      ].map((invalidEvent) =>
        expect(
          readAnalyzeStreamResponse(
            createStreamResponse([invalidEvent]),
            vi.fn()
          )
        ).rejects.toThrow(
          "The analysis response stream contains an invalid event."
        )
      )
    )

    await expect(
      readAnalyzeStreamResponse(
        createStreamResponse([
          `${JSON.stringify({
            type: "progress",
            requestId: "request-3",
            stage: "analysis_started",
            title: "Analyzing media",
            message: "Reading media tracks.",
          })}\n`,
        ]),
        vi.fn()
      )
    ).rejects.toThrow(
      "The analysis response stream ended before a result arrived."
    )
  })
})
