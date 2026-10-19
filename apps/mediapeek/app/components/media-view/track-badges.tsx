import { memo } from "react"

import { Badge } from "~/components/ui/badge"
import { cn } from "~/lib/utils"

interface TrackBadgesProps {
  isDefault: boolean
  isForced: boolean
  className?: string
}

export const TrackBadges = memo(function TrackBadges({
  isDefault,
  isForced,
  className,
}: TrackBadgesProps) {
  return (
    <>
      {isDefault && (
        <Badge
          className={cn(
            "border border-emerald-500/20 bg-emerald-500/15 text-[10px] text-emerald-700 hover:bg-emerald-500/25 dark:bg-emerald-500/20 dark:text-emerald-400",
            className
          )}
        >
          Default
        </Badge>
      )}
      {isForced && (
        <Badge
          className={cn(
            "border border-amber-500/20 bg-amber-500/15 text-[10px] text-amber-700 hover:bg-amber-500/25 dark:bg-amber-500/20 dark:text-amber-400",
            className
          )}
        >
          Forced
        </Badge>
      )}
    </>
  )
})
