import { flushSync } from "react-dom"

import { useTheme, type Theme } from "~/components/theme-provider"
import { useHydrated } from "~/hooks/use-hydrated"
import { cn } from "~/lib/utils"

export function ModeToggle() {
  const { theme, setTheme } = useTheme()
  const isHydrated = useHydrated()
  const visibleTheme = isHydrated ? theme : undefined

  const switchTheme = (newTheme: Theme) => {
    if (!("startViewTransition" in document)) {
      setTheme(newTheme)

      return
    }

    document.startViewTransition(() => {
      flushSync(() => {
        setTheme(newTheme)
      })
    })
  }

  return (
    <div className="border-input flex h-6 items-center rounded-lg border p-0.5 sm:h-7">
      <button
        type="button"
        aria-pressed={visibleTheme === "light"}
        onClick={() => {
          switchTheme("light")
        }}
        className={cn(
          "min-w-[2.8rem] rounded-md px-1 py-0.5 text-[10px] font-medium transition-all sm:min-w-12 sm:px-2 sm:text-xs",
          visibleTheme === "light"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Light
      </button>
      <button
        type="button"
        aria-pressed={visibleTheme === "dark"}
        onClick={() => {
          switchTheme("dark")
        }}
        className={cn(
          "min-w-[2.8rem] rounded-md px-1 py-0.5 text-[10px] font-medium transition-all sm:min-w-12 sm:px-2 sm:text-xs",
          visibleTheme === "dark"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Dark
      </button>
      <button
        type="button"
        aria-pressed={visibleTheme === "system"}
        onClick={() => {
          switchTheme("system")
        }}
        className={cn(
          "min-w-[2.8rem] rounded-md px-1 py-0.5 text-[10px] font-medium transition-all sm:min-w-12 sm:px-2 sm:text-xs",
          visibleTheme === "system"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Auto
      </button>
    </div>
  )
}
