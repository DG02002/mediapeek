"use client"

import {
  Delete02Icon,
  File01Icon,
  GitMergeIcon,
  MoreVerticalIcon,
} from "@hugeicons/core-free-icons"

import { buttonVariants } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { Icon } from "~/components/ui/icon"
import { cn } from "~/lib/utils"

import type { StoredReport } from "./report-storage"

interface ReportRowProps {
  report: StoredReport
  onOpen: () => void
  onCompare: () => void
  onDelete: () => void
}

export function ReportRow({
  report,
  onOpen,
  onCompare,
  onDelete,
}: ReportRowProps) {
  return (
    <li className="flex w-full items-stretch transition-colors hover:bg-muted">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex min-h-24 min-w-0 flex-1 items-center gap-3 px-4 py-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          "active:bg-muted/70"
        )}
      >
        <span className="flex size-10 shrink-0 items-center justify-center text-foreground md:size-14">
          <Icon icon={File01Icon} size={24} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="block truncate text-sm font-medium md:text-lg">
            {report.filename}
          </span>
          <span className="block min-w-0 truncate text-xs text-muted-foreground">
            {report.sourceUrl}
          </span>
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "my-auto me-2 shrink-0"
          )}
        >
          <Icon icon={MoreVerticalIcon} size={18} />
          <span className="sr-only">Actions for {report.filename}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={onCompare}>
            <Icon icon={GitMergeIcon} size={16} />
            Compare
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onDelete}
            className="text-destructive focus:text-destructive"
          >
            <Icon icon={Delete02Icon} size={16} />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  )
}
