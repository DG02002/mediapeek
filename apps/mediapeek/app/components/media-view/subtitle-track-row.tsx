import { motion } from "motion/react"
import { memo } from "react"

import type { SubtitleTrackReport } from "~/features/reports/media-report"
import { getFirstDefinedFormat } from "~/lib/formatters"

import { TrackBadges } from "./track-badges"
import { TrackTitle } from "./track-title"

interface SubtitleTrackRowProps {
  track: SubtitleTrackReport
  showOriginalTitles: boolean
}

export const SubtitleTrackRow = memo(function SubtitleTrackRow({
  track,
  showOriginalTitles,
}: SubtitleTrackRowProps) {
  const langName = track.language
  const rawTitle = track.title
  const displayTitle = showOriginalTitles ? rawTitle : track.displayTitle

  const isForcedTitle =
    rawTitle?.toLowerCase() === `${langName} (Forced)`.toLowerCase()

  const showTitle =
    displayTitle &&
    displayTitle.length > 0 &&
    displayTitle.toLowerCase() !== langName.toLowerCase() &&
    !(isForcedTitle && track.isForced)

  const displayFormat = getFirstDefinedFormat(
    track.codecInfo || undefined,
    track.formatInfo || undefined,
    track.formatName || undefined,
    track.codecId || undefined
  )

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
      className="bg-muted/10 border-border/40 flex items-center justify-between rounded-md border p-3"
    >
      <div className="flex items-start gap-3">
        {/* Track Number Column */}
        <span className="text-muted-foreground pt-0.5 text-xs font-medium">
          {track.order}
        </span>

        {/* Content Column */}
        <div className="flex flex-col gap-0.5">
          {/* Line 1: Language Name */}
          <span className="text-foreground/85 text-sm font-semibold">
            {langName}
          </span>

          {/* Line 2: Track Title */}
          <TrackTitle
            title={showTitle ? displayTitle : undefined}
            className="text-muted-foreground text-xs"
          />

          {/* Line 3: Format */}
          <span className="text-muted-foreground/70 text-xs tracking-wide">
            {displayFormat}
          </span>
        </div>
      </div>
      <div className="flex gap-1.5 self-center">
        <TrackBadges
          isDefault={track.isDefault}
          isForced={track.isForced}
          className="h-5"
        />
      </div>
    </motion.div>
  )
})
