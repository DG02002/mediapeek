import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { createMemoryRouter, RouterProvider, useParams } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { AnalysisQueueProvider } from "~/features/analyze/queue/use-analysis-queue"
import { createAnalyzeServer } from "~/test/analyze-server"

import { MediaForm } from "./media-form"

const ItemRouteProbe = () => {
  const { itemId } = useParams()

  return <div>item-route:{String(itemId)}</div>
}

const renderMediaForm = () => {
  const router = createMemoryRouter(
    [
      { path: "/app", element: <MediaForm /> },
      {
        path: "/app/item/:itemId",
        element: <ItemRouteProbe />,
      },
    ],
    { initialEntries: ["/app"] }
  )

  render(
    <AnalysisQueueProvider>
      <RouterProvider router={router} />
    </AnalysisQueueProvider>
  )

  return router
}

const submitUrl = async (url: string) => {
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Media URL"), {
      target: { value: url },
    })
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
    const router = renderMediaForm()

    await submitUrl("https://example.com/movie.mkv")

    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/app\/item\//u)
    })

    expect(screen.getByText(/^item-route:/u)).toBeInTheDocument()
  })

  it("reopens the existing item for a duplicate URL without an error", async () => {
    analyzeServer.enqueueSuccess("https://example.com/movie.mkv", {
      text: "General",
    })
    const router = renderMediaForm()

    await submitUrl("https://example.com/movie.mkv")

    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/app\/item\//u)
    })

    const itemId = router.state.location.pathname.split("/").at(-1)

    await act(async () => {
      await router.navigate("/app")
    })

    await submitUrl("https://example.com/movie.mkv")

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/app/item/${itemId}`)
    })

    expect(
      screen.queryByText("Analysis could not start")
    ).not.toBeInTheDocument()
  })

  it("rejects a multi-URL paste without navigating", async () => {
    const router = renderMediaForm()

    fireEvent.paste(screen.getByLabelText("Media URL"), {
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
