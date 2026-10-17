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

  it("rejects malformed events and streams without a terminal result", async () => {
    await expect(
      readAnalyzeStreamResponse(
        createStreamResponse(['{"type":"unknown"}\n']),
        vi.fn()
      )
    ).rejects.toThrow("The analysis response stream contains an invalid event.")

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
