"use client"

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
import {
  reportStorageStore,
  type StoredReport,
} from "~/features/reports/report-storage"
import { useHydrated } from "~/hooks/use-hydrated"

import { ReportRow } from "./report-row"
import { useStoredReports } from "./use-stored-reports"

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
      {reports.length > 0 && (
        <h2 id="recent-title" className="font-heading text-2xl font-bold">
          Recent
        </h2>
      )}

      {(message ?? reportsSnapshot.error) && (
        <p role="status" className="text-muted-foreground text-sm">
          {message ?? reportsSnapshot.error}
        </p>
      )}

      {reportsSnapshot.isLoading && reports.length === 0 && (
        <p className="text-muted-foreground text-sm">Loading your reports…</p>
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
