import { memo } from "react"

import { OptionsMenu } from "~/components/media-view/options-menu"
import { Separator } from "~/components/ui/separator"
import type { AnalysisSession } from "~/features/analyze/analysis-session"
import type { MediaReport } from "~/features/reports/media-report"

import { ArchiveEstimateTooltip } from "./archive-estimate-tooltip"
import { MediaIcon } from "./media-icon"

interface MediaHeaderProps {
  report: MediaReport
  isTextView: boolean
  setIsTextView: (val: boolean) => void
  showOriginalTitles: boolean
  setShowOriginalTitles: (val: boolean) => void
  rawData: Record<string, string>
  url: string
  session: Pick<AnalysisSession, "output">
  requestTurnstileToken?: () => Promise<string | null>
  onExportPng: (theme: "light" | "dark") => Promise<void>
  isExportingPng: boolean
}

export const MediaHeader = memo(function MediaHeader({
  report,
  isTextView,
  setIsTextView,
  showOriginalTitles,
  setShowOriginalTitles,
  rawData,
  url,
  session,
  requestTurnstileToken,
  onExportPng,
  isExportingPng,
}: MediaHeaderProps) {
  const { file } = report
  const displayFilename = file.displayName
  const displayArchiveName = file.archive?.name

  return (
    <div className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-50 -mx-4 flex flex-col gap-4 px-4 pt-4 pb-0 backdrop-blur-md transition-all md:-mx-8 md:px-8">
      <div className="flex flex-col items-start gap-2 md:gap-4">
        <div className="flex w-full flex-col gap-1">
          {displayArchiveName && (
            <div className="text-muted-foreground font-mono text-xs font-semibold tracking-wider break-all uppercase opacity-80 select-all">
              {displayArchiveName}
            </div>
          )}
          <h1 className="text-lg font-bold tracking-tight break-all md:text-2xl">
            {displayFilename}
          </h1>
        </div>
        <div className="text-muted-foreground flex w-full flex-wrap items-center gap-4 text-sm">
          {file.duration && <span>{file.duration}</span>}
          {file.size && (
            <>
              <span className="opacity-30">|</span>
              <span className="inline-flex items-center gap-2">
                <span>{file.size}</span>
                <ArchiveEstimateTooltip
                  warning={file.archive?.sizing.warning}
                />
              </span>
            </>
          )}

          {/* Icons & Options */}
          <div className="border-border flex flex-wrap items-center gap-3 sm:flex-1 sm:border-l sm:pl-4">
            {report.badges.length > 0 &&
              report.badges.map((icon) => (
                <MediaIcon
                  key={icon}
                  name={icon}
                  className="h-5 opacity-90 transition-opacity hover:opacity-100"
                />
              ))}

            {/* Actions */}
            <div className="ml-auto flex items-center gap-2">
              <OptionsMenu
                data={rawData}
                url={url}
                filename={displayFilename}
                session={session}
                requestTurnstileToken={requestTurnstileToken}
                isTextView={isTextView}
                setIsTextView={setIsTextView}
                showOriginalTitles={showOriginalTitles}
                setShowOriginalTitles={setShowOriginalTitles}
                onExportPng={onExportPng}
                isExportingPng={isExportingPng}
              />
            </div>
          </div>
        </div>
      </div>
      <Separator />
    </div>
  )
})
