import "fake-indexeddb/auto"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type {
  AnalysisResult,
  AnalysisSession,
} from "~/features/analyze/analysis-session"
import type { StoredReport } from "~/features/reports/report-storage"

import { reportStorageStore } from "./report-storage"
import { SaveReportButton } from "./save-report-button"
import { StoredReportView } from "./stored-report-view"

describe("saved analysis warnings", () => {
  let savedReportId: string | undefined

  afterEach(async () => {
    if (savedReportId) {
      await reportStorageStore.delete(savedReportId)
      savedReportId = undefined
    }
  })

  it("persists warnings and shows them when a saved report is reopened", async () => {
    const analysis: AnalysisResult = {
      url: "https://example.com/unknown-size.mp4",
      outputs: {
        json: JSON.stringify({
          media: { track: [{ "@type": "General", CompleteName: "video.mp4" }] },
        }),
        text: "General\nComplete name : video.mp4",
      },
      warnings: ["source_size_unknown"],
    }

    const onSaved = vi.fn<(report: StoredReport) => void>()

    const session: Pick<AnalysisSession, "output"> = {
      output: vi.fn().mockResolvedValue(""),
    }

    const saveView = render(
      <SaveReportButton
        analysis={analysis}
        session={session}
        onSaved={onSaved}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Save report" }))
    await screen.findByRole("status")

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())

    const savedReport = onSaved.mock.calls[0]?.[0]

    expect(savedReport?.warnings).toEqual(["source_size_unknown"])
    expect(
      reportStorageStore
        .getSnapshot()
        .reports.find((report) => report.id === savedReport?.id)?.warnings
    ).toEqual(["source_size_unknown"])

    if (!savedReport) {
      throw new Error("Save report did not return the stored report.")
    }

    savedReportId = savedReport.id
    saveView.unmount()
    render(<StoredReportView report={savedReport} />)

    expect(
      screen.getByRole("note", { name: "Analysis warning" }).textContent
    ).toContain("The source did not report its total size")
  })
})
