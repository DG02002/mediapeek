"use client"

import { Link, useNavigate, useSearchParams } from "react-router"

import { MediaSkeleton } from "~/components/media-skeleton"
import { buttonVariants } from "~/components/ui/button"
import { ReportCompare } from "~/features/compare/report-compare"
import { useStoredReports } from "~/features/reports/use-stored-reports"
import { useHydrated } from "~/hooks/use-hydrated"

import type { Route } from "./+types/route"

export const meta: Route.MetaFunction = () => [
  { title: "Compare Media Reports - MediaPeek" },
]

export default function AppCompareRoute() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isHydrated = useHydrated()
  const reportsSnapshot = useStoredReports(isHydrated)
  const itemIds = searchParams.getAll("item")

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
      onClose={() => void navigate("/app")}
    />
  )
}
