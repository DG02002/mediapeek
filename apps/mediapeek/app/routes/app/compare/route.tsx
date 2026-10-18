import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { Schema } from "effect"

import { MediaSkeleton } from "~/components/media-skeleton"
import { buttonVariants } from "~/components/ui/button"
import { ReportCompare } from "~/features/compare/report-compare"
import { useStoredReports } from "~/features/reports/use-stored-reports"
import { useHydrated } from "~/hooks/use-hydrated"

const compareSearchSchema = Schema.Struct({
  item: Schema.optionalKey(
    Schema.Union([Schema.String, Schema.Array(Schema.String)])
  ),
  format: Schema.optionalKey(Schema.String),
})

export interface CompareSearch {
  item: Array<string>
  format?: string
}

function AppComparePage() {
  const { item: itemIds } = Route.useSearch()
  const navigate = useNavigate()
  const isHydrated = useHydrated()
  const reportsSnapshot = useStoredReports(isHydrated)

  const baseReport = reportsSnapshot.reports.find(
    (report) => report.id === itemIds[0]
  )

  if (!isHydrated || reportsSnapshot.isLoading) {
    return <MediaSkeleton />
  }

  if (!baseReport) {
    return (
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <h1 className="font-heading text-2xl font-semibold">
          Choose a report to compare
        </h1>
        <p className="text-muted-foreground text-sm">
          Select Compare from a saved report’s menu to start a comparison.
        </p>
        <Link
          to="/app"
          className={buttonVariants({
            variant: "outline",
            className: "self-start",
          })}
        >
          Recent reports
        </Link>
      </section>
    )
  }

  return (
    <ReportCompare
      baseReport={baseReport}
      reports={reportsSnapshot.reports}
      onClose={() => void navigate({ to: "/app" })}
    />
  )
}

export const Route = createFileRoute("/app/compare")({
  validateSearch: (search) => {
    const { format, item } =
      Schema.decodeUnknownSync(compareSearchSchema)(search)

    const validatedSearch: CompareSearch = {
      item: Schema.is(Schema.String)(item) ? [item] : Array.from(item ?? []),
    }

    if (format) {
      validatedSearch.format = format
    }

    return validatedSearch
  },
  head: () => ({ meta: [{ title: "Compare Media Reports - MediaPeek" }] }),
  component: AppComparePage,
})
