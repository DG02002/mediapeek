import { describe, expect, it } from "vitest"

import { getHealthzResponse } from "./healthz"

describe("healthz route", () => {
  it("fails when production has no rate limiter binding", async () => {
    const response = getHealthzResponse({ APP_ENV: "production" })

    expect(response.status).toBe(503)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.json()).toEqual({
      ok: false,
      reason: "ANALYZE_RATE_LIMITER_MISSING",
    })
  })

  it("keeps production healthy when the rate limiter is bound", async () => {
    const response = getHealthzResponse({
      APP_ENV: "production",
      ANALYZE_RATE_LIMITER: { limit: async () => ({ success: true }) },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true })
  })

  it("keeps development healthy without a rate limiter binding", async () => {
    const response = getHealthzResponse({ APP_ENV: "development" })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true })
  })

  it("defaults to production when APP_ENV is unset", async () => {
    const response = getHealthzResponse({})

    expect(response.status).toBe(503)
  })
})
