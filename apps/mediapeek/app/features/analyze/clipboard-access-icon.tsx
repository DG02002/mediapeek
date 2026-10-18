import { AiContentGenerator01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { cn } from "~/lib/utils"

export function ClipboardAccessIcon({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative inline-flex text-primary/25", className)}
    >
      <HugeiconsIcon
        icon={AiContentGenerator01Icon}
        strokeWidth={1.5}
        className="size-full"
      />
      <span className="clipboard-icon-shimmer absolute inset-0 text-blue-500">
        <HugeiconsIcon
          icon={AiContentGenerator01Icon}
          strokeWidth={1.5}
          className="size-full"
        />
      </span>
    </span>
  )
}
