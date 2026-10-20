import { afterEach, describe, expect, it, vi } from "vitest"

import {
  createExecution,
  finalizeAnalyzeRequest,
} from "~/lib/analyze-request-log.server"
import * as requestLogger from "~/lib/request-logger.server"

import {
  handleUnexpectedError,
  type AnalyzeRouteResponseState,
} from "./analyze-response.server"

describe("analyze request logging", () => {
  afterEach(() => vi.restoreAllMocks())

  it("hides internal details from visitors and retains them in logs", async () => {
    const request = new Request("https://mediapeek.test/resource/analyze", {
      method: "POST",
    })

    const execution = createExecution({ request })

    const state: AnalyzeRouteResponseState = {
      request,
      requestLog: execution.state,
    }

    const caughtError = new Error("distinctive internal library detail")
    const finishLogger = vi.spyOn(requestLogger, "finishFallbackRequestLogger")

    const response = handleUnexpectedError(state, caughtError)

    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
      },
    })

    finalizeAnalyzeRequest(execution, caughtError)

    const [handle] = finishLogger.mock.calls[0] ?? []
    expect(handle?.logger.getContext().error).toMatchObject({
      details: expect.stringContaining("distinctive internal library detail"),
    })
  })

  it("records visitor facts on the analysis log", () => {
    const request = new Request("https://mediapeek.test/resource/analyze", {
      method: "POST",
      headers: {
        "user-agent": "visitor-agent",
        "cf-connecting-ip": "203.0.113.10",
      },
    })

    const execution = createExecution({ request })

    const finishLogger = vi.spyOn(requestLogger, "finishFallbackRequestLogger")

    finalizeAnalyzeRequest(execution)

    const [handle] = finishLogger.mock.calls[0] ?? []
    expect(handle?.logger.getContext()).toMatchObject({
      user_agent: "visitor-agent",
      client_ip: "203.0.113.10",
    })
  })
})
