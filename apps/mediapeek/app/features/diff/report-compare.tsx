"use client"

import { ArrowLeftRightIcon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { useId, useState } from "react"
import { useSearchParams } from "react-router"

import { Button } from "~/components/ui/button"
import { Icon } from "~/components/ui/icon"
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs"
import {
  collapseDiffLines,
  diffLines,
  type CollapsedDiffRow,
  type LineDiffRowKind,
} from "~/features/diff/line-diff"
import type { StoredReport } from "~/features/library/report-library"
import { cn } from "~/lib/utils"

export type CompareOutputFormat = "json" | "text"

const COMPARE_FORMATS: ReadonlyArray<{
  readonly id: CompareOutputFormat
  readonly label: string
}> = [
  { id: "json", label: "JSON" },
  { id: "text", label: "Text" },
]

const reportOptionLabel = (report: StoredReport) =>
  `${report.filename} · ${report.analyzedAt}`

const hasOutput = (
  report: StoredReport | undefined,
  format: CompareOutputFormat
) => Boolean(report && report.outputs[format] !== undefined)

const pickCompareFormat = (
  beforeReport: StoredReport | undefined,
  afterReport: StoredReport | undefined
): CompareOutputFormat | null => {
  if (hasOutput(beforeReport, "json") && hasOutput(afterReport, "json")) {
    return "json"
  }

  if (hasOutput(beforeReport, "text") && hasOutput(afterReport, "text")) {
    return "text"
  }

  return null
}

const toCompareFormat = (value: string): CompareOutputFormat | null =>
  COMPARE_FORMATS.find((compareFormat) => compareFormat.id === value)?.id ??
  null

interface CompareDiffSummary {
  readonly rows: ReadonlyArray<CollapsedDiffRow>
  readonly addedCount: number
  readonly removedCount: number
  readonly changedCount: number
  readonly beforeLabel: string
  readonly afterLabel: string
}

const diffRowKey = (row: CollapsedDiffRow, index: number) => {
  const detail =
    row.kind === "gap" ? `gap-${String(row.hiddenCount)}` : `line-${row.text}`

  return `${String(index)}-${detail}`
}

const normalizeJsonOutput = (content: string) => {
  try {
    return JSON.stringify(JSON.parse(content), null, 2)
  } catch {
    return content
  }
}

const buildCompareDiff = ({
  baseReport,
  targetReport,
  isSwapped,
  format,
}: {
  readonly baseReport: StoredReport
  readonly targetReport: StoredReport | undefined
  readonly isSwapped: boolean
  readonly format: CompareOutputFormat | null
}): CompareDiffSummary | undefined => {
  const before = isSwapped ? targetReport : baseReport
  const after = isSwapped ? baseReport : targetReport

  if (!before || !after || !format) {
    return undefined
  }

  const beforeContent = before.outputs[format]
  const afterContent = after.outputs[format]

  if (beforeContent === undefined || afterContent === undefined) {
    return undefined
  }

  const rows = diffLines(
    format === "json" ? normalizeJsonOutput(beforeContent) : beforeContent,
    format === "json" ? normalizeJsonOutput(afterContent) : afterContent
  )

  return {
    rows: collapseDiffLines(rows),
    addedCount: rows.filter((row) => row.kind === "added").length,
    removedCount: rows.filter((row) => row.kind === "removed").length,
    changedCount: rows.filter((row) => row.kind !== "context").length,
    beforeLabel: reportOptionLabel(before),
    afterLabel: reportOptionLabel(after),
  }
}

interface ReportCompareProps {
  readonly baseReport: StoredReport
  readonly reports: ReadonlyArray<StoredReport>
  readonly onClose: () => void
}

export function ReportCompare({
  baseReport,
  reports,
  onClose,
}: ReportCompareProps) {
  const compareLabelId = useId()
  const [searchParams, setSearchParams] = useSearchParams()
  const [isSwapped, setIsSwapped] = useState(false)
  const otherReports = reports.filter((report) => report.id !== baseReport.id)

  const targetId = searchParams.get("with") ?? ""
  const formatParam = toCompareFormat(searchParams.get("format") ?? "")
  const targetReport = otherReports.find((report) => report.id === targetId)
  const beforeReport = isSwapped ? targetReport : baseReport
  const afterReport = isSwapped ? baseReport : targetReport

  const resolvedFormat =
    formatParam ?? pickCompareFormat(baseReport, targetReport)

  const changeTarget = (id: string) => {
    const next = new URLSearchParams(searchParams)

    next.set("with", id)
    next.delete("format")
    setSearchParams(next, { preventScrollReset: true })
  }

  const changeFormat = (format: CompareOutputFormat | null) => {
    const next = new URLSearchParams(searchParams)

    if (format) {
      next.set("format", format)
    } else {
      next.delete("format")
    }

    setSearchParams(next, { preventScrollReset: true })
  }

  const sideLabels = isSwapped
    ? { before: "the selected report", after: "this report" }
    : { before: "this report", after: "the selected report" }

  const missingFormatSides = resolvedFormat
    ? [
        !hasOutput(beforeReport, resolvedFormat) ? sideLabels.before : null,
        !hasOutput(afterReport, resolvedFormat) ? sideLabels.after : null,
      ].filter((side) => side !== null)
    : []

  const diff = buildCompareDiff({
    baseReport,
    targetReport,
    isSwapped,
    format: resolvedFormat,
  })

  const diffItems = diff
    ? diff.rows.map((row, index) => ({
        row,
        key: diffRowKey(row, index),
      }))
    : []

  return (
    <section aria-labelledby={compareLabelId} className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={compareLabelId} className="text-lg font-semibold">
          Compare reports
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-muted-foreground"
        >
          <Icon icon={Cancel01Icon} size={16} />
          Close compare
        </Button>
      </div>

      <div className="bg-card grid gap-4 rounded-2xl border p-5 sm:grid-cols-[1fr_auto_1fr]">
        <label className="grid gap-2 text-sm font-medium">
          Before
          <select
            className="bg-background border-input h-10 min-w-0 rounded-md border px-3 font-normal"
            value={isSwapped ? "" : baseReport.id}
            disabled
          >
            <option value={baseReport.id}>
              {reportOptionLabel(baseReport)}
            </option>
          </select>
        </label>

        <div className="flex items-end justify-center pb-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={!targetReport}
            onClick={() => setIsSwapped(!isSwapped)}
            aria-label="Swap compare sides"
            title="Swap compare sides"
          >
            <Icon icon={ArrowLeftRightIcon} size={16} />
          </Button>
        </div>

        <label className="grid gap-2 text-sm font-medium">
          After
          <select
            className="bg-background border-input h-10 min-w-0 rounded-md border px-3 font-normal"
            value={targetId}
            onChange={(event) => {
              changeTarget(event.currentTarget.value)
            }}
          >
            <option value="">Choose a report</option>
            {otherReports.map((report) => (
              <option key={report.id} value={report.id}>
                {reportOptionLabel(report)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {otherReports.length === 0 && (
        <p className="bg-card text-muted-foreground rounded-2xl border p-5 text-sm">
          Save another report to compare against this one.
        </p>
      )}

      {targetReport && resolvedFormat && (
        <Tabs
          value={resolvedFormat}
          onValueChange={(value) => changeFormat(toCompareFormat(value))}
        >
          <TabsList>
            {COMPARE_FORMATS.map((compareFormat) => (
              <TabsTrigger
                key={compareFormat.id}
                value={compareFormat.id}
                disabled={
                  !hasOutput(beforeReport, compareFormat.id) ||
                  !hasOutput(afterReport, compareFormat.id)
                }
              >
                {compareFormat.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      {targetReport && missingFormatSides.length > 0 && (
        <p className="bg-card text-muted-foreground rounded-2xl border p-5 text-sm">
          {missingFormatSides.join(" and ")} has no {resolvedFormat} output to
          compare. Export the report with {resolvedFormat?.toUpperCase()}{" "}
          included and save it again.
        </p>
      )}

      {diff && diff.changedCount === 0 && (
        <p className="bg-card text-muted-foreground rounded-2xl border p-5 text-sm">
          The {resolvedFormat?.toUpperCase()} output is identical in both
          reports.
        </p>
      )}

      {diff && diff.changedCount > 0 && (
        <div className="bg-card overflow-hidden rounded-2xl border">
          <div className="text-muted-foreground flex items-center justify-between gap-3 border-b px-4 py-2.5 text-xs">
            <span className="font-medium">
              {diff.beforeLabel} → {diff.afterLabel}
            </span>
            <span className="flex shrink-0 items-center gap-2 font-mono">
              <span className="text-emerald-600 dark:text-emerald-400">
                +{String(diff.addedCount)}
              </span>
              <span className="text-red-600 dark:text-red-400">
                −{String(diff.removedCount)}
              </span>
            </span>
          </div>
          <ol className="overflow-x-auto py-2 font-mono text-xs leading-5">
            {diffItems.map((item) => (
              <DiffRow key={item.key} row={item.row} />
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}

const rowStyles: Record<LineDiffRowKind, string> = {
  context: "",
  added: "bg-emerald-500/10",
  removed: "bg-red-500/10",
}

const rowSigns: Record<LineDiffRowKind, string> = {
  context: "",
  added: "+",
  removed: "−",
}

function DiffRow({ row }: { row: CollapsedDiffRow }) {
  if (row.kind === "gap") {
    return (
      <li
        className="text-muted-foreground/70 select-none px-4 py-1 text-center"
        aria-label={`${String(row.hiddenCount)} unchanged lines hidden`}
      >
        ⋯ {String(row.hiddenCount)} unchanged lines
      </li>
    )
  }

  return (
    <li className={cn("flex gap-3 px-4", rowStyles[row.kind])}>
      <span className="text-muted-foreground/50 w-10 shrink-0 select-none text-right tabular-nums">
        {row.beforeNumber === null ? "" : String(row.beforeNumber)}
      </span>
      <span className="text-muted-foreground/50 w-10 shrink-0 select-none text-right tabular-nums">
        {row.afterNumber === null ? "" : String(row.afterNumber)}
      </span>
      <span
        className={cn(
          "w-4 shrink-0 select-none",
          row.kind === "added" && "text-emerald-600 dark:text-emerald-400",
          row.kind === "removed" && "text-red-600 dark:text-red-400"
        )}
        aria-hidden
      >
        {rowSigns[row.kind]}
      </span>
      <span
        className={cn(
          "min-w-0 break-all whitespace-pre-wrap",
          row.kind === "added" && "text-emerald-700 dark:text-emerald-300",
          row.kind === "removed" && "text-red-700 dark:text-red-300"
        )}
      >
        {row.text || " "}
      </span>
    </li>
  )
}
