import "fake-indexeddb/auto"
import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createAnalyzeServer } from "~/test/analyze-server"
import { renderRoute } from "~/test/render-route"

const renderApp = async (initialUrl: string) =>
  (await renderRoute(initialUrl)).router

const submitUrl = async (
  url: string,
  router: Awaited<ReturnType<typeof renderApp>>
) => {
  const input = await screen.findByLabelText("Media URL")

  await act(async () => {
    fireEvent.change(input, { target: { value: url } })
    fireEvent.click(screen.getByRole("button", { name: "Analyze URL" }))
  })

  await waitFor(() => {
    expect(router.state.location.pathname).toMatch(/^\/app\/item\//u)
  })

  return router.state.location.pathname.split("/").at(-1) ?? ""
}

const submitSuccessfulUrl = async (
  analyzeServer: ReturnType<typeof createAnalyzeServer>,
  url: string,
  router: Awaited<ReturnType<typeof renderApp>>
) => {
  analyzeServer.enqueueSuccess(url, { text: "General" })
  const itemId = await submitUrl(url, router)

  await screen.findByText("No JSON analysis is available.")
  await act(async () => {
    await router.navigate({ to: "/app" })
  })

  return itemId
}

describe("AppIndexRoute", () => {
  const analyzeServer = createAnalyzeServer()

  beforeEach(() => {
    window.ENV = { TURNSTILE_ENABLED: false, APP_ENV: "test" }
    vi.stubGlobal("fetch", analyzeServer.fetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("does not render an empty analysis queue", async () => {
    await renderApp("/app")

    expect(
      screen.queryByRole("heading", { name: "Analysis queue" })
    ).not.toBeInTheDocument()
  })

  it("lists queued, active, and completed analyses with a link to the completed item", async () => {
    const completedUrl = "https://example.com/completed.mkv"
    const router = await renderApp("/app")

    const completedItemId = await submitSuccessfulUrl(
      analyzeServer,
      completedUrl,
      router
    )

    const activeUrl = "https://example.com/active.mkv"
    const stream = analyzeServer.hold(activeUrl)
    await submitUrl(activeUrl, router)

    await act(async () => {
      stream.emitProgress("Fetching media", "Reading the source.")
    })

    await act(async () => {
      await router.navigate({ to: "/app" })
    })

    const queuedUrl = "https://example.com/queued.mkv"
    await submitUrl(queuedUrl, router)

    await act(async () => {
      await router.navigate({ to: "/app" })
    })

    expect(screen.getByText("Analysis queue")).toBeInTheDocument()
    expect(screen.getByText("Analyzing")).toBeInTheDocument()
    expect(screen.getByText("Fetching media")).toBeInTheDocument()
    expect(screen.getByText(activeUrl)).toBeInTheDocument()
    expect(screen.getByText(queuedUrl)).toBeInTheDocument()
    expect(screen.getByText("Queued")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: completedUrl })).toHaveAttribute(
      "href",
      `/app/item/${completedItemId}`
    )
    expect(screen.getByText("Analysis complete")).toBeInTheDocument()
  })

  it("shows failed analysis status and its error message", async () => {
    const failedUrl = "https://example.com/failed.mkv"
    const errorMessage = "The source rejected the request."
    analyzeServer.enqueueError(failedUrl, errorMessage)
    const router = await renderApp("/app")

    await submitUrl(failedUrl, router)
    expect(await screen.findByText(errorMessage)).toBeInTheDocument()

    await act(async () => {
      await router.navigate({ to: "/app" })
    })

    expect(screen.getByText("Analysis failed")).toBeInTheDocument()
    expect(screen.getByText(errorMessage)).toBeInTheDocument()
  })
})
