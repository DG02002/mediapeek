import { afterEach, describe, expect, it, vi } from "vitest"

import { DEVTOOLS_WELL_KNOWN_PATH } from "~/constants"

import { withRequestLogging } from "./request-logger.server"

const createConsoleSpies = () =>
  (["debug", "info", "warn", "error", "log"] as const).map((method) =>
    vi.spyOn(console, method).mockImplementation(() => undefined)
  )

const createRequest = (pathname: string) =>
  new Request(`https://mediapeek.test${pathname}`)

const execute = async (pathname: string) => {
  const worker = withRequestLogging(
    // Status 400 is force-kept by evlog, so this assertion avoids info sampling.
    async () => new Response(null, { status: 400 })
  )

  return worker.fetch(createRequest(pathname), {}, { waitUntil: vi.fn() })
}

describe("request logging exclusions", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("emits an event for a non-excluded request", async () => {
    const consoleSpies = createConsoleSpies()

    const response = await execute("/not-found")

    expect(response.status).toBe(400)

    const loggedOutput = JSON.stringify(
      consoleSpies.flatMap((spy) => spy.mock.calls)
    )

    expect(loggedOutput).toContain("/not-found")
  })

  it("does not emit events for excluded routes or public assets", async () => {
    const consoleSpies = createConsoleSpies()

    const excludedPaths = [
      "/resource/analyze",
      "/healthz",
      "/robots.txt",
      DEVTOOLS_WELL_KNOWN_PATH,
      "/_build/assets/app.js",
      "/favicon.ico",
      "/favicon.svg",
      "/cover.png",
      "/cover.webp",
      "/badges/3d.svg",
      "/badges/icon-light.webp",
      "/brand/github/GitHub_Lockup_Black_Clearspace.svg",
      "/wasm/MediaInfoModule.wasm",
      "/demo.json",
      "/test-badges.html",
    ]

    const responses = await Promise.all(excludedPaths.map(execute))

    expect(responses.map((response) => response.status)).toEqual(
      excludedPaths.map(() => 400)
    )
    expect(consoleSpies.flatMap((spy) => spy.mock.calls)).toHaveLength(0)
  })
})
