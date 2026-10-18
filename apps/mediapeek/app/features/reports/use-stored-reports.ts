import { useEffect, useSyncExternalStore } from "react"

import { reportStorageStore, type StoredReportsStore } from "./report-storage"

export const useStoredReports = (
  isHydrated: boolean,
  store: StoredReportsStore = reportStorageStore
) => {
  useEffect(() => {
    if (isHydrated) {
      void store.list()
    }
  }, [isHydrated, store])

  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  )

  return snapshot
}
