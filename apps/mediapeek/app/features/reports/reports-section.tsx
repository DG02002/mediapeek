"use client"

import { Archive04Icon } from "@hugeicons/core-free-icons"
import { useState } from "react"
import { useNavigate } from "react-router"

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
import { Icon } from "~/components/ui/icon"
import {
  reportStorageStore,
  type StoredReport,
} from "~/features/reports/report-storage"
import { useHydrated } from "~/hooks/use-hydrated"

import { ReportRow } from "./report-row"
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

export function ReportsSection() {
  const navigate = useNavigate()
  const isHydrated = useHydrated()
  const reportsSnapshot = useStoredReports(isHydrated)
  const { reports } = reportsSnapshot
  const [deleteTarget, setDeleteTarget] = useState<StoredReport | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) {
      return
    }

    const report = deleteTarget
    setDeleteTarget(null)

    try {
      await reportStorageStore.delete(report.id)
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

      {reportsSnapshot.isLoading && reports.length === 0 && (
        <p className="text-muted-foreground text-sm">Loading your reports…</p>
      )}

      {!reportsSnapshot.isLoading && reports.length === 0 && (
        <ReportsEmptyState />
      )}

      {reports.length > 0 && (
        <ol className="flex flex-col divide-y divide-border/70">
          {reports.map((report) => (
            <ReportRow
              key={report.id}
              report={report}
              onOpen={() => void navigate(`/app/item/${report.id}`)}
              onCompare={() => {
                const params = new URLSearchParams()

                params.append("item", report.id)
                void navigate(`/app/compare?${params.toString()}`)
              }}
              onDelete={() => setDeleteTarget(report)}
            />
          ))}
        </ol>
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
