import { AnimatePresence, motion } from "motion/react"
import { memo } from "react"

interface TrackTitleProps {
  title?: string
  className?: string
}

export const TrackTitle = memo(function TrackTitle({
  title,
  className,
}: TrackTitleProps) {
  return (
    <AnimatePresence mode="popLayout">
      {title && (
        <motion.span
          key={title}
          initial={{ opacity: 0, filter: "blur(4px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(4px)" }}
          transition={{ duration: 0.2 }}
          className={className}
        >
          {title}
        </motion.span>
      )}
    </AnimatePresence>
  )
})
