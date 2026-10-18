import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import type {
  StoredReportsSnapshot,
  StoredReportsStore,
} from "./report-storage"
import { useStoredReports } from "./use-stored-reports"

interface TestStoredReportsStore extends StoredReportsStore {
  publish: (snapshot: StoredReportsSnapshot) => void
}

const createTestStore = (): TestStoredReportsStore => {
  let snapshot: StoredReportsSnapshot = {
    reports: [],
    isLoading: true,
    error: null,
  }

  const listeners = new Set<() => void>()

  return {
    getServerSnapshot: () => snapshot,
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)

      return () => listeners.delete(listener)
    },
    list: vi.fn(async () => undefined),
    save: vi.fn(async (report) => ({ ...report, id: "saved-report" })),
    delete: vi.fn(async () => undefined),
    publish: (nextSnapshot) => {
      snapshot = nextSnapshot

      for (const listener of listeners) {
        listener()
      }
    },
  }
}

describe("useStoredReports", () => {
  it("loads and subscribes through the reports store interface", () => {
    const store = createTestStore()
    const { result } = renderHook(() => useStoredReports(true, store))

    expect(store.list).toHaveBeenCalledOnce()
    expect(result.current).toMatchObject({ isLoading: true })

    act(() => {
      store.publish({
        reports: [
          {
            id: "saved-report",
            sourceUrl: "https://example.com/movie.mkv",
            filename: "movie.mkv",
            analyzedAt: "2026-10-18T00:00:00.000Z",
            outputs: { json: "{}" },
          },
        ],
        isLoading: false,
        error: null,
      })
    })

    expect(result.current.reports).toHaveLength(1)
    expect(result.current.reports[0]?.filename).toBe("movie.mkv")
  })

  it("waits for hydration before listing reports", () => {
    const store = createTestStore()

    const { rerender } = renderHook(
      ({ isHydrated }) => useStoredReports(isHydrated, store),
      { initialProps: { isHydrated: false } }
    )

    expect(store.list).not.toHaveBeenCalled()

    rerender({ isHydrated: true })

    expect(store.list).toHaveBeenCalledOnce()
  })
})
