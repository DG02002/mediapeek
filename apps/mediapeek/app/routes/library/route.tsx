import { useRef, useState } from "react"

import { Footer } from "~/components/footer"
import { Header } from "~/components/header"
import { Button } from "~/components/ui/button"
import {
  deleteReport,
  exportAll,
  getReport,
  importAll,
  type StoredReport,
} from "~/features/library/report-library"
import { ReportRow } from "~/features/library/report-row"
import { StoredReportView } from "~/features/library/stored-report-view"
import { useReportLibrary } from "~/features/library/use-report-library"
import { useHydrated } from "~/hooks/use-hydrated"

import type { Route } from "./+types/route"

export const meta: Route.MetaFunction = () => [
  { title: "Library - MediaPeek" },
  {
    name: "description",
    content:
      "Browse, reopen, export, and import reports saved in this browser.",
  },
]

export default function LibraryRoute() {
  const isHydrated = useHydrated()

  const { store: libraryStore, snapshot: librarySnapshot } =
    useReportLibrary(isHydrated)

  const { reports } = librarySnapshot
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null)

  const [selectedReport, setSelectedReport] = useState<StoredReport | null>(
    null
  )

  const [message, setMessage] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const openRequestIdRef = useRef(0)

  const handleOpen = async (id: string) => {
    const requestId = openRequestIdRef.current + 1
    openRequestIdRef.current = requestId
    setSelectedReportId(id)
    setSelectedReport(null)

    try {
      const report = await getReport(id)

      if (requestId !== openRequestIdRef.current) {
        return
      }

      if (report) {
        setSelectedReport(report)
      } else {
        setSelectedReportId(null)
        setSelectedReport(null)
        await libraryStore.refresh()
        setMessage("That report is no longer available.")
      }
    } catch (error) {
      if (requestId !== openRequestIdRef.current) {
        return
      }

      setMessage(
        error instanceof Error ? error.message : "Unable to open the report."
      )
    }
  }

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

  const handleDelete = async (id: string) => {
    setIsBusy(true)

    try {
      await deleteReport(id)
      await libraryStore.refresh()

      if (selectedReportId === id) {
        openRequestIdRef.current += 1
        setSelectedReportId(null)
        setSelectedReport(null)
      }

      setMessage("Report deleted.")
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to delete the report."
      )
    } finally {
      setIsBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col font-sans">
      <Header sticky={false} />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-12 sm:px-12">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Library</h1>
            <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
              Reports stay in this browser. Export a JSON backup to move them to
              another device.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Import report library JSON"
              onChange={(event) => {
                void handleImport(
                  event.currentTarget.files?.item(0) ?? undefined
                )
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={isBusy}
              onClick={() => fileInputRef.current?.click()}
            >
              Import JSON
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isBusy || reports.length === 0}
              onClick={() => void handleExport()}
            >
              Export JSON
            </Button>
          </div>
        </header>

        {(message ?? librarySnapshot.error) && (
          <p role="status" className="text-muted-foreground text-sm">
            {message ?? librarySnapshot.error}
          </p>
        )}

        {(!isHydrated || librarySnapshot.isLoading) && (
          <p className="text-muted-foreground">Loading your library…</p>
        )}

        {isHydrated && !librarySnapshot.isLoading && reports.length === 0 && (
          <section className="bg-card space-y-3 rounded-2xl border p-6">
            <h2 className="font-medium">No saved reports yet</h2>
            <p className="text-muted-foreground text-sm">
              Analyze a media URL and choose “Save report” to keep it here.
            </p>
          </section>
        )}

        {isHydrated && reports.length > 0 && (
          <section aria-labelledby="saved-reports-title" className="space-y-4">
            <h2 id="saved-reports-title" className="text-lg font-semibold">
              Saved reports{" "}
              <span className="text-muted-foreground">
                ({String(reports.length)})
              </span>
            </h2>
            <ol className="space-y-3">
              {reports.map((report) => (
                <ReportRow
                  key={report.id}
                  report={report}
                  selected={selectedReport?.id === report.id}
                  onOpen={() => void handleOpen(report.id)}
                  onDelete={() => void handleDelete(report.id)}
                />
              ))}
            </ol>
          </section>
        )}

        {selectedReport && <StoredReportView report={selectedReport} />}
      </main>
      <Footer />
    </div>
  )
}
