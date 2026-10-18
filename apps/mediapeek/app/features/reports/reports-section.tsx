"use client"

import { Archive04Icon, Cancel01Icon } from "@hugeicons/core-free-icons"
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { Button } from "~/components/ui/button"
import { Icon } from "~/components/ui/icon"
import { ReportCompare } from "~/features/compare/report-compare"
import { ReportRow } from "~/features/reports/report-row"
import {
  deleteReport,
  type StoredReport,
} from "~/features/reports/report-storage"
import { subscribeToReportsChanged } from "~/features/reports/reports-changed"
import { StoredReportView } from "~/features/reports/stored-report-view"
import { useHydrated } from "~/hooks/use-hydrated"

import { useStoredReports } from "./use-stored-reports"

const ReportsEmptyState = () => (
  <section
    aria-labelledby="reports-empty-title"
    className="flex min-h-72 w-full flex-col items-center justify-center px-6 py-16 text-center"
  >
    <div
      aria-hidden="true"
      className="mb-5 flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground"
    >
      <Icon icon={Archive04Icon} strokeWidth={1.8} className="size-7" />
    </div>
    <div className="flex max-w-md flex-col items-center gap-2">
      <h2
        id="reports-empty-title"
        className="font-heading text-xl font-semibold"
      >
        No saved reports yet
      </h2>
      <p className="max-w-sm text-sm leading-6 text-muted-foreground text-pretty">
        Save a report to see it here.
      </p>
    </div>
  </section>
)

const clearModeParams = (params: URLSearchParams) => {
  params.delete("report")
  params.delete("compare")
  params.delete("with")
  params.delete("format")
}

const useReportModes = () => {
  const [searchParams, setSearchParams] = useSearchParams()

  const updateParams = (mutate: (params: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams)

    mutate(next)
    setSearchParams(next, { preventScrollReset: true })
  }

  const showReport = (id: string) => {
    updateParams((params) => {
      clearModeParams(params)
      params.set("report", id)
    })
  }

  const showCompare = (id: string) => {
    updateParams((params) => {
      clearModeParams(params)
      params.set("compare", id)
    })
  }

  const closeModes = () => {
    updateParams(clearModeParams)
  }

  return { searchParams, showReport, showCompare, closeModes }
}

export function ReportsSection() {
  const isHydrated = useHydrated()

  const { store: reportsStore, snapshot: reportsSnapshot } =
    useStoredReports(isHydrated)

  const { searchParams, showReport, showCompare, closeModes } = useReportModes()

  const { reports } = reportsSnapshot
  const openReportId = searchParams.get("report")
  const compareBaseId = searchParams.get("compare")

  const openReport = openReportId
    ? (reports.find((report) => report.id === openReportId) ?? null)
    : null

  const compareBase = compareBaseId
    ? (reports.find((report) => report.id === compareBaseId) ?? null)
    : null

  const openReportMissing =
    Boolean(openReportId) && !reportsSnapshot.isLoading && !openReport

  const compareBaseMissing =
    Boolean(compareBaseId) && !reportsSnapshot.isLoading && !compareBase

  const [deleteTarget, setDeleteTarget] = useState<StoredReport | null>(null)

  const [message, setMessage] = useState<string | null>(null)

  useEffect(
    () =>
      subscribeToReportsChanged(() => {
        void reportsStore.refresh()
      }),
    [reportsStore]
  )

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) {
      return
    }

    const report = deleteTarget
    setDeleteTarget(null)

    try {
      await deleteReport(report.id)
      await reportsStore.refresh()
      setMessage(`Deleted ${report.filename}.`)
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to delete the report."
      )
    }
  }

  return (
    <section
      aria-labelledby={reports.length > 0 ? "recent-title" : undefined}
      aria-label={reports.length === 0 ? "Recent reports" : undefined}
      className="space-y-4"
    >
      {(reports.length > 0 || reportsSnapshot.isLoading) && (
        <div>
          <h2 id="recent-title" className="font-heading text-2xl font-bold">
            Recent{" "}
            {reports.length > 0 && (
              <span className="text-muted-foreground">
                ({String(reports.length)})
              </span>
            )}
          </h2>
        </div>
      )}

      {(message ?? reportsSnapshot.error) && (
        <p role="status" className="text-muted-foreground text-sm">
          {message ?? reportsSnapshot.error}
        </p>
      )}

      {(openReportMissing || compareBaseMissing) && (
        <p role="status" className="text-muted-foreground text-sm">
          That report is no longer available.
        </p>
      )}

      {reportsSnapshot.isLoading && reports.length === 0 && (
        <p className="text-muted-foreground text-sm">Loading your reports…</p>
      )}

      {!reportsSnapshot.isLoading && reports.length === 0 && (
        <ReportsEmptyState />
      )}

      {compareBase ? (
        <ReportCompare
          baseReport={compareBase}
          reports={reports}
          onClose={closeModes}
        />
      ) : (
        reports.length > 0 && (
          <ol className="flex flex-col divide-y divide-border/70">
            {reports.map((report) => (
              <ReportRow
                key={report.id}
                report={report}
                selected={openReport?.id === report.id}
                onOpen={() => showReport(report.id)}
                onCompare={() => showCompare(report.id)}
                onDelete={() => setDeleteTarget(report)}
              />
            ))}
          </ol>
        )
      )}

      {!compareBase && openReport && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={closeModes}
            >
              <Icon icon={Cancel01Icon} size={16} />
              Close report
            </Button>
          </div>
          <StoredReportView report={openReport} />
        </div>
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this report?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.filename} will be removed from this browser. This
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={() => void handleDeleteConfirm()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
