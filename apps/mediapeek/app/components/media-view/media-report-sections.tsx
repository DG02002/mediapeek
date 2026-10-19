import { memo } from "react"

import type { MediaReport } from "~/features/reports/media-report"

import { AccessibilitySection } from "./accessibility-section"
import { AudioSection } from "./audio-section"
import { ChapterSection } from "./chapter-section"
import { GeneralSection } from "./general-section"
import { LibrarySection } from "./library-section"
import { SubtitleSection } from "./subtitle-section"
import { VideoSection } from "./video-section"

interface MediaReportSectionsProps {
  report: MediaReport
  showOriginalTitles: boolean
  className: string
}

export const MediaReportSections = memo(function MediaReportSections({
  report,
  showOriginalTitles,
  className,
}: MediaReportSectionsProps) {
  return (
    <div className={className}>
      <GeneralSection report={report} />
      <VideoSection
        videoTracks={report.videos}
        archiveSizingWarning={report.file.archive?.sizing.warning}
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
  )
})
