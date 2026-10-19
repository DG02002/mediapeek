import { motion } from "motion/react"
import { memo } from "react"

import { AudioStreamStructure } from "~/components/media-view/audio-stream-structure"
import { AudioTechDetails } from "~/components/media-view/audio-tech-details"
import type { AudioTrackReport } from "~/features/reports/media-report"
import {
  cleanMetadataString,
  formatAudioChannels,
  getFirstDefinedFormat,
} from "~/lib/formatters"

import { TrackBadges } from "./track-badges"
import { TrackTitle } from "./track-title"

interface AudioTrackRowProps {
  track: AudioTrackReport
  trackNumber: string | undefined
  showTrackNumber: boolean
  showOriginalTitles: boolean
}

export const AudioTrackRow = memo(function AudioTrackRow({
  track,
  trackNumber,
  showTrackNumber,
  showOriginalTitles,
}: AudioTrackRowProps) {
  const title = showOriginalTitles ? track.title : track.displayTitle

  const channelsStr =
    formatAudioChannels(track.channels, track.channelPositions) ||
    track.channelsText ||
    track.channels

  let channels = String(channelsStr)

  if (track.objectCount > 0) {
    channels += ` with ${String(track.objectCount)} Objects`
  }

  const commercial = cleanMetadataString(track.formatCommercialIfAny)
  const info = track.formatInfo
  const rawFormat = cleanMetadataString(track.formatName)
  const { codecInfo } = track

  // Prioritize CodecID_Info if available
  const format = getFirstDefinedFormat(codecInfo, commercial, info, rawFormat)
  const subFormat = commercial && info ? info : undefined

  return (
    <motion.div
      layout
      transition={{
        layout: {
          duration: 0.3,
          type: "spring",
          bounce: 0,
          damping: 20,
          stiffness: 140,
        },
      }}
      className="bg-muted/10 border-muted/20 hover:bg-muted/20 flex flex-col items-start gap-2 rounded-lg border p-4 transition-colors sm:flex-row sm:gap-4"
    >
      <div className="flex w-full items-start justify-between sm:hidden">
        {showTrackNumber && (
          <span className="text-muted-foreground pt-0.5 text-xs font-medium">
            {trackNumber}
          </span>
        )}
        <div className="flex flex-wrap justify-end gap-1.5 align-top">
          <TrackBadges isDefault={track.isDefault} isForced={track.isForced} />
        </div>
      </div>

      {showTrackNumber && (
        <span className="text-muted-foreground hidden pt-0.5 text-xs font-medium sm:block">
          {trackNumber}
        </span>
      )}

      <div className="flex w-full flex-1 flex-col gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-foreground text-base font-semibold">
                {track.language}
              </span>
              <span className="text-muted-foreground text-sm">
                ({channels})
              </span>
            </div>
            <div className="hidden flex-wrap justify-end gap-1.5 align-top sm:flex">
              <TrackBadges
                isDefault={track.isDefault}
                isForced={track.isForced}
              />
            </div>
          </div>

          <div className="flex flex-col">
            <div className="flex flex-col gap-0.5">
              <span className="text-foreground/90 text-sm font-medium">
                {format}
                {subFormat && format !== subFormat && (
                  <span className="text-muted-foreground ml-1 font-normal">
                    {subFormat}
                  </span>
                )}
              </span>
              {track.channelLayout && (
                <span className="text-muted-foreground font-mono text-xs">
                  {track.channelLayout}
                </span>
              )}
            </div>

            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <TrackTitle title={title} />
            </div>
          </div>
        </div>

        <AudioTechDetails track={track} />
        <AudioStreamStructure track={track} />
      </div>
    </motion.div>
  )
})
