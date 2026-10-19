import { useMemo } from "react"

import { MediaView, type MediaViewData } from "~/components/media-view"
import { createBrowserAnalysisSessionForOutputs } from "~/features/analyze/analysis-session"

import type { StoredReport } from "./report-storage"

const toMediaViewData = (report: StoredReport): MediaViewData => {
  const data: MediaViewData = {}

  for (const [format, content] of Object.entries(report.outputs)) {
    if (content !== undefined) {
      data[format] = content
    }
  }

  return data
}

export function StoredReportView({ report }: { report: StoredReport }) {
  const session = useMemo(
    () =>
      createBrowserAnalysisSessionForOutputs({
        url: report.sourceUrl,
        outputs: report.outputs,
        allowMissingOutputs: false,
      }),
    [report]
  )

  return (
    <MediaView
      data={toMediaViewData(report)}
      url={report.sourceUrl}
      session={session}
      allowLazyTextOutput={false}
    />
  )
}
