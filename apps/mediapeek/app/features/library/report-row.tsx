import { Button } from "~/components/ui/button"

import { parseMediaReport } from "./media-report"
import type { StoredReport } from "./report-library"

interface ReportRowProps {
  report: StoredReport
  selected: boolean
  onOpen: () => void
  onDelete: () => void
}

const getReportSummary = (report: StoredReport) => {
  const { json } = report.outputs

  if (!json) {
    return "No JSON output was saved."
  }

  const parsed = parseMediaReport({ json, sourceUrl: report.sourceUrl })

  if (!parsed.ok) {
    return parsed.error.message
  }

  const { audios, chapters, file, subtitles, videos } = parsed.report

  const trackSummary = [
    `${String(videos.length)} video`,
    `${String(audios.length)} audio`,
    `${String(subtitles.length)} subtitle`,
  ].join(" · ")

  const details = [file.duration, file.size, trackSummary]

  if (chapters.length > 0) {
    details.push(`${String(chapters.length)} chapters`)
  }

  return details.filter(Boolean).join(" · ")
}

export function ReportRow({
  report,
  selected,
  onOpen,
  onDelete,
}: ReportRowProps) {
  const summary = getReportSummary(report)

  return (
    <li className="bg-card flex flex-wrap items-center gap-3 rounded-xl border p-4">
      <button
        type="button"
        onClick={onOpen}
        aria-pressed={selected}
        className="min-w-0 flex-1 text-left"
      >
        <span className="block break-all font-medium">{report.filename}</span>
        <span className="text-muted-foreground mt-1 block break-all text-sm">
          {report.sourceUrl}
        </span>
        <span className="text-muted-foreground mt-2 block text-sm">
          {summary}
        </span>
        <time
          dateTime={report.analyzedAt}
          className="text-muted-foreground mt-2 block text-xs"
        >
          {report.analyzedAt}
        </time>
      </button>
      <Button type="button" size="sm" variant="outline" onClick={onOpen}>
        Open
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onDelete}>
        Delete
      </Button>
    </li>
  )
}
