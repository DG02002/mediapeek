import { memo } from "react"

import { cn } from "~/lib/utils"

interface SectionHeadingProps {
  title: string
  className?: string
  headingClassName?: string
}

export const SectionHeading = memo(function SectionHeading({
  title,
  className,
  headingClassName,
}: SectionHeadingProps) {
  return (
    <div className={cn("text-foreground flex items-center gap-2", className)}>
      <h2
        className={cn("text-xl font-semibold tracking-tight", headingClassName)}
      >
        {title}
      </h2>
    </div>
  )
})
