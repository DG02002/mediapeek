import { AnimatePresence, motion } from "motion/react"
import { memo } from "react"

import { AudioStreamStructure } from "~/components/media-view/audio-stream-structure"
import { AudioTechDetails } from "~/components/media-view/audio-tech-details"
import { Badge } from "~/components/ui/badge"
import type { AudioTrackReport } from "~/features/reports/media-report"
import { cleanMetadataString, formatAudioChannels } from "~/lib/formatters"

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
  const format = codecInfo ?? commercial ?? info ?? rawFormat
  const subFormat = commercial && info ? info : undefined

  const renderBadges = () => {
    return (
      <>
        {track.isDefault && (
          <Badge className="border border-emerald-500/20 bg-emerald-500/15 text-[10px] text-emerald-700 hover:bg-emerald-500/25 dark:bg-emerald-500/20 dark:text-emerald-400">
            Default
          </Badge>
        )}
        {track.isForced && (
          <Badge className="border border-amber-500/20 bg-amber-500/15 text-[10px] text-amber-700 hover:bg-amber-500/25 dark:bg-amber-500/20 dark:text-amber-400">
            Forced
          </Badge>
        )}
      </>
    )
  }

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
          {renderBadges()}
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
              {renderBadges()}
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
              <AnimatePresence mode="popLayout">
                {title && (
                  <motion.span
                    key={title}
                    initial={{ opacity: 0, filter: "blur(4px)" }}
                    animate={{ opacity: 1, filter: "blur(0px)" }}
                    exit={{ opacity: 0, filter: "blur(4px)" }}
                    transition={{ duration: 0.2 }}
                  >
                    {title}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <AudioTechDetails track={track} />
        <AudioStreamStructure track={track} />
      </div>
    </motion.div>
  )
})
