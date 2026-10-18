"use client"

import {
  Delete02Icon,
  File01Icon,
  GitMergeIcon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons"

import { buttonVariants } from "~/components/ui/button"
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
import type { StoredReport } from "./report-storage"

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
        "flex w-full items-stretch transition-colors hover:bg-muted",
        selected && "bg-sky-500/15 hover:bg-sky-500/20"
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-pressed={selected}
        className={cn(
          "flex min-h-24 min-w-0 flex-1 items-center gap-3 px-4 py-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          selected ? "active:bg-sky-500/30" : "active:bg-muted/70"
        )}
      >
        <span className="flex size-10 shrink-0 items-center justify-center text-foreground md:size-14">
          <Icon icon={File01Icon} size={24} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="block truncate text-sm font-medium md:text-lg">
            {report.filename}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <span className="min-w-0 truncate">{report.sourceUrl}</span>
            <span aria-hidden="true" className="shrink-0">
              ·
            </span>
            <span className="min-w-0 truncate">{summary}</span>
          </span>
          <time
            dateTime={report.analyzedAt}
            className="text-muted-foreground/80 text-xs sm:hidden"
          >
            {Number.isNaN(analyzedAt.getTime())
              ? report.analyzedAt
              : analyzedAtFormatter.format(analyzedAt)}
          </time>
        </span>
        <time
          dateTime={report.analyzedAt}
          className="text-muted-foreground/80 hidden shrink-0 text-xs sm:block"
        >
          {Number.isNaN(analyzedAt.getTime())
            ? report.analyzedAt
            : analyzedAtFormatter.format(analyzedAt)}
        </time>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "my-auto me-2 shrink-0"
          )}
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
    </li>
  )
}
