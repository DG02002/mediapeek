import { encodeAnalyzeStreamEvent } from "@mediapeek/shared/analyze-progress"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ANALYSIS_REQUEST_TIMEOUT_MS } from "~/constants"

import { createBrowserAnalysisSession } from "./analysis-session"

type AnalysisSessionTestResponse =
  | {
      readonly success: true
      readonly requestId: string
      readonly results: Record<string, string>
    }
  | {
      readonly success: false
      readonly requestId: string
      readonly error: {
        readonly code: "AUTH_REQUIRED" | "AUTH_INVALID"
        readonly message: string
        readonly retryable: boolean
      }
    }

const jsonResponse = (payload: AnalysisSessionTestResponse, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  })

const streamResponse = (...events: string[]) =>
  new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder()

        for (const event of events) {
          controller.enqueue(encoder.encode(event))
        }

        controller.close()
      },
    }),
    { headers: { "Content-Type": "application/x-ndjson" } }
  )

describe("browser Analysis session", () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("normalizes streamed progress and success into a ready snapshot", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      streamResponse(
        encodeAnalyzeStreamEvent({
          type: "progress",
          requestId: "request-1",
          stage: "analysis_started",
          title: "Running Media Analysis",
          message: "MediaInfo is parsing the source.",
        }),
        encodeAnalyzeStreamEvent({
          type: "success",
          requestId: "request-1",
          results: { json: '{"media":{}}' },
        })
      )
    )
    const session = createBrowserAnalysisSession()
    const snapshots: unknown[] = []
    session.subscribe(() => snapshots.push(session.getSnapshot()))

    const analysis = await session.analyze("https://example.com/video.mp4")

    expect(analysis).toMatchObject({
      url: "https://example.com/video.mp4",
      requestId: "request-1",
      outputs: { json: '{"media":{}}' },
    })
    expect(snapshots).toContainEqual({
      phase: "analyzing",
      url: "https://example.com/video.mp4",
      progress: {
        title: "Running Media Analysis",
        message: "MediaInfo is parsing the source.",
      },
    })
    expect(session.getSnapshot()).toMatchObject({ phase: "ready", analysis })
  })

  it("normalizes the JSON fallback into the same ready result", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        success: true,
        requestId: "request-2",
        results: { json: '{"media":{}}' },
      })
    )
    const session = createBrowserAnalysisSession()

    const analysis = await session.analyze("https://example.com/video.mp4")

    expect(analysis).toMatchObject({
      requestId: "request-2",
      outputs: { json: '{"media":{}}' },
    })
    expect(session.getSnapshot()).toMatchObject({ phase: "ready", analysis })
  })

  it("attaches an optional Turnstile token to the initial request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      jsonResponse({
        success: true,
        requestId: "request-turnstile",
        results: { json: '{"media":{}}' },
      })
    )

    const session = createBrowserAnalysisSession()

    await session.analyze("https://example.com/video.mp4", "turnstile-token")

    const requestHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers)

    expect(requestHeaders.get("CF-Turnstile-Response")).toBe("turnstile-token")
  })

  it("retries a streamed analysis once with a requested Turnstile token", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(
          {
            success: false,
            requestId: "request-blocked",
            error: {
              code: "AUTH_REQUIRED",
              message: "Security verification is required.",
              retryable: false,
            },
          },
          403
        )
      )
      .mockResolvedValueOnce(
        streamResponse(
          encodeAnalyzeStreamEvent({
            type: "success",
            requestId: "request-verified",
            results: { json: '{"media":{}}' },
          })
        )
      )

    const requestTurnstileToken = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValue("fresh-token")

    const session = createBrowserAnalysisSession()

    await expect(
      session.analyze(
        "https://example.com/video.mp4",
        undefined,
        requestTurnstileToken
      )
    ).resolves.toMatchObject({ requestId: "request-verified" })

    expect(requestTurnstileToken).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(
      new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get(
        "CF-Turnstile-Response"
      )
    ).toBe("fresh-token")
    expect(
      new Headers(fetchMock.mock.calls[1]?.[1]?.headers).get("Accept")
    ).toBe("application/x-ndjson")
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(
      fetchMock.mock.calls[0]?.[1]?.body
    )
  })

  it("does not time out while waiting for a Turnstile token", async () => {
    vi.useFakeTimers()

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse(
          {
            success: false,
            requestId: "request-blocked",
            error: {
              code: "AUTH_REQUIRED",
              message: "Security verification is required.",
              retryable: false,
            },
          },
          403
        )
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          requestId: "request-verified",
          results: { json: "{}" },
        })
      )

    let resolveToken: ((token: string | null) => void) | undefined
    let signalTokenRequested: (() => void) | undefined

    const tokenRequested = new Promise<void>((resolve) => {
      signalTokenRequested = resolve
    })

    const requestTurnstileToken = vi.fn(
      () =>
        new Promise<string | null>((resolve) => {
          resolveToken = resolve
          signalTokenRequested?.()
        })
    )

    const session = createBrowserAnalysisSession()

    const pending = session.analyze(
      "https://example.com/video.mp4",
      undefined,
      requestTurnstileToken
    )

    await tokenRequested
    await vi.advanceTimersByTimeAsync(ANALYSIS_REQUEST_TIMEOUT_MS + 1)
    resolveToken?.("fresh-token")

    await expect(pending).resolves.toMatchObject({
      requestId: "request-verified",
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("keeps a progress stream alive when events arrive within the timeout", async () => {
    vi.useFakeTimers()
    const encoder = new TextEncoder()
    let progressIndex = 0

    const response = new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              encodeAnalyzeStreamEvent({
                type: "progress",
                requestId: "request-live",
                stage: "analysis_started",
                title: "Running Media Analysis",
                message: "Started.",
              })
            )
          )
        },
        pull(controller) {
          return new Promise<void>((resolve) => {
            setTimeout(() => {
              progressIndex += 1

              if (progressIndex < 2) {
                controller.enqueue(
                  encoder.encode(
                    encodeAnalyzeStreamEvent({
                      type: "progress",
                      requestId: "request-live",
                      stage: "analysis_started",
                      title: "Running Media Analysis",
                      message: `Progress ${String(progressIndex)}.`,
                    })
                  )
                )
              } else {
                controller.enqueue(
                  encoder.encode(
                    encodeAnalyzeStreamEvent({
                      type: "success",
                      requestId: "request-live",
                      results: { json: "{}" },
                    })
                  )
                )
                controller.close()
              }

              resolve()
            }, ANALYSIS_REQUEST_TIMEOUT_MS - 1_000)
          })
        },
      }),
      { headers: { "Content-Type": "application/x-ndjson" } }
    )

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response)
    const session = createBrowserAnalysisSession()
    const pending = session.analyze("https://example.com/video.mp4")

    await vi.advanceTimersByTimeAsync(ANALYSIS_REQUEST_TIMEOUT_MS - 1_000)
    await vi.advanceTimersByTimeAsync(ANALYSIS_REQUEST_TIMEOUT_MS - 1_000)

    await expect(pending).resolves.toMatchObject({ requestId: "request-live" })
  })

  it("fails closed when the JSON fallback is malformed", async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response("{not-json", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
    )
    const session = createBrowserAnalysisSession()

    const pending = session.analyze("https://example.com/video.mp4")
    void pending.catch(() => undefined)
    await vi.runAllTimersAsync()
    await expect(pending).rejects.toThrow(
      "Analyzer service returned malformed data."
    )
    expect(session.getSnapshot()).toEqual({
      phase: "failed",
      url: "https://example.com/video.mp4",
      message: "Analyzer service returned malformed data.",
    })
  })

  it("fails closed when the progress stream is malformed", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      streamResponse("{not-json}\n")
    )
    const session = createBrowserAnalysisSession()

    await expect(
      session.analyze("https://example.com/video.mp4")
    ).rejects.toThrow("The analysis response stream contains invalid JSON.")
  })

  it("retries a transient request failure and then succeeds", async () => {
    vi.useFakeTimers()

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("network unavailable"))
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          requestId: "request-retry",
          results: { json: '{"media":{}}' },
        })
      )

    const session = createBrowserAnalysisSession()

    const pending = session.analyze("https://example.com/video.mp4")
    await vi.runAllTimersAsync()

    await expect(pending).resolves.toMatchObject({
      requestId: "request-retry",
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("aborts the active request when cancelled", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(init.signal?.reason)
          })
        })
    )

    const session = createBrowserAnalysisSession()

    const pending = session.analyze("https://example.com/video.mp4")
    session.cancel()

    await expect(pending).rejects.toMatchObject({ name: "AbortError" })
    expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
  })

  it("aborts an attempt when its timeout expires", async () => {
    vi.useFakeTimers()
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(init.signal?.reason)
          })
        })
    )
    const session = createBrowserAnalysisSession()
    const pending = session.analyze("https://example.com/video.mp4")
    void pending.catch(() => undefined)

    await vi.advanceTimersByTimeAsync(90_000)

    await expect(pending).rejects.toMatchObject({
      name: "TimeoutError",
      message: "Analysis request timed out.",
    })
  })

  it("generates and caches a follow-up output through the same session", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          requestId: "request-initial",
          results: { json: '{"media":{}}' },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          requestId: "request-text",
          results: { text: "General\nComplete name : video.mp4" },
        })
      )

    const session = createBrowserAnalysisSession()
    await session.analyze("https://example.com/video.mp4")

    await expect(session.output("text")).resolves.toContain("Complete name")
    await expect(session.output("text")).resolves.toContain("Complete name")

    expect(fetchMock).toHaveBeenCalledTimes(2)

    const followUpBody = await new Response(
      fetchMock.mock.calls[1]?.[1]?.body
    ).text()

    expect(followUpBody).toContain(
      '{"url":"https://example.com/video.mp4","format":["text"]'
    )
    expect(followUpBody).toMatch(/"operationId":"[^"]+"/)
  })

  it("caches an empty follow-up output", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          requestId: "request-initial",
          results: { json: "{}" },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          requestId: "request-empty-text",
          results: { text: "" },
        })
      )

    const session = createBrowserAnalysisSession()

    await session.analyze("https://example.com/video.mp4")

    await expect(session.output("text")).resolves.toBe("")
    await expect(session.output("text")).resolves.toBe("")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("retries a follow-up output once after requesting a Turnstile token", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          requestId: "request-initial",
          results: { json: '{"media":{}}' },
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(
          {
            success: false,
            requestId: "request-blocked",
            error: {
              code: "AUTH_INVALID",
              message: "Security verification is required.",
              retryable: false,
            },
          },
          403
        )
      )
      .mockResolvedValueOnce(
        jsonResponse({
          success: true,
          requestId: "request-text",
          results: { text: "General\\nComplete name : video.mp4" },
        })
      )

    const requestTurnstileToken = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValue("fresh-token")

    const session = createBrowserAnalysisSession()

    await session.analyze("https://example.com/video.mp4")

    await expect(
      session.output("text", requestTurnstileToken)
    ).resolves.toContain("Complete name")

    expect(requestTurnstileToken).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(
      new Headers(fetchMock.mock.calls[2]?.[1]?.headers).get(
        "CF-Turnstile-Response"
      )
    ).toBe("fresh-token")

    const firstOutputBody = await new Response(
      fetchMock.mock.calls[1]?.[1]?.body
    ).text()

    const retriedOutputBody = await new Response(
      fetchMock.mock.calls[2]?.[1]?.body
    ).text()

    expect(JSON.parse(retriedOutputBody).operationId).toBe(
      JSON.parse(firstOutputBody).operationId
    )
  })
})
