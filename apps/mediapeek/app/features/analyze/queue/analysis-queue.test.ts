import { describe, expect, it, vi } from "vitest"

import type {
  AnalysisResult,
  AnalysisSession,
  AnalysisSessionSnapshot,
} from "../analysis-session"
import { createAnalysisQueue } from "./analysis-queue"

const result = (url: string): AnalysisResult => ({
  url,
  outputs: { json: JSON.stringify({ url }) },
})

const createDeferred = <Value>() => {
  let resolvePromise: ((value: Value) => void) | undefined
  let rejectPromise: ((error: Error) => void) | undefined

  const promise = new Promise<Value>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })

  return {
    promise,
    reject(error: Error) {
      if (!rejectPromise) {
        throw new Error("Deferred promise was not initialized.")
      }

      rejectPromise(error)
    },
    resolve(value: Value) {
      if (!resolvePromise) {
        throw new Error("Deferred promise was not initialized.")
      }

      resolvePromise(value)
    },
  }
}

const createFakeSession = (
  analyze: AnalysisSession["analyze"] = async (url) => result(url)
) => {
  let snapshot: AnalysisSessionSnapshot = { phase: "idle" }
  const listeners = new Set<() => void>()

  const publish = (next: AnalysisSessionSnapshot) => {
    snapshot = next

    for (const listener of listeners) {
      listener()
    }
  }

  const analyzeMock = vi.fn(
    async (
      url: string,
      token?: string,
      requestTurnstileToken?: () => Promise<string | null>
    ) => {
      publish({ phase: "analyzing", url })

      try {
        return await analyze(url, token, requestTurnstileToken)
      } finally {
        publish({ phase: "idle" })
      }
    }
  )

  const cancelMock = vi.fn()

  const session: AnalysisSession = {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)

      return () => listeners.delete(listener)
    },
    analyze: (url, token, requestTurnstileToken) =>
      analyzeMock(url, token, requestTurnstileToken),
    output: async () => "",
    cancel: cancelMock,
    dispose: vi.fn(),
  }

  return { session, publish, analyzeMock, cancelMock }
}

const waitForStatuses = async (
  queue: ReturnType<typeof createAnalysisQueue>,
  statuses: ReadonlyArray<string>
) => {
  await vi.waitFor(() => {
    expect(queue.getSnapshot().items.map((item) => item.status)).toEqual(
      statuses
    )
  })
}

describe("analysis queue", () => {
  it("queues newline-separated URLs and analyzes them one at a time", async () => {
    let activeCount = 0
    let maximumActiveCount = 0

    const { session, analyzeMock } = createFakeSession(async (url) => {
      activeCount += 1
      maximumActiveCount = Math.max(maximumActiveCount, activeCount)
      await Promise.resolve()
      activeCount -= 1

      return result(url)
    })

    const queue = createAnalysisQueue(session, () => crypto.randomUUID())
    queue.activate()

    const outcomes = queue.add(
      " https://example.com/one.mp4 \n\nhttps://example.com/two.mp4\nhttps://example.com/three.mp4 "
    )

    expect(outcomes.map((outcome) => outcome.kind)).toEqual([
      "queued",
      "queued",
      "queued",
    ])
    await waitForStatuses(queue, ["done", "done", "done"])
    expect(analyzeMock).toHaveBeenCalledTimes(3)
    expect(maximumActiveCount).toBe(1)
    expect(queue.getSnapshot().items.map((item) => item.analysis?.url)).toEqual(
      [
        "https://example.com/one.mp4",
        "https://example.com/two.mp4",
        "https://example.com/three.mp4",
      ]
    )

    queue.dispose()
  })

  it("reports invalid URLs and canonical duplicates without submitting them", async () => {
    const { session, analyzeMock } = createFakeSession()
    const queue = createAnalysisQueue(session, () => "item-1")
    queue.activate()

    const [queued, invalid, duplicate] = queue.add(
      "https://example.com/video.mp4\nftp://example.com/video.mp4\nhttps://EXAMPLE.com/video.mp4"
    )

    expect(queued?.kind).toBe("queued")
    expect(invalid).toEqual({
      kind: "error",
      url: "ftp://example.com/video.mp4",
      message: "Enter a valid media URL.",
    })
    expect(duplicate).toEqual({
      kind: "duplicate",
      itemId: "item-1",
      url: "https://EXAMPLE.com/video.mp4",
    })
    await waitForStatuses(queue, ["done"])
    expect(analyzeMock).toHaveBeenCalledTimes(1)

    queue.dispose()
  })

  it("passes a Turnstile token to only the first accepted item", async () => {
    const { session, analyzeMock } = createFakeSession()

    const queue = createAnalysisQueue(
      session,
      (() => {
        let nextId = 0

        return () => {
          nextId += 1

          return `item-${String(nextId)}`
        }
      })()
    )

    queue.activate()

    const requestTurnstileToken = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValue("fresh-turnstile-token")

    queue.add(
      "https://example.com/one.mp4\nhttps://example.com/two.mp4",
      "turnstile-token",
      requestTurnstileToken
    )
    await waitForStatuses(queue, ["done", "done"])

    expect(analyzeMock).toHaveBeenNthCalledWith(
      1,
      "https://example.com/one.mp4",
      "turnstile-token",
      requestTurnstileToken
    )
    expect(analyzeMock).toHaveBeenNthCalledWith(
      2,
      "https://example.com/two.mp4",
      undefined,
      requestTurnstileToken
    )

    queue.dispose()
  })

  it("keeps failures retryable and carries analysis progress into the item", async () => {
    let attempts = 0
    const firstAttempt = createDeferred<AnalysisResult>()

    const { session, publish, analyzeMock } = createFakeSession(async (url) => {
      attempts += 1

      if (attempts === 1) {
        publish({
          phase: "analyzing",
          url,
          progress: { title: "Reading source", message: "Checking ranges." },
        })

        return await firstAttempt.promise
      }

      return result(url)
    })

    const queue = createAnalysisQueue(session, () => "retry-item")
    queue.activate()
    queue.add("https://example.com/retry.mp4")

    expect(queue.getSnapshot().items[0]).toMatchObject({
      status: "analyzing",
      progress: { title: "Reading source", message: "Checking ranges." },
    })

    firstAttempt.reject(new Error("Temporary failure."))
    await waitForStatuses(queue, ["error"])
    expect(queue.getSnapshot().items[0]?.message).toBe("Temporary failure.")

    expect(queue.retry("retry-item")).toEqual({
      kind: "queued",
      itemId: "retry-item",
      url: "https://example.com/retry.mp4",
    })
    await waitForStatuses(queue, ["done"])
    expect(analyzeMock).toHaveBeenCalledTimes(2)

    queue.dispose()
  })

  it("cancels and removes the active item before starting the next one", async () => {
    let rejectActive: ((error: Error) => void) | undefined

    const { session, analyzeMock, cancelMock } = createFakeSession((url) => {
      if (url.endsWith("one.mp4")) {
        return new Promise<AnalysisResult>((_resolve, reject) => {
          rejectActive = reject
        })
      }

      return Promise.resolve(result(url))
    })

    cancelMock.mockImplementation(() => {
      rejectActive?.(new DOMException("Cancelled.", "AbortError"))
    })

    const queue = createAnalysisQueue(
      session,
      (() => {
        let nextId = 0

        return () => {
          nextId += 1

          return `item-${String(nextId)}`
        }
      })()
    )

    queue.activate()

    queue.add("https://example.com/one.mp4\nhttps://example.com/two.mp4")
    expect(queue.remove("item-1")).toBe(true)
    await waitForStatuses(queue, ["done"])

    expect(cancelMock).toHaveBeenCalledOnce()
    expect(analyzeMock).toHaveBeenCalledTimes(2)
    expect(queue.getSnapshot().items[0]?.url).toBe(
      "https://example.com/two.mp4"
    )

    queue.dispose()
  })
})
