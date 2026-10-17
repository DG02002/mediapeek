import { extractFilenameFromUrl } from "@mediapeek/shared/filename-resolution"
import { useState } from "react"

import { Button } from "~/components/ui/button"
import type { AnalysisResult } from "~/features/analyze/analysis-session"
import { parseMediaReport } from "~/features/library/media-report"
import { saveReport } from "~/features/library/report-library"
import { notifyReportsChanged } from "~/features/library/reports-changed"
import { fetchAnalyzeFormat } from "~/lib/analyze-client"

interface SaveAnalysisButtonProps {
  analysis: AnalysisResult
  requestTurnstileToken?: () => Promise<string | null>
}

export function SaveAnalysisButton({
  analysis,
  requestTurnstileToken,
}: SaveAnalysisButtonProps) {
  const [message, setMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    setIsSaving(true)

    try {
      const outputs = { ...analysis.outputs }
      let textUnavailable = false

      if (outputs.text === undefined) {
        const textResult = await fetchAnalyzeFormat({
          url: analysis.url,
          format: "text",
          requestTurnstileToken,
        })

        if (textResult.ok) {
          outputs.text = textResult.content
        } else {
          textUnavailable = true
        }
      }

      const json = outputs.json ?? ""
      const parsed = parseMediaReport({ json, sourceUrl: analysis.url })

      const filename = parsed.ok
        ? parsed.report.file.displayName
        : extractFilenameFromUrl(analysis.url)

      await saveReport({
        sourceUrl: analysis.url,
        filename,
        analyzedAt: new Date().toISOString(),
        outputs,
      })

      notifyReportsChanged()
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
