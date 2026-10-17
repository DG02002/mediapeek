import { forwardRef, memo } from "react"

import {
  MEDIA_EXPORT_POSITION_OFFSET_PX,
  MEDIA_EXPORT_WIDTH_PX,
} from "~/constants"
import { getMediaBadges } from "~/lib/media-utils"
import type { MediaInfoJSON, MediaTrackJSON } from "~/types/media"

import { AccessibilitySection } from "./accessibility-section"
import { AudioSection } from "./audio-section"
import { ChapterSection } from "./chapter-section"
import { GeneralSection } from "./general-section"
import { LibrarySection } from "./library-section"
import { MediaIcon } from "./media-icon"
import { SubtitleSection } from "./subtitle-section"
import { VideoSection } from "./video-section"

interface MediaReportExportProps {
  filename: string
  generalTrack?: MediaTrackJSON
  videoTracks: MediaTrackJSON[]
  audioTracks: MediaTrackJSON[]
  textTracks: MediaTrackJSON[]
  menuTrack?: MediaTrackJSON
  creatingLibrary?: MediaInfoJSON["creatingLibrary"]
  showOriginalTitles: boolean
}

const getTrackSize = (track: MediaTrackJSON | undefined) =>
  track?.FileSize_String ??
  track?.["FileSize/String"] ??
  (track?.FileSize === undefined ? undefined : String(track.FileSize))

const getTrackDuration = (track: MediaTrackJSON | undefined) =>
  track?.Duration_String ??
  track?.["Duration/String"] ??
  (track?.Duration === undefined ? undefined : String(track.Duration))

export const MediaReportExport = memo(
  forwardRef<HTMLDivElement, MediaReportExportProps>(
    (
      {
        filename,
        generalTrack,
        videoTracks,
        audioTracks,
        textTracks,
        menuTrack,
        creatingLibrary,
        showOriginalTitles,
      },
      ref
    ) => {
      const badges = getMediaBadges({
        videoTracks,
        audioTracks,
        textTracks,
        generalTrack,
      })

      const archiveName = generalTrack?.Archive_Name?.split("/")
        .pop()
        ?.split("\\")
        .pop()

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
              {archiveName && (
                <p className="text-muted-foreground font-mono text-xs font-semibold tracking-wider break-all uppercase">
                  {archiveName}
                </p>
              )}
              <h1 className="text-3xl font-bold tracking-tight break-all">
                {filename}
              </h1>
            </div>

            <div className="flex items-start justify-between gap-8">
              <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {getTrackDuration(generalTrack) && (
                  <span>{getTrackDuration(generalTrack)}</span>
                )}
                {getTrackSize(generalTrack) && (
                  <span>{getTrackSize(generalTrack)}</span>
                )}
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
            <GeneralSection generalTrack={generalTrack} />
            <VideoSection
              videoTracks={videoTracks}
              archiveSizingWarning={generalTrack?.Archive_Sizing_Warning}
            />
            <AudioSection
              audioTracks={audioTracks}
              showOriginalTitles={showOriginalTitles}
            />
            <SubtitleSection
              textTracks={textTracks}
              showOriginalTitles={showOriginalTitles}
            />
            <ChapterSection menuTrack={menuTrack} />
            <AccessibilitySection
              generalTrack={generalTrack}
              audioTracks={audioTracks}
              textTracks={textTracks}
            />
            <LibrarySection
              library={creatingLibrary}
              generalTrack={generalTrack}
              videoTracks={videoTracks}
              audioTracks={audioTracks}
              textTracks={textTracks}
            />
          </div>
        </div>
      )
    }
  )
)

MediaReportExport.displayName = "MediaReportExport"
