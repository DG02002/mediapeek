import { Schema } from "effect"
import { useMemo, useState } from "react"

import { Footer } from "~/components/footer"
import { Header } from "~/components/header"
import {
  diffReportOutputs,
  type DiffPath,
  type DiffSection,
  type DiffValue,
  type ReportDiff,
} from "~/features/diff/report-diff"
import type { StoredReport } from "~/features/library/report-library"
import { useReportLibrary } from "~/features/library/use-report-library"
import { useHydrated } from "~/hooks/use-hydrated"

import type { Route } from "./+types/route"

const DIFF_GROUPS: ReadonlyArray<{
  readonly id: DiffSection
  readonly title: string
}> = [
  { id: "general", title: "General" },
  { id: "video", title: "Video tracks" },
  { id: "audio", title: "Audio tracks" },
  { id: "subtitle", title: "Subtitle tracks" },
  { id: "chapters", title: "Chapters" },
]

export const meta: Route.MetaFunction = () => [
  { title: "Compare reports - MediaPeek" },
  {
    name: "description",
    content: "Compare two saved MediaPeek reports field by field.",
  },
]

const reportOptionLabel = (report: StoredReport) =>
  `${report.filename} · ${report.analyzedAt}`

const formatValue = (value: DiffValue) => {
  if (value === undefined) {
    return "Not set"
  }

  if (Schema.is(Schema.String)(value)) {
    return value
  }

  if (Schema.is(Schema.Number)(value) || Schema.is(Schema.Boolean)(value)) {
    return String(value)
  }

  if (Schema.is(Schema.Null)(value)) {
    return "null"
  }

  return JSON.stringify(value) ?? "Not set"
}

const renderDiffEntries = (diff: ReportDiff, section: DiffSection) => {
  const added = diff.added.filter((entry) => entry.section === section)
  const removed = diff.removed.filter((entry) => entry.section === section)
  const changed = diff.changed.filter((entry) => entry.section === section)

  if (added.length + removed.length + changed.length === 0) {
    return null
  }

  return (
    <section key={section} className="bg-card space-y-4 rounded-xl border p-5">
      <h2 className="text-lg font-semibold">
        {DIFF_GROUPS.find((group) => group.id === section)?.title}
      </h2>
      <ul className="space-y-3">
        {added.map((entry) => (
          <DiffRow
            key={`added-${entry.path}-${JSON.stringify(entry.value)}`}
            path={entry.path}
            kind="Added"
            value={entry.value}
          />
        ))}
        {removed.map((entry) => (
          <DiffRow
            key={`removed-${entry.path}-${JSON.stringify(entry.value)}`}
            path={entry.path}
            kind="Removed"
            value={entry.value}
          />
        ))}
        {changed.map((entry) => (
          <ChangedDiffRow
            key={`changed-${entry.path}`}
            path={entry.path}
            before={entry.before}
            after={entry.after}
          />
        ))}
      </ul>
    </section>
  )
}

function DiffRow({
  path,
  kind,
  value,
}: {
  path: string
  kind: "Added" | "Removed"
  value: DiffPath["value"]
}) {
  return (
    <li className="border-border/70 grid gap-1 border-b pb-3 last:border-0 last:pb-0 sm:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1fr)] sm:gap-4">
      <code className="break-all text-xs">{path}</code>
      <p className="text-sm">
        <span className="text-muted-foreground">{kind}: </span>
        <span className="break-all">{formatValue(value)}</span>
      </p>
    </li>
  )
}

function ChangedDiffRow({
  path,
  before,
  after,
}: {
  path: string
  before: DiffValue
  after: DiffValue
}) {
  return (
    <li className="border-border/70 grid gap-1 border-b pb-3 last:border-0 last:pb-0 sm:grid-cols-[minmax(12rem,0.8fr)_minmax(0,1fr)] sm:gap-4">
      <code className="break-all text-xs">{path}</code>
      <div className="grid gap-1 text-sm">
        <p className="break-all">
          <span className="text-muted-foreground">Before: </span>
          {formatValue(before)}
        </p>
        <p className="break-all">
          <span className="text-muted-foreground">After: </span>
          {formatValue(after)}
        </p>
      </div>
    </li>
  )
}

export default function DiffRoute() {
  const isHydrated = useHydrated()
  const { snapshot } = useReportLibrary(isHydrated)
  const [beforeId, setBeforeId] = useState("")
  const [afterId, setAfterId] = useState("")

  const before = snapshot.reports.find((report) => report.id === beforeId)
  const after = snapshot.reports.find((report) => report.id === afterId)

  const result = useMemo(() => {
    if (!before || !after) {
      return undefined
    }

    return diffReportOutputs(
      {
        sourceUrl: before.sourceUrl,
        json: before.outputs.json,
      },
      {
        sourceUrl: after.sourceUrl,
        json: after.outputs.json,
      }
    )
  }, [after, before])

  return (
    <div className="flex min-h-screen flex-col font-sans">
      <Header sticky={false} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-12 sm:px-12">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">
            Compare reports
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
            Compare saved media details by track, field, and chapter. Values in
            the second report appear as the “after” value.
          </p>
        </header>

        <section
          aria-label="Choose reports to compare"
          className="bg-card grid gap-4 rounded-2xl border p-5 sm:grid-cols-2"
        >
          <label className="grid gap-2 text-sm font-medium">
            From report
            <select
              className="bg-background border-input h-10 min-w-0 rounded-md border px-3 font-normal"
              value={beforeId}
              disabled={!isHydrated || snapshot.isLoading}
              onChange={(event) => {
                const nextId = event.currentTarget.value
                setBeforeId(nextId)

                if (nextId === afterId) {
                  setAfterId("")
                }
              }}
            >
              <option value="">Choose a report</option>
              {snapshot.reports.map((report) => (
                <option
                  key={report.id}
                  value={report.id}
                  disabled={report.id === afterId}
                >
                  {reportOptionLabel(report)}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium">
            To report
            <select
              className="bg-background border-input h-10 min-w-0 rounded-md border px-3 font-normal"
              value={afterId}
              disabled={!isHydrated || snapshot.isLoading}
              onChange={(event) => {
                const nextId = event.currentTarget.value
                setAfterId(nextId)

                if (nextId === beforeId) {
                  setBeforeId("")
                }
              }}
            >
              <option value="">Choose a report</option>
              {snapshot.reports.map((report) => (
                <option
                  key={report.id}
                  value={report.id}
                  disabled={report.id === beforeId}
                >
                  {reportOptionLabel(report)}
                </option>
              ))}
            </select>
          </label>
        </section>

        {snapshot.error && (
          <p role="status" className="text-destructive text-sm">
            {snapshot.error}
          </p>
        )}

        {(!isHydrated || snapshot.isLoading) && (
          <p className="text-muted-foreground">Loading your library…</p>
        )}

        {isHydrated && !snapshot.isLoading && snapshot.reports.length < 2 && (
          <section className="bg-card space-y-3 rounded-2xl border p-6">
            <h2 className="font-medium">Two saved reports are needed</h2>
            <p className="text-muted-foreground text-sm">
              Save at least two analyses in your library before comparing them.
            </p>
          </section>
        )}

        {result && !result.ok && (
          <p role="alert" className="text-destructive text-sm">
            {result.side === "before" ? "From report" : "To report"}:{" "}
            {result.message}
          </p>
        )}

        {result?.ok && (
          <div className="space-y-4">
            {result.diff.added.length === 0 &&
              result.diff.removed.length === 0 &&
              result.diff.changed.length === 0 && (
                <p className="bg-card text-muted-foreground rounded-xl border p-5 text-sm">
                  No structural changes found between these reports.
                </p>
              )}
            {DIFF_GROUPS.map((group) =>
              renderDiffEntries(result.diff, group.id)
            )}
          </div>
        )}

        {isHydrated && snapshot.reports.length >= 2 && (!before || !after) && (
          <p className="text-muted-foreground text-sm">
            Choose two different reports to see their structural differences.
          </p>
        )}
      </main>
      <Footer />
    </div>
  )
}
