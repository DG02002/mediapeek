import "fake-indexeddb/auto"
import { fireEvent, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import {
  reportStorageStore,
  type StoredReport,
} from "~/features/reports/report-storage"
import { renderRoute } from "~/test/render-route"

const createdReportIds: string[] = []

const seedReport = async (report: Omit<StoredReport, "id">) => {
  const stored = await reportStorageStore.save(report)

  createdReportIds.push(stored.id)

  return stored
}

const renderCompare = (initialUrl: string) => {
  return renderRoute(initialUrl).then(({ router }) => router)
}

describe("AppCompareRoute", () => {
  beforeEach(async () => {
    window.ENV = { TURNSTILE_ENABLED: false, APP_ENV: "test" }

    const staleIds = createdReportIds.splice(0)

    await Promise.all(staleIds.map((id) => reportStorageStore.delete(id)))
  })

  it("prompts to pick a report when no item is given", async () => {
    await renderCompare("/app/compare")

    expect(
      await screen.findByText("Choose a report to compare")
    ).toBeInTheDocument()
  })

  it("keeps the selected format when changing the compare target", async () => {
    const base = await seedReport({
      sourceUrl: "https://example.com/base.mkv",
      filename: "base.mkv",
      analyzedAt: "2026-10-16T00:00:00.000Z",
      outputs: { json: '{"size":100}', text: "General" },
    })

    const target = await seedReport({
      sourceUrl: "https://example.com/target.mkv",
      filename: "target.mkv",
      analyzedAt: "2026-10-17T00:00:00.000Z",
      outputs: { json: '{"size":200}', text: "General" },
    })

    const other = await seedReport({
      sourceUrl: "https://example.com/other.mkv",
      filename: "other.mkv",
      analyzedAt: "2026-10-18T00:00:00.000Z",
      outputs: { json: '{"size":300}', text: "General" },
    })

    const router = await renderCompare(
      `/app/compare?item=${base.id}&item=${target.id}&format=text`
    )

    expect(await screen.findByText("Compare reports")).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText("After"), {
      target: { value: other.id },
    })

    expect(router.state.location.search).toEqual({
      item: [base.id, other.id],
      format: "text",
    })
  })
})
