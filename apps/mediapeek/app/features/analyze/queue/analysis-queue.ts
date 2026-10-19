import type {
  AnalysisProgress,
  AnalysisResult,
  AnalysisSession,
  AnalysisSessionSnapshot,
} from "../analysis-session"

type AnalysisQueueItemStatus = "queued" | "analyzing" | "done" | "error"

export interface AnalysisQueueItem {
  readonly id: string
  readonly url: string
  readonly status: AnalysisQueueItemStatus
  readonly progress?: AnalysisProgress
  readonly analysis?: AnalysisResult
  readonly message?: string
}

type AnalysisQueueResult =
  | { readonly kind: "queued"; readonly itemId: string; readonly url: string }
  | {
      readonly kind: "done"
      readonly itemId: string
      readonly analysis: AnalysisResult
    }
  | {
      readonly kind: "duplicate"
      readonly itemId: string
      readonly url: string
    }
  | { readonly kind: "error"; readonly url?: string; readonly message: string }

export interface AnalysisQueueSnapshot {
  readonly items: ReadonlyArray<AnalysisQueueItem>
  readonly activeItemId: string | null
}

export interface AnalysisQueue {
  getSnapshot: () => AnalysisQueueSnapshot
  subscribe: (listener: () => void) => () => void
  add(
    rawUrls: string,
    turnstileToken?: string,
    requestTurnstileToken?: () => Promise<string | null>
  ): ReadonlyArray<AnalysisQueueResult>
  retry(
    itemId: string,
    turnstileToken?: string,
    requestTurnstileToken?: () => Promise<string | null>
  ): AnalysisQueueResult
  remove(itemId: string): boolean
  activate(): void
  dispose(): void
}

const normalizeUrl = (value: string): string | undefined => {
  try {
    const parsed = new URL(value)

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return undefined
    }

    return parsed.href
  } catch {
    return undefined
  }
}

const errorMessage = (error: Error) => error.message
const noop = () => {}

const clearTurnstileAuthorization = (
  itemId: string,
  turnstileTokens: Map<string, string>,
  turnstileTokenRequests: Map<string, () => Promise<string | null>>
) => {
  turnstileTokens.delete(itemId)
  turnstileTokenRequests.delete(itemId)
}

interface PreparedQueueEntry {
  readonly item?: AnalysisQueueItem
  readonly result: AnalysisQueueResult
}

const prepareQueueEntry = (
  url: string,
  items: ReadonlyArray<AnalysisQueueItem>,
  createId: () => string
): PreparedQueueEntry => {
  const normalizedUrl = normalizeUrl(url)

  if (!normalizedUrl) {
    return {
      result: { kind: "error", url, message: "Enter a valid media URL." },
    }
  }

  const existingItem = items.find(
    (item) => normalizeUrl(item.url) === normalizedUrl
  )

  if (existingItem) {
    return {
      result: { kind: "duplicate", itemId: existingItem.id, url },
    }
  }

  const itemId = createId()
  const item: AnalysisQueueItem = { id: itemId, url, status: "queued" }

  return {
    item,
    result: { kind: "queued", itemId, url },
  }
}

export const createAnalysisQueue = (
  session: AnalysisSession,
  createId: () => string = () => crypto.randomUUID()
): AnalysisQueue => {
  let snapshot: AnalysisQueueSnapshot = { items: [], activeItemId: null }
  let isProcessing = false
  let isDisposed = false
  let isConnected = false
  const listeners = new Set<() => void>()
  const canceledItems = new Set<string>()
  const turnstileTokens = new Map<string, string>()
  const turnstileTokenRequests = new Map<string, () => Promise<string | null>>()

  const storeTurnstileAuthorization = (input: {
    readonly itemId: string
    readonly turnstileToken?: string
    readonly requestTurnstileToken?: () => Promise<string | null>
    readonly assignToken: boolean
  }) => {
    if (input.assignToken && input.turnstileToken) {
      turnstileTokens.set(input.itemId, input.turnstileToken)
    }

    if (input.requestTurnstileToken) {
      turnstileTokenRequests.set(input.itemId, input.requestTurnstileToken)
    }

    return input.assignToken && Boolean(input.turnstileToken)
  }

  const publish = (next: AnalysisQueueSnapshot) => {
    if (isDisposed) {
      return
    }

    snapshot = next

    for (const listener of listeners) {
      listener()
    }
  }

  const updateItem = (
    itemId: string,
    update: (item: AnalysisQueueItem) => AnalysisQueueItem
  ) => {
    const items = snapshot.items.map((item) =>
      item.id === itemId ? update(item) : item
    )

    publish({ ...snapshot, items })
  }

  const handleSessionChange = () => {
    const { activeItemId } = snapshot

    if (!activeItemId) {
      return
    }

    const sessionSnapshot: AnalysisSessionSnapshot = session.getSnapshot()

    if (sessionSnapshot.phase === "analyzing" && sessionSnapshot.progress) {
      updateItem(activeItemId, (item) => ({
        ...item,
        progress: sessionSnapshot.progress,
      }))
    }
  }

  let unsubscribeSession = noop

  const runNext = async (): Promise<AnalysisQueueResult | undefined> => {
    const item = snapshot.items.find(
      (candidate) => candidate.status === "queued"
    )

    if (!item || isDisposed) {
      return undefined
    }

    publish({ ...snapshot, activeItemId: item.id })
    updateItem(item.id, (current) => ({
      ...current,
      status: "analyzing",
      progress: undefined,
      message: undefined,
    }))

    try {
      const analysis = await session.analyze(
        item.url,
        turnstileTokens.get(item.id),
        turnstileTokenRequests.get(item.id)
      )

      clearTurnstileAuthorization(
        item.id,
        turnstileTokens,
        turnstileTokenRequests
      )

      if (canceledItems.delete(item.id)) {
        return undefined
      }

      updateItem(item.id, (current) => ({
        ...current,
        status: "done",
        analysis,
        progress: undefined,
      }))

      return { kind: "done", itemId: item.id, analysis }
    } catch (error) {
      clearTurnstileAuthorization(
        item.id,
        turnstileTokens,
        turnstileTokenRequests
      )

      if (canceledItems.delete(item.id)) {
        return undefined
      }

      const failure =
        error instanceof Error ? error : new Error("Analysis failed.")

      const message = errorMessage(failure)
      updateItem(item.id, (current) => ({
        ...current,
        status: "error",
        progress: undefined,
        message,
      }))

      return { kind: "error", url: item.url, message }
    } finally {
      publish({ ...snapshot, activeItemId: null })
    }
  }

  const processQueue = async () => {
    if (isProcessing || isDisposed) {
      return
    }

    isProcessing = true

    try {
      await processNext()
    } finally {
      isProcessing = false

      if (
        !isDisposed &&
        snapshot.items.some((item) => item.status === "queued")
      ) {
        void processQueue()
      }
    }
  }

  const processNext = async (): Promise<void> => {
    if (isDisposed) {
      return
    }

    const result = await runNext()

    if (result) {
      await processNext()
    }
  }

  const add = (
    rawUrls: string,
    turnstileToken?: string,
    requestTurnstileToken?: () => Promise<string | null>
  ) => {
    const urls = rawUrls
      .split(/\r?\n/u)
      .map((url) => url.trim())
      .filter(Boolean)

    if (urls.length === 0) {
      const emptyInput: AnalysisQueueResult = {
        kind: "error",
        message: "Enter a media URL.",
      }

      return [emptyInput]
    }

    const items = [...snapshot.items]
    const results: AnalysisQueueResult[] = []
    let tokenAssigned = false

    for (const url of urls) {
      const entry = prepareQueueEntry(url, items, createId)
      results.push(entry.result)

      if (!entry.item) {
        continue
      }

      items.push(entry.item)

      tokenAssigned =
        storeTurnstileAuthorization({
          itemId: entry.item.id,
          turnstileToken,
          requestTurnstileToken,
          assignToken: !tokenAssigned,
        }) || tokenAssigned
    }

    if (items.length !== snapshot.items.length) {
      publish({ ...snapshot, items })
      void processQueue()
    }

    return results
  }

  const retry = (
    itemId: string,
    turnstileToken?: string,
    requestTurnstileToken?: () => Promise<string | null>
  ) => {
    const item = snapshot.items.find((candidate) => candidate.id === itemId)

    if (!item || item.status !== "error") {
      const unavailable: AnalysisQueueResult = {
        kind: "error",
        message: "This analysis cannot be retried.",
      }

      return unavailable
    }

    const items: AnalysisQueueItem[] = snapshot.items.map((candidate) =>
      candidate.id === itemId
        ? { id: candidate.id, url: candidate.url, status: "queued" }
        : candidate
    )

    if (turnstileToken) {
      turnstileTokens.set(itemId, turnstileToken)
    }

    if (requestTurnstileToken) {
      turnstileTokenRequests.set(itemId, requestTurnstileToken)
    }

    publish({ ...snapshot, items })
    void processQueue()

    const queuedResult: AnalysisQueueResult = {
      kind: "queued",
      itemId,
      url: item.url,
    }

    return queuedResult
  }

  const remove = (itemId: string) => {
    const item = snapshot.items.find((candidate) => candidate.id === itemId)

    if (!item) {
      return false
    }

    const isActive = snapshot.activeItemId === itemId
    turnstileTokens.delete(itemId)
    turnstileTokenRequests.delete(itemId)

    if (isActive) {
      canceledItems.add(itemId)
      session.cancel()
    }

    publish({
      ...snapshot,
      items: snapshot.items.filter((candidate) => candidate.id !== itemId),
    })

    return true
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener)

      return () => listeners.delete(listener)
    },
    add,
    retry,
    remove,
    activate() {
      if (isConnected) {
        return
      }

      isDisposed = false
      isConnected = true
      unsubscribeSession = session.subscribe(handleSessionChange)
    },
    dispose() {
      isDisposed = true
      isConnected = false
      unsubscribeSession()
      unsubscribeSession = noop

      session.cancel()
      listeners.clear()
      turnstileTokens.clear()
      turnstileTokenRequests.clear()
      canceledItems.clear()
    },
  }
}
