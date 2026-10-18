import { forwardRef, memo } from "react"

import {
  MEDIA_EXPORT_POSITION_OFFSET_PX,
  MEDIA_EXPORT_WIDTH_PX,
} from "~/constants"
import type { MediaReport } from "~/features/reports/media-report"

import { AccessibilitySection } from "./accessibility-section"
import { AudioSection } from "./audio-section"
import { ChapterSection } from "./chapter-section"
import { GeneralSection } from "./general-section"
import { LibrarySection } from "./library-section"
import { MediaIcon } from "./media-icon"
import { SubtitleSection } from "./subtitle-section"
import { VideoSection } from "./video-section"

interface MediaReportExportProps {
  report: MediaReport
  showOriginalTitles: boolean
}

export const MediaReportExport = memo(
  forwardRef<HTMLDivElement, MediaReportExportProps>(
    ({ report, showOriginalTitles }, ref) => {
      const { file, badges } = report

      return (
        <div
          ref={ref}
          aria-hidden="true"
          inert
          className="bg-background text-foreground fixed top-0 space-y-10 px-12 py-10"
          style={{
            width: `${MEDIA_EXPORT_WIDTH_PX}px`,
            insetInlineStart: `-${MEDIA_EXPORT_POSITION_OFFSET_PX}px`,
          }}
        >
          <header className="border-border space-y-6 border-b pb-8">
            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">
                MediaPeek metadata report
              </p>
              {file.archive?.name && (
                <p className="text-muted-foreground font-mono text-xs font-semibold tracking-wider break-all uppercase">
                  {file.archive.name}
                </p>
              )}
              <h1 className="text-3xl font-bold tracking-tight break-all">
                {file.displayName}
              </h1>
            </div>

            <div className="flex items-start justify-between gap-8">
              <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {file.duration && <span>{file.duration}</span>}
                {file.size && <span>{file.size}</span>}
              </div>
              {badges.length > 0 && (
                <div className="flex max-w-sm flex-wrap justify-end gap-3">
                  {badges.map((badge) => (
                    <MediaIcon key={badge} name={badge} className="h-7" />
                  ))}
                </div>
              )}
            </div>
          </header>

          <div className="space-y-8">
            <GeneralSection report={report} />
            <VideoSection
              videoTracks={report.videos}
              archiveSizingWarning={file.archive?.sizing.warning}
            />
            <AudioSection
              audioTracks={report.audios}
              showOriginalTitles={showOriginalTitles}
            />
            <SubtitleSection
              textTracks={report.subtitles}
              showOriginalTitles={showOriginalTitles}
            />
            <ChapterSection chapters={report.chapters} />
            <AccessibilitySection accessibility={report.accessibility} />
            <LibrarySection library={report.engine} badges={report.badges} />
          </div>
        </div>
      )
    }
  )
)

MediaReportExport.displayName = "MediaReportExport"
