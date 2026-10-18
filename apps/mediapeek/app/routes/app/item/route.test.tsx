import "fake-indexeddb/auto"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useEffect } from "react"
import { createMemoryRouter, Outlet, RouterProvider } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { AnalysisQueue } from "~/features/analyze/queue/analysis-queue"
import {
  AnalysisQueueProvider,
  useAnalysisQueue,
} from "~/features/analyze/queue/use-analysis-queue"
import {
  reportStorageStore,
  type StoredReport,
} from "~/features/reports/report-storage"
import { createAnalyzeServer } from "~/test/analyze-server"

import AppItemRoute from "./route"

interface QueueReference {
  current: AnalysisQueue | null
}

const queueRef: QueueReference = { current: null }

const QueueProbe = () => {
  const { queue } = useAnalysisQueue()

  useEffect(() => {
    queueRef.current = queue
  }, [queue])

  return <Outlet />
}

const createdReportIds: string[] = []

const seedReport = async (report: Omit<StoredReport, "id">) => {
  const stored = await reportStorageStore.save(report)

  createdReportIds.push(stored.id)

  return stored
}

const renderApp = (initialUrl: string) => {
  const router = createMemoryRouter(
    [
      {
        path: "/app",
        element: (
          <AnalysisQueueProvider>
            <QueueProbe />
          </AnalysisQueueProvider>
        ),
        children: [
          { index: true, element: <div>app-index</div> },
          { path: "item/:itemId", element: <AppItemRoute /> },
        ],
      },
    ],
    { initialEntries: [initialUrl] }
  )

  render(<RouterProvider router={router} />)

  return router
}

interface QueueAddOutcome {
  itemId: string | null
}

const addUrl = (url: string) => {
  const outcome: QueueAddOutcome = { itemId: null }

  act(() => {
    const result = queueRef.current?.add(url).at(0)

    outcome.itemId = result && result.kind === "queued" ? result.itemId : null
  })

  if (!outcome.itemId) {
    throw new Error(`Expected ${url} to enqueue.`)
  }

  return outcome.itemId
}

describe("AppItemRoute", () => {
  const analyzeServer = createAnalyzeServer()

  beforeEach(async () => {
    window.ENV = { TURNSTILE_ENABLED: false, APP_ENV: "test" }
    queueRef.current = null
    vi.stubGlobal("fetch", analyzeServer.fetch)

    const staleIds = createdReportIds.splice(0)

    await Promise.all(staleIds.map((id) => reportStorageStore.delete(id)))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("shows live progress for the active item", async () => {
    const stream = analyzeServer.hold("https://example.com/movie.mkv")
    const router = renderApp("/app")
    const itemId = addUrl("https://example.com/movie.mkv")

    await act(async () => {
      stream.emitProgress("Fetching media", "Downloading 1.0 MB")
    })

    await act(async () => {
      await router.navigate(`/app/item/${itemId}`)
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
    const router = renderApp("/app")
    const activeItemId = addUrl("https://example.com/first.mkv")
    const queuedItemId = addUrl("https://example.com/second.mkv")

    await act(async () => {
      stream.emitProgress("Fetching media", "Downloading 1.0 MB")
    })

    await act(async () => {
      await router.navigate(`/app/item/${queuedItemId}`)
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
      await router.navigate(`/app/item/${activeItemId}`)
    })

    expect(await screen.findByText("Downloading 1.0 MB")).toBeInTheDocument()
  })

  it("renders the analysis result when the item is done", async () => {
    analyzeServer.enqueueSuccess("https://example.com/movie.mkv", {
      text: "General",
    })
    const router = renderApp("/app")
    const itemId = addUrl("https://example.com/movie.mkv")

    await act(async () => {
      await router.navigate(`/app/item/${itemId}`)
    })

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
    const router = renderApp("/app")
    const itemId = addUrl("https://example.com/broken.mkv")

    await act(async () => {
      await router.navigate(`/app/item/${itemId}`)
    })

    expect(
      await screen.findByText("The source rejected the request.")
    ).toBeInTheDocument()
    expect(screen.getByText("Analysis failed")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Retry analysis" })
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Remove" }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/app")
    })
    expect(screen.getByText("app-index")).toBeInTheDocument()
  })

  it("renders a saved report by id", async () => {
    const stored = await seedReport({
      sourceUrl: "https://example.com/saved.mkv",
      filename: "saved.mkv",
      analyzedAt: "2026-10-18T00:00:00.000Z",
      outputs: { text: "General" },
    })

    renderApp(`/app/item/${stored.id}`)

    expect(
      await screen.findByText("No JSON analysis is available.")
    ).toBeInTheDocument()
  })

  it("shows the unavailable page for an unknown id", async () => {
    renderApp("/app/item/does-not-exist")

    expect(await screen.findByText("Report unavailable")).toBeInTheDocument()
  })
})
