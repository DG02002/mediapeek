"use client"

import {
  AlertCircleIcon,
  ArrowRight02Icon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { Schema } from "effect"
import {
  type ClipboardEvent,
  type SyntheticEvent,
  useEffect,
  useRef,
  useState,
} from "react"

import { MediaSkeleton } from "~/components/media-skeleton"
import { MediaView } from "~/components/media-view"
import { TurnstileWidget } from "~/components/turnstile-widget"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import { Icon } from "~/components/ui/icon"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "~/components/ui/input-group"
import { ClipboardAccessIcon } from "~/features/analyze/clipboard-access-icon"
import { ClipboardPermissionDialog } from "~/features/analyze/clipboard-permission-dialog"
import {
  type AnalysisQueueItem,
  type AnalysisQueueItemStatus,
} from "~/features/analyze/queue/analysis-queue"
import {
  useAnalysisQueue,
  useAnalysisQueueFeedback,
} from "~/features/analyze/queue/use-analysis-queue"
import { useClipboardUrl } from "~/features/analyze/use-clipboard-url"
import { useTurnstileVerification } from "~/features/analyze/use-turnstile-verification"
import { SaveAnalysisButton } from "~/features/library/save-analysis-button"

const usePendingStatusVisibility = (isPending: boolean) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timeoutId = setTimeout(
      () => setIsVisible(isPending),
      isPending ? 5_000 : 0
    )

    return () => clearTimeout(timeoutId)
  }, [isPending])

  return isVisible
}

const getFormString = (formData: FormData, name: string) => {
  const value = formData.get(name)

  return Schema.is(Schema.String)(value) ? value : null
}

const statusLabels: Record<AnalysisQueueItemStatus, string> = {
  queued: "Queued",
  analyzing: "Analyzing",
  done: "Done",
  error: "Failed",
}

const getSelectedItem = (
  items: ReadonlyArray<AnalysisQueueItem>,
  selectedItemId: string | null
) => {
  const selectedItem = items.find((item) => item.id === selectedItemId)

  if (selectedItem) {
    return selectedItem
  }

  let latestDoneItem: AnalysisQueueItem | undefined

  for (const item of items) {
    if (item.status === "done") {
      latestDoneItem = item
    }
  }

  return latestDoneItem
}

export function MediaForm() {
  const { queue, snapshot: queueSnapshot } = useAnalysisQueue()
  useAnalysisQueueFeedback(queueSnapshot)

  const [formError, setFormError] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState("")
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [isClipboardDialogOpen, setIsClipboardDialogOpen] = useState(false)

  const pendingUrlsRef = useRef<string | null>(null)
  const pendingRetryItemIdRef = useRef<string | null>(null)

  const {
    enabled: turnstileEnabled,
    inputRef: turnstileInputRef,
    widgetRef: turnstileWidgetRef,
    isOpen: isTurnstileDialogOpen,
    setIsOpen: setIsTurnstileDialogOpen,
    settle: settleTurnstileTokenRequest,
    requestToken: requestTurnstileToken,
  } = useTurnstileVerification()

  const selectedItem = getSelectedItem(queueSnapshot.items, selectedItemId)

  const selectedAnalysis =
    selectedItem?.status === "done" ? selectedItem.analysis : undefined

  const isPending = queueSnapshot.activeItemId !== null
  const shouldShowPendingStatus = usePendingStatusVisibility(isPending)

  const {
    clipboardUrl,
    clipboardPermission,
    ignoreClipboard,
    checkClipboard,
    isClipboardApiSupported,
    requestClipboardAccess,
  } = useClipboardUrl(selectedAnalysis?.url)

  const enqueueUrls = (rawUrls: string, turnstileToken?: string) => {
    const outcomes = queue.add(rawUrls, turnstileToken)
    const queuedOutcome = outcomes.find((outcome) => outcome.kind === "queued")

    const duplicateOutcome = outcomes.find(
      (outcome) => outcome.kind === "duplicate"
    )

    const invalidOutcome = outcomes.find((outcome) => outcome.kind === "error")

    if (queuedOutcome?.kind === "queued") {
      setSelectedItemId(queuedOutcome.itemId)
      setInputValue("")
    } else if (duplicateOutcome?.kind === "duplicate") {
      setSelectedItemId(duplicateOutcome.itemId)
    }

    if (invalidOutcome?.kind === "error") {
      setFormError(invalidOutcome.message)
    } else if (duplicateOutcome?.kind === "duplicate" && !queuedOutcome) {
      setFormError("That URL is already in the queue.")
    } else {
      setFormError(null)
    }
  }

  const submitUrls = (rawUrls: string) => {
    if (!rawUrls.trim()) {
      setFormError("Enter a media URL.")

      return
    }

    const turnstileToken = turnstileEnabled
      ? (turnstileInputRef.current?.value.trim() ?? "")
      : ""

    if (turnstileEnabled && !turnstileToken) {
      pendingUrlsRef.current = rawUrls
      setFormError(null)
      void requestTurnstileToken()

      return
    }

    enqueueUrls(rawUrls, turnstileToken || undefined)
  }

  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    submitUrls(getFormString(new FormData(event.currentTarget), "url") ?? "")
  }

  const handleInputPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text/plain")

    if (!text.includes("\n")) {
      return
    }

    event.preventDefault()
    submitUrls(text)
  }

  const handleRetry = (itemId: string) => {
    if (turnstileEnabled) {
      pendingRetryItemIdRef.current = itemId
      setFormError(null)
      void requestTurnstileToken()

      return
    }

    const outcome = queue.retry(itemId)

    if (outcome.kind === "queued") {
      setSelectedItemId(itemId)
    } else if (outcome.kind === "error") {
      setFormError(outcome.message)
    }
  }

  return (
    <div className="mb-8 flex w-full flex-col">
      <div className="relative w-full">
        <div className="relative z-10 space-y-8">
          <form
            onSubmit={onSubmit}
            className="relative flex flex-col gap-4"
            noValidate
          >
            <div
              inert={!clipboardUrl}
              className={`grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none ${clipboardUrl ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
            >
              <div className="min-h-0 overflow-hidden">
                {clipboardUrl ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault()
                      const url = clipboardUrl

                      ignoreClipboard()
                      submitUrls(url)
                    }}
                    className="group w-full cursor-pointer rounded-md px-1 py-2 text-left"
                  >
                    <span className="shimmer shimmer-color-blue-500/60 shimmer-duration-900 shimmer-spread-24 block max-w-full truncate text-base font-normal text-primary">
                      {clipboardUrl}
                    </span>
                  </button>
                ) : null}
              </div>
            </div>

            {formError && (
              <div className="mb-4 translate-y-0 opacity-100 transition-[opacity,transform] duration-200 starting:-translate-y-2 starting:opacity-0">
                <Alert id="media-url-error" variant="destructive">
                  <Icon icon={AlertCircleIcon} size={16} />
                  <AlertTitle>Queue update</AlertTitle>
                  <AlertDescription>{formError}</AlertDescription>
                </Alert>
              </div>
            )}

            <label htmlFor="media-url" className="sr-only">
              Media URL
            </label>
            <InputGroup className="h-13.5 w-full rounded-full border-2 border-border bg-muted/30 sm:flex-1 has-[[data-slot=input-group-control]:focus-visible]:border-2 has-[[data-slot=input-group-control]:focus-visible]:border-blue-500 has-[[data-slot=input-group-control]:focus-visible]:ring-0">
              <InputGroupInput
                id="media-url"
                name="url"
                placeholder="https://example.com/video"
                autoComplete="off"
                inputMode="url"
                enterKeyHint="done"
                value={inputValue}
                onChange={(event) => setInputValue(event.currentTarget.value)}
                onFocus={() => {
                  if (isClipboardApiSupported) {
                    void checkClipboard()
                  }
                }}
                onPaste={handleInputPaste}
                aria-describedby={formError ? "media-url-error" : undefined}
                aria-invalid={Boolean(formError)}
                className="pl-5 text-base text-foreground md:text-base"
              />
              <InputGroupAddon align="inline-end">
                {(clipboardPermission === "prompt" ||
                  clipboardPermission === "denied") && (
                  <InputGroupButton
                    type="button"
                    onClick={() => setIsClipboardDialogOpen(true)}
                    title="Enable clipboard suggestions"
                    aria-label="Enable clipboard suggestions"
                    className="size-11 rounded-full bg-transparent hover:bg-transparent hover:text-inherit active:scale-[0.96] dark:hover:bg-transparent"
                  >
                    <ClipboardAccessIcon className="size-6" />
                  </InputGroupButton>
                )}
                <InputGroupButton
                  type="submit"
                  size="icon-xs"
                  variant="default"
                  disabled={!inputValue.trim()}
                  title="Add to queue"
                  aria-label="Add to queue"
                  className="size-11 rounded-full"
                >
                  <Icon
                    icon={ArrowRight02Icon}
                    strokeWidth={2}
                    className="size-6"
                  />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <ClipboardPermissionDialog
              clipboardPermission={clipboardPermission}
              open={isClipboardDialogOpen}
              onAllow={requestClipboardAccess}
              onOpenChange={setIsClipboardDialogOpen}
            />
            {turnstileEnabled ? (
              <input
                type="hidden"
                name="cf-turnstile-response"
                id="cf-turnstile-response"
                ref={turnstileInputRef}
              />
            ) : null}

            {turnstileEnabled && (
              <Dialog
                open={isTurnstileDialogOpen}
                onOpenChange={(open) => {
                  setIsTurnstileDialogOpen(open)

                  if (open) {
                    return
                  }

                  const hadPendingAction =
                    pendingUrlsRef.current !== null ||
                    pendingRetryItemIdRef.current !== null

                  pendingUrlsRef.current = null
                  pendingRetryItemIdRef.current = null
                  settleTurnstileTokenRequest(null)

                  if (hadPendingAction) {
                    setFormError(
                      "Verification was canceled. Complete the security check to continue."
                    )
                  }
                }}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Verify Before Analysis</DialogTitle>
                    <DialogDescription>
                      Complete the security check to continue.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex min-h-[65px] justify-center">
                    <TurnstileWidget
                      ref={turnstileWidgetRef}
                      onVerify={(token) => {
                        if (turnstileInputRef.current) {
                          turnstileInputRef.current.value = token
                        }

                        const pendingUrls = pendingUrlsRef.current

                        const pendingRetryItemId = pendingRetryItemIdRef.current

                        pendingUrlsRef.current = null
                        pendingRetryItemIdRef.current = null
                        settleTurnstileTokenRequest(token)
                        setIsTurnstileDialogOpen(false)

                        if (pendingUrls) {
                          enqueueUrls(pendingUrls, token)
                        } else if (pendingRetryItemId) {
                          const outcome = queue.retry(pendingRetryItemId, token)

                          if (outcome.kind === "queued") {
                            setSelectedItemId(pendingRetryItemId)
                          }
                        }
                      }}
                      onError={() => {
                        if (turnstileInputRef.current) {
                          turnstileInputRef.current.value = ""
                        }

                        pendingUrlsRef.current = null
                        pendingRetryItemIdRef.current = null
                        settleTurnstileTokenRequest(null)
                        setIsTurnstileDialogOpen(false)
                        setFormError(
                          "Security check failed. Refresh the page and try again."
                        )
                      }}
                      onExpire={() => {
                        if (turnstileInputRef.current) {
                          turnstileInputRef.current.value = ""
                        }
                      }}
                    />
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </form>

          {queueSnapshot.items.length > 0 && (
            <section
              aria-labelledby="analysis-queue-title"
              className="space-y-3"
            >
              <h2 id="analysis-queue-title" className="text-lg font-semibold">
                Analysis queue
              </h2>
              <ol className="space-y-2">
                {queueSnapshot.items.map((item) => (
                  <li
                    key={item.id}
                    className="bg-card flex items-start gap-3 rounded-xl border p-3"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedItemId(item.id)}
                      aria-pressed={selectedItem?.id === item.id}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">
                          {statusLabels[item.status]}
                        </span>
                        {item.status === "analyzing" && (
                          <Icon
                            icon={Loading03Icon}
                            size={14}
                            className="animate-spin"
                          />
                        )}
                      </span>
                      <span className="text-muted-foreground mt-1 block break-all text-sm">
                        {item.url}
                      </span>
                      {item.progress && (
                        <span className="text-muted-foreground mt-2 block text-sm">
                          <span className="font-medium">
                            {item.progress.title}
                          </span>
                          {" — "}
                          {item.progress.message}
                        </span>
                      )}
                      {item.message && (
                        <span className="text-destructive mt-2 block text-sm">
                          {item.message}
                        </span>
                      )}
                    </button>
                    {item.status === "error" && (
                      <button
                        type="button"
                        onClick={() => handleRetry(item.id)}
                        className="text-sm font-medium underline underline-offset-4"
                      >
                        Retry
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => queue.remove(item.id)}
                      aria-label={`${item.status === "analyzing" ? "Cancel" : "Remove"} ${item.url}`}
                      className="text-muted-foreground hover:text-foreground px-2 py-1 text-sm"
                    >
                      {item.status === "analyzing" ? "Cancel" : "Remove"}
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>

      {isPending && shouldShowPendingStatus && (
        <div className="mb-4 mt-6 w-full">
          <Alert>
            <Icon icon={Loading03Icon} size={16} className="animate-spin" />
            <AlertTitle>
              {queueSnapshot.items.find(
                (item) => item.id === queueSnapshot.activeItemId
              )?.progress?.title ?? "Submitting Request"}
            </AlertTitle>
            <AlertDescription>
              {queueSnapshot.items.find(
                (item) => item.id === queueSnapshot.activeItemId
              )?.progress?.message ?? "Sending the analysis request."}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {isPending && !selectedAnalysis && <MediaSkeleton />}

      {selectedAnalysis?.outputs.json && (
        <div className="mt-6 w-full">
          <div className="animate-in fade-in slide-in-from-bottom-4 ease-smooth duration-300">
            <SaveAnalysisButton
              analysis={selectedAnalysis}
              requestTurnstileToken={requestTurnstileToken}
            />
            <MediaView
              data={selectedAnalysis.outputs}
              url={selectedAnalysis.url}
              requestTurnstileToken={requestTurnstileToken}
            />
          </div>
        </div>
      )}
    </div>
  )
}
