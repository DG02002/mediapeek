import { useEffect, useMemo, useRef, useSyncExternalStore } from "react"

import { useHapticFeedback } from "~/hooks/use-haptic"

import { createBrowserAnalysisSession } from "../analysis-session"
import {
  createAnalysisQueue,
  type AnalysisQueueSnapshot,
} from "./analysis-queue"

const EMPTY_QUEUE_SNAPSHOT: AnalysisQueueSnapshot = {
  items: [],
  activeItemId: null,
}

const getServerQueueSnapshot = () => EMPTY_QUEUE_SNAPSHOT

export const useAnalysisQueue = () => {
  const queue = useMemo(
    () => createAnalysisQueue(createBrowserAnalysisSession()),
    []
  )

  useEffect(() => {
    queue.activate()

    return () => queue.dispose()
  }, [queue])

  const snapshot = useSyncExternalStore(
    queue.subscribe,
    queue.getSnapshot,
    getServerQueueSnapshot
  )

  return { queue, snapshot }
}

export const useAnalysisQueueFeedback = (snapshot: AnalysisQueueSnapshot) => {
  const { triggerCreativeSuccess, triggerError } = useHapticFeedback()
  const previousStatuses = useRef(new Map<string, string>())

  useEffect(() => {
    for (const item of snapshot.items) {
      const previousStatus = previousStatuses.current.get(item.id)

      if (item.status === "done" && previousStatus !== "done") {
        triggerCreativeSuccess()
      } else if (item.status === "error" && previousStatus !== "error") {
        triggerError()
      }

      previousStatuses.current.set(item.id, item.status)
    }
  }, [snapshot, triggerCreativeSuccess, triggerError])
}
