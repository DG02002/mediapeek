import { describe, expect, it, vi } from "vitest"

import { createRequestLogState } from "./request-log-state"

describe("createRequestLogState", () => {
  it("runs the finalizer only once", () => {
    const state = createRequestLogState({
      requestId: "request-id",
      initialContext: {},
    })

    const onFinalize = vi.fn()

    state.finalize(onFinalize)
    state.finalize(onFinalize)

    expect(onFinalize).toHaveBeenCalledTimes(1)
  })
})
