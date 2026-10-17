"use client"

import {
  ArrowDownToLineIcon,
  ArrowUpFromLineIcon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons"
import { useEffect, useRef, useState } from "react"
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
import { ReportCompare } from "~/features/diff/report-compare"
import {
  deleteReport,
  exportAll,
  importAll,
  type StoredReport,
} from "~/features/library/report-library"
import { ReportRow } from "~/features/library/report-row"
import { subscribeToReportsChanged } from "~/features/library/reports-changed"
import { StoredReportView } from "~/features/library/stored-report-view"
import { useHydrated } from "~/hooks/use-hydrated"

import { useReportLibrary } from "./use-report-library"

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

  const { store: libraryStore, snapshot: librarySnapshot } =
    useReportLibrary(isHydrated)

  const { searchParams, showReport, showCompare, closeModes } = useReportModes()

  const { reports } = librarySnapshot
  const openReportId = searchParams.get("report")
  const compareBaseId = searchParams.get("compare")

  const openReport = openReportId
    ? (reports.find((report) => report.id === openReportId) ?? null)
    : null

  const compareBase = compareBaseId
    ? (reports.find((report) => report.id === compareBaseId) ?? null)
    : null

  const openReportMissing =
    Boolean(openReportId) && !librarySnapshot.isLoading && !openReport

  const compareBaseMissing =
    Boolean(compareBaseId) && !librarySnapshot.isLoading && !compareBase

  const [deleteTarget, setDeleteTarget] = useState<StoredReport | null>(null)

  const [message, setMessage] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(
    () =>
      subscribeToReportsChanged(() => {
        void libraryStore.refresh()
      }),
    [libraryStore]
  )

  const handleExport = async () => {
    setIsBusy(true)

    try {
      const count = await exportAll()
      setMessage(`Exported ${String(count)} reports.`)
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to export reports."
      )
    } finally {
      setIsBusy(false)
    }
  }

  const handleImport = async (file: File | undefined) => {
    if (!file) {
      return
    }

    setIsBusy(true)

    try {
      const count = await importAll(file)
      await libraryStore.refresh()
      setMessage(`Imported ${String(count)} reports.`)
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to import reports."
      )
    } finally {
      setIsBusy(false)

      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) {
      return
    }

    const report = deleteTarget
    setDeleteTarget(null)
    setIsBusy(true)

    try {
      await deleteReport(report.id)
      await libraryStore.refresh()
      setMessage(`Deleted ${report.filename}.`)
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to delete the report."
      )
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <section aria-labelledby="reports-title" className="mt-16 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="reports-title" className="text-lg font-semibold">
          Reports{" "}
          {reports.length > 0 && (
            <span className="text-muted-foreground">
              ({String(reports.length)})
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Import report library JSON"
            onChange={(event) => {
              void handleImport(event.currentTarget.files?.item(0) ?? undefined)
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
          >
            <Icon icon={ArrowUpFromLineIcon} size={16} />
            Import
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            disabled={isBusy || reports.length === 0}
            onClick={() => void handleExport()}
          >
            <Icon icon={ArrowDownToLineIcon} size={16} />
            Export
          </Button>
        </div>
      </div>

      {(message ?? librarySnapshot.error) && (
        <p role="status" className="text-muted-foreground text-sm">
          {message ?? librarySnapshot.error}
        </p>
      )}

      {(openReportMissing || compareBaseMissing) && (
        <p role="status" className="text-muted-foreground text-sm">
          That report is no longer available.
        </p>
      )}

      {librarySnapshot.isLoading && reports.length === 0 && (
        <p className="text-muted-foreground text-sm">Loading your reports…</p>
      )}

      {!librarySnapshot.isLoading && reports.length === 0 && (
        <p className="bg-card text-muted-foreground rounded-2xl border p-5 text-sm">
          Reports you analyze stay on this device. Choose “Save report” after an
          analysis to keep one here.
        </p>
      )}

      {compareBase ? (
        <ReportCompare
          baseReport={compareBase}
          reports={reports}
          onClose={closeModes}
        />
      ) : (
        reports.length > 0 && (
          <ol className="space-y-3">
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
