import "fake-indexeddb/auto"
import { act, fireEvent, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  reportStorageStore,
  type StoredReport,
} from "~/features/reports/report-storage"
import { createAnalyzeServer } from "~/test/analyze-server"
import { renderRoute } from "~/test/render-route"

const createdReportIds: string[] = []

const seedReport = async (report: Omit<StoredReport, "id">) => {
  const stored = await reportStorageStore.save(report)

  createdReportIds.push(stored.id)

  return stored
}

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

describe("AppItemRoute", () => {
  const analyzeServer = createAnalyzeServer()

  beforeEach(async () => {
    window.ENV = { TURNSTILE_ENABLED: false, APP_ENV: "test" }
    vi.stubGlobal("fetch", analyzeServer.fetch)

    const staleIds = createdReportIds.splice(0)

    await Promise.all(staleIds.map((id) => reportStorageStore.delete(id)))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows live progress for the active item", async () => {
    const stream = analyzeServer.hold("https://example.com/movie.mkv")
    const router = await renderApp("/app")
    await submitUrl("https://example.com/movie.mkv", router)

    await act(async () => {
      stream.emitProgress("Fetching media", "Downloading 1.0 MB")
    })

    expect(await screen.findByText("Fetching media")).toBeInTheDocument()
    expect(screen.getByText("Downloading 1.0 MB")).toBeInTheDocument()
    expect(
      screen.getByText("https://example.com/movie.mkv")
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Cancel analysis" })
    ).toBeInTheDocument()
  })

  it("shows waiting copy for a queued item without the active item's progress", async () => {
    const stream = analyzeServer.hold("https://example.com/first.mkv")
    const router = await renderApp("/app")

    const activeItemId = await submitUrl(
      "https://example.com/first.mkv",
      router
    )

    await act(async () => {
      await router.navigate({ to: "/app" })
    })

    await submitUrl("https://example.com/second.mkv", router)

    await act(async () => {
      stream.emitProgress("Fetching media", "Downloading 1.0 MB")
    })

    expect(
      await screen.findByText("Waiting for the current analysis to finish")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Your analysis will start shortly.")
    ).toBeInTheDocument()
    expect(
      screen.getByText("https://example.com/second.mkv")
    ).toBeInTheDocument()
    expect(screen.queryByText("Downloading 1.0 MB")).not.toBeInTheDocument()

    await act(async () => {
      await router.navigate({
        to: "/app/item/$itemId",
        params: { itemId: activeItemId },
      })
    })

    expect(await screen.findByText("Downloading 1.0 MB")).toBeInTheDocument()
  })

  it("renders the analysis result when the item is done", async () => {
    analyzeServer.enqueueSuccess("https://example.com/movie.mkv", {
      text: "General",
    })
    const router = await renderApp("/app")
    await submitUrl("https://example.com/movie.mkv", router)

    expect(
      await screen.findByText("No JSON analysis is available.")
    ).toBeInTheDocument()
    expect(screen.queryByText("Analysis failed")).not.toBeInTheDocument()
  })

  it("shows the failure page with retry and remove actions", async () => {
    analyzeServer.enqueueError(
      "https://example.com/broken.mkv",
      "The source rejected the request."
    )
    const router = await renderApp("/app")
    await submitUrl("https://example.com/broken.mkv", router)

    expect(
      await screen.findByText("The source rejected the request.")
    ).toBeInTheDocument()
    expect(screen.getByText("Analysis failed")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Retry analysis" })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Remove" }))

    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/app\/?$/u)
    })
    expect(await screen.findByLabelText("Media URL")).toBeInTheDocument()
  })

  it("renders a saved report by id", async () => {
    const stored = await seedReport({
      sourceUrl: "https://example.com/saved.mkv",
      filename: "saved.mkv",
      analyzedAt: "2026-10-18T00:00:00.000Z",
      outputs: { text: "General" },
    })

    await renderApp(`/app/item/${stored.id}`)

    expect(
      await screen.findByText("No JSON analysis is available.")
    ).toBeInTheDocument()
  })

  it("shows the unavailable page for an unknown id", async () => {
    await renderApp("/app/item/does-not-exist")

    expect(await screen.findByText("Report unavailable")).toBeInTheDocument()
  })
})
