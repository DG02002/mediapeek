import { useCallback, useSyncExternalStore } from "react"

const getServerSnapshot = () => false

export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mediaQuery = window.matchMedia(query)
      mediaQuery.addEventListener("change", onChange)

      return () => mediaQuery.removeEventListener("change", onChange)
    },
    [query]
  )

  const getSnapshot = useCallback(
    () => window.matchMedia(query).matches,
    [query]
  )

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
