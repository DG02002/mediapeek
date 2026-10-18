import { Link } from "@tanstack/react-router"

import { ModeToggle } from "~/features/settings/mode-toggle"
import { cn } from "~/lib/utils"

interface HeaderProps {
  className?: string
  sticky?: boolean
}

export function Header({ className, sticky = true }: HeaderProps) {
  return (
    <header
      className={cn(
        "bg-background/95 supports-backdrop-filter:bg-background/80 z-50 border-b backdrop-blur-md",
        sticky && "sticky top-0",
        className
      )}
    >
      <div className="flex h-14 w-full items-center gap-3 px-6 md:h-16 md:px-8 lg:px-10 xl:px-14">
        <Link
          to="/"
          viewTransition
          className="flex min-w-0 items-center gap-3 no-underline"
        >
          <div className="relative h-10 w-10 shrink-0">
            <img
              src="/badges/icon-light.webp"
              alt="MediaPeek Logo"
              className="hidden h-full w-full object-contain dark:block"
            />
            <img
              src="/badges/icon-dark.webp"
              alt="MediaPeek Logo"
              className="h-full w-full object-contain dark:hidden"
            />
          </div>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold tracking-tight">
              MediaPeek
            </p>
          </div>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
