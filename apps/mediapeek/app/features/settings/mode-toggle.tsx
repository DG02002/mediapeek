import { flushSync } from "react-dom"
import { Theme, useTheme } from "remix-themes"

import { useHydrated } from "~/hooks/use-hydrated"
import { cn } from "~/lib/utils"

export function ModeToggle() {
  const [themeState, setTheme] = useTheme()
  const isHydrated = useHydrated()
  const visibleTheme = isHydrated ? themeState : undefined

  const switchTheme = (newTheme: Theme | null) => {
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
        aria-pressed={visibleTheme === Theme.LIGHT}
        onClick={() => {
          switchTheme(Theme.LIGHT)
        }}
        className={cn(
          "min-w-[2.8rem] rounded-md px-1 py-0.5 text-[10px] font-medium transition-all sm:min-w-12 sm:px-2 sm:text-xs",
          visibleTheme === Theme.LIGHT
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Light
      </button>
      <button
        type="button"
        aria-pressed={visibleTheme === Theme.DARK}
        onClick={() => {
          switchTheme(Theme.DARK)
        }}
        className={cn(
          "min-w-[2.8rem] rounded-md px-1 py-0.5 text-[10px] font-medium transition-all sm:min-w-12 sm:px-2 sm:text-xs",
          visibleTheme === Theme.DARK
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Dark
      </button>
      <button
        type="button"
        aria-pressed={visibleTheme === null}
        onClick={() => {
          switchTheme(null)
        }}
        className={cn(
          "min-w-[2.8rem] rounded-md px-1 py-0.5 text-[10px] font-medium transition-all sm:min-w-12 sm:px-2 sm:text-xs",
          visibleTheme === null
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        Auto
      </button>
    </div>
  )
}
