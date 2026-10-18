import { ScriptOnce } from "@tanstack/react-router"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react"

export type Theme = "dark" | "light" | "system"

interface ThemeProviderProps {
  children: ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

interface ThemeProviderState {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const THEME_CHANGE_EVENT = "mediapeek-theme-change"

const getThemeScript = (storageKey: string, defaultTheme: Theme) => {
  const key = JSON.stringify(storageKey)
  const fallback = JSON.stringify(defaultTheme)

  return `(function(){try{var t=localStorage.getItem(${key});if(t!=='light'&&t!=='dark'&&t!=='system'){t=${fallback}}var r;if(t==='system'){r=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}else{r=t}var e=document.documentElement;e.classList.add(r);e.style.colorScheme=r}catch(e){}})();`
}

const ThemeProviderContext = createContext<ThemeProviderState | null>(null)

const applyTheme = (theme: Theme) => {
  const root = document.documentElement
  root.classList.remove("light", "dark")

  let resolved = theme

  if (theme === "system") {
    resolved = window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light"
  }

  root.classList.add(resolved)
  root.style.colorScheme = resolved
}

export const ThemeProvider = ({
  children,
  defaultTheme = "system",
  storageKey = "theme",
}: ThemeProviderProps) => {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const onStorage = (event: StorageEvent) => {
        if (event.key === storageKey) {
          onStoreChange()
        }
      }

      window.addEventListener("storage", onStorage)
      window.addEventListener(THEME_CHANGE_EVENT, onStoreChange)

      return () => {
        window.removeEventListener("storage", onStorage)
        window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange)
      }
    },
    [storageKey]
  )

  const getSnapshot = useCallback(() => {
    const stored = localStorage.getItem(storageKey)

    return stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : defaultTheme
  }, [defaultTheme, storageKey])

  const getServerSnapshot = useCallback(() => defaultTheme, [defaultTheme])
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setTheme = useCallback(
    (nextTheme: Theme) => {
      localStorage.setItem(storageKey, nextTheme)
      window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
    },
    [storageKey]
  )

  useEffect(() => {
    applyTheme(theme)

    const media = window.matchMedia("(prefers-color-scheme: dark)")

    const onChange = () => {
      if (theme === "system") {
        applyTheme(theme)
      }
    }

    media.addEventListener("change", onChange)

    return () => {
      media.removeEventListener("change", onChange)
    }
  }, [theme])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])

  return (
    <ThemeProviderContext value={value}>
      <ScriptOnce>{getThemeScript(storageKey, defaultTheme)}</ScriptOnce>
      {children}
    </ThemeProviderContext>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === null) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }

  return context
}
