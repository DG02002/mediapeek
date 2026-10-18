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
  readonly children: ReactNode
  readonly defaultTheme?: Theme
  readonly storageKey?: string
}

interface ThemeProviderState {
  readonly theme: Theme
  readonly setTheme: (theme: Theme) => void
}

const THEME_CHANGE_EVENT = "mediapeek-theme-change"

const getThemeScript = (storageKey: string, defaultTheme: Theme) => {
  const key = JSON.stringify(storageKey)
  const fallback = JSON.stringify(defaultTheme)

  return `(function(){try{var t=localStorage.getItem(${key});if(t!=='light'&&t!=='dark'&&t!=='system'){t=${fallback}}var d=matchMedia('(prefers-color-scheme: dark)').matches;var r=t==='system'?(d?'dark':'light'):t;var e=document.documentElement;e.classList.add(r);e.style.colorScheme=r}catch(e){}})();`
}

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(
  undefined
)

const readStoredTheme = (storageKey: string, defaultTheme: Theme) => {
  const stored = localStorage.getItem(storageKey)

  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : defaultTheme
}

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
  const subscribe = useCallback((onStoreChange: () => void) => {
    window.addEventListener(THEME_CHANGE_EVENT, onStoreChange)

    return () => window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange)
  }, [])

  const getSnapshot = useCallback(
    () => readStoredTheme(storageKey, defaultTheme),
    [defaultTheme, storageKey]
  )

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

    if (theme !== "system") {
      return undefined
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = () => applyTheme("system")
    media.addEventListener("change", onChange)

    return () => media.removeEventListener("change", onChange)
  }, [theme])

  const value = useMemo(() => ({ theme, setTheme }), [setTheme, theme])

  return (
    <ThemeProviderContext value={value}>
      <ScriptOnce>{getThemeScript(storageKey, defaultTheme)}</ScriptOnce>
      {children}
    </ThemeProviderContext>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }

  return context
}
