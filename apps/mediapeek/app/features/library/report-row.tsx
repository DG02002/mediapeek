"use client"

import {
  Delete02Icon,
  File01Icon,
  GitMergeIcon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons"

import { Button, buttonVariants } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Icon } from "~/components/ui/icon"
import { cn } from "~/lib/utils"

import { parseMediaReport } from "./media-report"
import type { StoredReport } from "./report-library"

interface ReportRowProps {
  report: StoredReport
  selected: boolean
  onOpen: () => void
  onCompare: () => void
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

const analyzedAtFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
})

export function ReportRow({
  report,
  selected,
  onOpen,
  onCompare,
  onDelete,
}: ReportRowProps) {
  const summary = getReportSummary(report)
  const analyzedAt = new Date(report.analyzedAt)

  return (
    <li
      className={cn(
        "bg-card flex items-center gap-3 rounded-xl border p-4 transition-colors",
        selected && "border-primary/60"
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-pressed={selected}
        className="min-w-0 flex-1 text-left"
      >
        <span className="block truncate font-medium">{report.filename}</span>
        <span className="text-muted-foreground mt-1 block truncate text-sm">
          {report.sourceUrl}
        </span>
        <span className="text-muted-foreground mt-2 block text-sm">
          {summary}
        </span>
        <time
          dateTime={report.analyzedAt}
          className="text-muted-foreground/80 mt-2 block text-xs"
        >
          {Number.isNaN(analyzedAt.getTime())
            ? report.analyzedAt
            : analyzedAtFormatter.format(analyzedAt)}
        </time>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
        >
          <Icon icon={MoreVerticalIcon} size={18} />
          <span className="sr-only">Actions for {report.filename}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={onOpen}>
            <Icon icon={File01Icon} size={16} />
            Open
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCompare}>
            <Icon icon={GitMergeIcon} size={16} />
            Compare
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Icon icon={Delete02Icon} size={16} />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Button type="button" size="sm" variant="outline" onClick={onOpen}>
        Open
      </Button>
    </li>
  )
}
