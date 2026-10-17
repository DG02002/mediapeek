import { useCallback } from "react"

import { MediaView, type MediaViewData } from "~/components/media-view"
import type {
  AnalyzeClientResult,
  fetchAnalyzeFormat,
} from "~/lib/analyze-client"

import type { StoredReport } from "./report-library"

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
  const fetchSavedFormat = useCallback(
    async ({
      format,
    }: Parameters<
      typeof fetchAnalyzeFormat
    >[0]): Promise<AnalyzeClientResult> => {
      const content = Object.entries(report.outputs).find(
        ([savedFormat]) => savedFormat === format
      )?.[1]

      return content
        ? { ok: true, content, retriedWithTurnstile: false }
        : {
            ok: false,
            message: `${format.toUpperCase()} output was not included in this saved report.`,
            retriedWithTurnstile: false,
          }
    },
    [report.outputs]
  )

  return (
    <MediaView
      data={toMediaViewData(report)}
      url={report.sourceUrl}
      fetchFormat={fetchSavedFormat}
    />
  )
}
