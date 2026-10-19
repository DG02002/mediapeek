import { extractFilenameFromUrl } from "@mediapeek/shared/filename-resolution"
import { useState } from "react"

import { Button } from "~/components/ui/button"
import type {
  AnalysisResult,
  AnalysisSession,
} from "~/features/analyze/analysis-session"
import { parseMediaReport } from "~/features/reports/media-report"
import {
  reportStorageStore,
  type StoredReport,
} from "~/features/reports/report-storage"

interface SaveReportButtonProps {
  analysis: AnalysisResult
  session: Pick<AnalysisSession, "output">
  requestTurnstileToken?: () => Promise<string | null>
  onSaved?: (report: StoredReport) => void
}

export function SaveReportButton({
  analysis,
  session,
  requestTurnstileToken,
  onSaved,
}: SaveReportButtonProps) {
  const [message, setMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)

    try {
      const outputs = { ...analysis.outputs }
      let textUnavailable = false

      if (outputs.text === undefined) {
        try {
          outputs.text = await session.output("text", requestTurnstileToken)
        } catch {
          textUnavailable = true
        }
      }

      const json = outputs.json ?? ""
      const parsed = parseMediaReport({ json, sourceUrl: analysis.url })

      const filename = parsed.ok
        ? parsed.report.file.displayName
        : extractFilenameFromUrl(analysis.url)

      const report = await reportStorageStore.save({
        sourceUrl: analysis.url,
        filename,
        analyzedAt: new Date().toISOString(),
        outputs,
      })

      onSaved?.(report)

      setMessage(
        textUnavailable
          ? "Saved to your reports. The text output could not be added."
          : "Saved to your reports."
      )
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save this report."
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        onClick={() => void handleSave()}
        disabled={isSaving}
      >
        {isSaving ? "Saving…" : "Save report"}
      </Button>
      {message && (
        <p role="status" className="text-muted-foreground text-sm">
          {message}
        </p>
      )}
    </div>
  )
}
