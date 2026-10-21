import { createEvlogLoggerConfig } from "@mediapeek/shared/evlog"
import { resolveRuntimeConfig } from "@mediapeek/shared/runtime-config"
import type { WideEvent } from "evlog"
import { initWorkersLogger } from "evlog/workers"
import { Hono } from "hono"
import { afterAll, beforeEach, describe, expect, it } from "vitest"

import {
  requestLogging,
  type AnalyzerRequestLoggingEnvironment,
} from "./request-logging.server"

const events: WideEvent[] = []

const createTestApp = () => {
  const app = new Hono<AnalyzerRequestLoggingEnvironment>()
  app.use("*", requestLogging())
  app.get("/health", (context) => context.text("ok"))

  return app
}

describe("analyzer request logging", () => {
  beforeEach(() => {
    events.length = 0
    initWorkersLogger({
      env: { service: "mediapeek-analyzer-test" },
      sampling: { rates: { info: 100, warn: 100, error: 100 } },
      silent: true,
      redact: false,
      drain: ({ event }) => {
        events.push(event)
      },
    })
  })

  afterAll(() => {
    initWorkersLogger(
      createEvlogLoggerConfig(
        "mediapeek-analyzer",
        resolveRuntimeConfig(process.env)
      )
    )
  })

  it("normalizes propagated IDs and emits one wide event", async () => {
    const response = await createTestApp().fetch(
      new Request("https://analyzer.test/health", {
        headers: {
          "cf-ray": "ray-id",
          "x-request-id": "web-request-id",
          "x-mediapeek-request-id": "web-request-id",
        },
      }),
      {
        APP_ENV: "staging",
        VERSION_METADATA: { id: "deployment-id" },
      }
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("x-request-id")).toBe("web-request-id")
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      requestId: "web-request-id",
      request_id: "web-request-id",
      path: "/health",
      status: 200,
      service: "mediapeek-analyzer-test",
    })
  })

  it("normalizes the internal request ID when the evlog ID is absent", async () => {
    const response = await createTestApp().fetch(
      new Request("https://analyzer.test/health", {
        headers: {
          "x-mediapeek-request-id": "internal-request-id",
        },
      }),
      { APP_ENV: "staging" }
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("x-request-id")).toBe("internal-request-id")
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      request_id: "internal-request-id",
      path: "/health",
      status: 200,
    })
  })
})
