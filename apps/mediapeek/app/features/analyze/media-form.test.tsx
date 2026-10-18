import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createAnalyzeServer } from "~/test/analyze-server"
import { renderRoute } from "~/test/render-route"

const renderMediaForm = () => {
  return renderRoute("/app").then(({ router }) => router)
}

const submitUrl = async (url: string) => {
  const input = await screen.findByLabelText("Media URL")

  await act(async () => {
    fireEvent.change(input, { target: { value: url } })
    fireEvent.click(screen.getByRole("button", { name: "Analyze URL" }))
  })
}

describe("MediaForm", () => {
  const analyzeServer = createAnalyzeServer()

  beforeEach(() => {
    window.ENV = { TURNSTILE_ENABLED: false, APP_ENV: "test" }
    vi.stubGlobal("fetch", analyzeServer.fetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("navigates to the item route as soon as a URL is queued", async () => {
    analyzeServer.enqueueSuccess("https://example.com/movie.mkv", {
      text: "General",
    })
    const router = await renderMediaForm()

    await submitUrl("https://example.com/movie.mkv")

    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/app\/item\//u)
    })

    expect(
      await screen.findByText("No JSON analysis is available.")
    ).toBeInTheDocument()
  })

  it("reopens the existing item for a duplicate URL without an error", async () => {
    analyzeServer.enqueueSuccess("https://example.com/movie.mkv", {
      text: "General",
    })
    const router = await renderMediaForm()

    await submitUrl("https://example.com/movie.mkv")

    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/app\/item\//u)
    })

    await act(async () => {
      await router.navigate({ to: "/app" })
    })

    await submitUrl("https://example.com/movie.mkv")

    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/app\/item\//u)
    })

    expect(
      screen.queryByText("Analysis could not start")
    ).not.toBeInTheDocument()
  })

  it("rejects a multi-URL paste without navigating", async () => {
    const router = await renderMediaForm()

    fireEvent.paste(await screen.findByLabelText("Media URL"), {
      clipboardData: {
        getData: () =>
          "https://example.com/one.mkv\nhttps://example.com/two.mkv",
      },
    })

    expect(
      await screen.findByText("Analyze one URL at a time.")
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/app")
  })
})
