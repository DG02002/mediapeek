import {
  ANALYZE_WARNING_ARCHIVE_ENTRY_TRUNCATED,
  ANALYZE_WARNING_FORMAT_GENERATION_FAILED,
  ANALYZE_WARNING_SOURCE_SIZE_UNKNOWN,
  type AnalyzeWarningCode,
} from "@mediapeek/shared/analyze-contract"

const ANALYSIS_WARNING_COPY = {
  [ANALYZE_WARNING_SOURCE_SIZE_UNKNOWN]:
    "The source did not report its total size, so MediaPeek may not be able to inspect the full file.",
  [ANALYZE_WARNING_ARCHIVE_ENTRY_TRUNCATED]:
    "This archive entry was larger than the portion fetched, so analysis covered only its first portion.",
  [ANALYZE_WARNING_FORMAT_GENERATION_FAILED]:
    "One or more requested output formats failed to generate. Their displayed error placeholders are not metadata.",
} satisfies Record<AnalyzeWarningCode, string>

export function AnalysisWarningBanner({
  warnings,
}: {
  warnings?: ReadonlyArray<AnalyzeWarningCode>
}) {
  const messages =
    warnings?.map((warning, index) => ({
      id: `${warning}-${String(index)}`,
      message: ANALYSIS_WARNING_COPY[warning],
    })) ?? []

  if (messages.length === 0) {
    return null
  }

  return (
    <div
      role="note"
      aria-label="Analysis warning"
      className="border-border/60 bg-muted/30 text-muted-foreground rounded-lg border px-4 py-3 text-sm"
    >
      {messages.map(({ id, message }) => (
        <p key={id}>{message}</p>
      ))}
    </div>
  )
}
