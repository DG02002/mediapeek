import { useEffect, useMemo, useSyncExternalStore } from "react"

import { listReports, type StoredReport } from "./report-storage"

interface StoredReportsSnapshot {
  readonly reports: ReadonlyArray<StoredReport>
  readonly isLoading: boolean
  readonly error: string | null
}

export interface StoredReportsStore {
  getSnapshot: () => StoredReportsSnapshot
  subscribe: (listener: () => void) => () => void
  refresh: () => Promise<void>
}

const SERVER_SNAPSHOT: StoredReportsSnapshot = {
  reports: [],
  isLoading: true,
  error: null,
}

const toMessage = (error: Error) => error.message

const createStoredReportsStore = (): StoredReportsStore => {
  let snapshot = SERVER_SNAPSHOT
  const listeners = new Set<() => void>()

  const publish = (nextSnapshot: StoredReportsSnapshot) => {
    snapshot = nextSnapshot

    for (const listener of listeners) {
      listener()
    }
  }

  const refresh = async () => {
    publish({ ...snapshot, isLoading: true, error: null })

    try {
      const reports = await listReports()
      publish({ reports, isLoading: false, error: null })
    } catch (cause) {
      const failure =
        cause instanceof Error
          ? cause
          : new Error("Unable to read saved reports.")

      publish({ ...snapshot, isLoading: false, error: toMessage(failure) })
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)

      return () => listeners.delete(listener)
    },
    refresh,
  }
}

export const useStoredReports = (isHydrated: boolean) => {
  const store = useMemo(() => createStoredReportsStore(), [])

  useEffect(() => {
    if (isHydrated) {
      void store.refresh()
    }
  }, [isHydrated, store])

  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => SERVER_SNAPSHOT
  )

  return { store, snapshot }
}
