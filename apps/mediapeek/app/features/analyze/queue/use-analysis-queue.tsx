import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react"

import { TurnstileTokenDialog } from "~/features/analyze/turnstile-token-dialog"
import { useTurnstileVerification } from "~/features/analyze/use-turnstile-verification"
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

interface AnalysisQueueContextValue {
  readonly queue: ReturnType<typeof createAnalysisQueue>
  readonly snapshot: AnalysisQueueSnapshot
  readonly requestTurnstileToken: () => Promise<string | null>
}

const AnalysisQueueContext = createContext<AnalysisQueueContextValue | null>(
  null
)

const useAnalysisQueueFeedback = (snapshot: AnalysisQueueSnapshot) => {
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

export const AnalysisQueueProvider = ({
  children,
}: {
  readonly children: ReactNode
}) => {
  const turnstile = useTurnstileVerification()

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

  const contextValue = useMemo(
    () => ({ queue, snapshot, requestTurnstileToken: turnstile.requestToken }),
    [queue, snapshot, turnstile.requestToken]
  )

  useAnalysisQueueFeedback(snapshot)

  return (
    <AnalysisQueueContext.Provider value={contextValue}>
      {children}
      <TurnstileTokenDialog verification={turnstile} />
    </AnalysisQueueContext.Provider>
  )
}

export const useAnalysisQueue = () => {
  const context = useContext(AnalysisQueueContext)

  if (!context) {
    throw new Error("AnalysisQueueProvider is missing.")
  }

  return context
}
