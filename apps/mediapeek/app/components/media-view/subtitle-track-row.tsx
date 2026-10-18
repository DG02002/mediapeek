import { AnimatePresence, motion } from "motion/react"
import { memo } from "react"

import { Badge } from "~/components/ui/badge"
import type { SubtitleTrackReport } from "~/features/reports/media-report"

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

  let displayFormat = track.codecInfo ?? track.formatInfo ?? track.formatName

  if (!displayFormat && track.codecId && track.formatName) {
    displayFormat = `${track.formatName} (${track.codecId})`
  } else if (!displayFormat && track.codecId) {
    displayFormat = track.codecId
  }

  const renderBadges = () => (
    <>
      {track.isDefault && (
        <Badge className="h-5 border border-emerald-500/20 bg-emerald-500/15 text-[10px] text-emerald-700 hover:bg-emerald-500/25 dark:bg-emerald-500/20 dark:text-emerald-400">
          Default
        </Badge>
      )}
      {track.isForced && (
        <Badge className="h-5 border border-amber-500/20 bg-amber-500/15 text-[10px] text-amber-700 hover:bg-amber-500/25 dark:bg-amber-500/20 dark:text-amber-400">
          Forced
        </Badge>
      )}
    </>
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
          <AnimatePresence mode="popLayout">
            {showTitle && (
              <motion.span
                key={displayTitle}
                initial={{ opacity: 0, filter: "blur(4px)" }}
                animate={{ opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, filter: "blur(4px)" }}
                transition={{ duration: 0.2 }}
                className="text-muted-foreground text-xs"
              >
                {displayTitle}
              </motion.span>
            )}
          </AnimatePresence>

          {/* Line 3: Format */}
          <span className="text-muted-foreground/70 text-xs tracking-wide">
            {displayFormat}
          </span>
        </div>
      </div>
      <div className="flex gap-1.5 self-center">{renderBadges()}</div>
    </motion.div>
  )
})
