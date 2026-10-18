import { afterEach, describe, expect, it, vi } from "vitest"

import { MAX_PRIVATEBIN_RESPONSE_BYTES } from "~/constants"

import { uploadToPrivateBin } from "./privatebin"

describe("uploadToPrivateBin", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("cancels and rejects an oversized response body", async () => {
    const cancel = vi.fn()

    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(MAX_PRIVATEBIN_RESPONSE_BYTES + 1))
      },
      cancel,
    })

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(body, { status: 200 })
    )

    await expect(uploadToPrivateBin("report data")).rejects.toThrow(
      "PrivateBin response exceeded the maximum size."
    )
    expect(cancel).toHaveBeenCalledOnce()
  })

  it("passes caller cancellation to the upload request", async () => {
    const controller = new AbortController()
    const cancellation = new DOMException("Upload cancelled.", "AbortError")
    controller.abort(cancellation)

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_input, init) => {
        const signal = init?.signal

        expect(signal?.aborted).toBe(true)
        throw signal?.reason
      })

    await expect(
      uploadToPrivateBin("report data", controller.signal)
    ).rejects.toThrow("Upload cancelled.")
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})
