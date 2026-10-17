import { ClipboardIcon } from "@hugeicons/core-free-icons"

import { Icon } from "~/components/ui/icon"
import { cn } from "~/lib/utils"

export function ClipboardAccessIcon({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("relative inline-flex text-muted-foreground/40", className)}
    >
      <Icon icon={ClipboardIcon} size={20} className="size-full" />
      <span className="clipboard-icon-shimmer absolute inset-0 text-blue-500">
        <Icon icon={ClipboardIcon} size={20} className="size-full" />
      </span>
    </span>
  )
}
