"use client"

import {
  AlertCircleIcon,
  ArrowRight01Icon,
  ClipboardIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { Schema } from "effect"
import { type SyntheticEvent, useEffect, useRef, useState } from "react"

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
  InputGroupButton,
  InputGroupTextarea,
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
import { useHapticFeedback } from "~/hooks/use-haptic"

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

function AddToQueueButton() {
  return (
    <InputGroupButton type="submit" className="h-8 px-3">
      <Icon icon={ArrowRight01Icon} size={16} />
      <span>Add to queue</span>
    </InputGroupButton>
  )
}

function PasteButton({
  onPaste,
  readClipboard,
}: {
  onPaste: (text: string) => void
  readClipboard: () => Promise<string | null>
}) {
  const { triggerSuccess, triggerError } = useHapticFeedback()

  const handlePaste = async () => {
    const text = await readClipboard()

    if (text) {
      onPaste(text)
      triggerSuccess()
    } else {
      triggerError()
    }
  }

  return (
    <InputGroupButton
      type="button"
      onClick={() => void handlePaste()}
      title="Paste from clipboard"
      className="mr-1 h-8"
    >
      <Icon icon={ClipboardIcon} size={16} />
      <span className="sr-only">Paste</span>
    </InputGroupButton>
  )
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

  const pendingFormDataRef = useRef<FormData | null>(null)
  const pendingRetryItemIdRef = useRef<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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

  const activeItem = queueSnapshot.items.find(
    (item) => item.id === queueSnapshot.activeItemId
  )

  const {
    clipboardUrl,
    clipboardPermission,
    ignoreClipboard,
    checkClipboard,
    isClipboardApiSupported,
    pasteClipboardText,
    requestClipboardAccess,
  } = useClipboardUrl(selectedAnalysis?.url)

  const enqueueFormData = (formData: FormData, turnstileToken?: string) => {
    const rawUrls = getFormString(formData, "url") ?? ""
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

  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const rawUrls = getFormString(formData, "url") ?? ""

    if (!rawUrls.trim()) {
      setFormError("Enter a media URL.")

      return
    }

    const turnstileToken =
      getFormString(formData, "cf-turnstile-response")?.trim() ?? ""

    if (turnstileEnabled && !turnstileToken) {
      pendingFormDataRef.current = formData
      setFormError(null)
      void requestTurnstileToken()

      return
    }

    enqueueFormData(formData, turnstileToken || undefined)
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
    <div className="flex min-h-[50vh] w-full flex-col justify-center py-8">
      <div className="relative w-full sm:py-2">
        <div className="relative z-10 space-y-8">
          <form onSubmit={onSubmit} className="relative space-y-5" noValidate>
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
                      ignoreClipboard()
                      setInputValue(clipboardUrl)

                      if (inputRef.current) {
                        inputRef.current.value = clipboardUrl
                      }

                      event.currentTarget.closest("form")?.requestSubmit()
                    }}
                    className="hover:bg-muted/50 group flex max-w-full cursor-pointer flex-col items-start gap-1 rounded-xl px-4 py-3 text-left transition-colors"
                  >
                    <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                      Link from Clipboard
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="shimmer block max-w-full truncate text-sm font-medium break-all text-primary">
                        {clipboardUrl}
                      </span>
                      <Icon
                        icon={ArrowRight01Icon}
                        size={16}
                        className="text-muted-foreground group-hover:text-foreground shrink-0 -rotate-45 transition-colors group-hover:rotate-0"
                      />
                    </span>
                  </button>
                ) : null}
              </div>
            </div>

            <InputGroup className="min-h-24 items-end">
              <InputGroupTextarea
                ref={inputRef}
                name="url"
                placeholder="Paste one media URL per line"
                autoComplete="off"
                rows={3}
                value={inputValue}
                onChange={(event) => setInputValue(event.currentTarget.value)}
                onFocus={() => {
                  if (isClipboardApiSupported) {
                    void checkClipboard()
                  }
                }}
                aria-label="Media URLs, one per line"
                className="min-h-24 max-h-48 py-3"
              />
              {(clipboardPermission === "prompt" ||
                clipboardPermission === "denied") && (
                <InputGroupButton
                  type="button"
                  onClick={() => setIsClipboardDialogOpen(true)}
                  title="Enable clipboard suggestions"
                  aria-label="Enable clipboard suggestions"
                  className="mr-1 h-8"
                >
                  <ClipboardAccessIcon className="size-5" />
                </InputGroupButton>
              )}
              {isClipboardApiSupported && clipboardPermission === "granted" && (
                <PasteButton
                  readClipboard={pasteClipboardText}
                  onPaste={(text) => {
                    setInputValue(text)

                    if (inputRef.current) {
                      inputRef.current.value = text
                      inputRef.current.focus()
                    }
                  }}
                />
              )}
              <AddToQueueButton />
            </InputGroup>
            <ClipboardPermissionDialog
              clipboardPermission={clipboardPermission}
              open={isClipboardDialogOpen}
              onAllow={requestClipboardAccess}
              onOpenChange={setIsClipboardDialogOpen}
            />
            <p className="text-muted-foreground text-sm">
              Add one URL or paste several, with one media URL on each line.
            </p>

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
                    pendingFormDataRef.current !== null ||
                    pendingRetryItemIdRef.current !== null

                  pendingFormDataRef.current = null
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

                        const pendingFormData = pendingFormDataRef.current

                        const pendingRetryItemId = pendingRetryItemIdRef.current

                        pendingFormDataRef.current = null
                        pendingRetryItemIdRef.current = null
                        settleTurnstileTokenRequest(token)
                        setIsTurnstileDialogOpen(false)

                        if (pendingFormData) {
                          enqueueFormData(pendingFormData, token)
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

                        pendingFormDataRef.current = null
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

          {formError && (
            <Alert variant="destructive">
              <Icon icon={AlertCircleIcon} size={16} />
              <AlertTitle>Queue update</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

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
              {activeItem?.progress?.title ?? "Submitting Request"}
            </AlertTitle>
            <AlertDescription>
              {activeItem?.progress?.message ?? "Sending the analysis request."}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {isPending && !selectedAnalysis && <MediaSkeleton />}

      {selectedAnalysis?.outputs.json && (
        <div className="mt-6 w-full">
          <div className="animate-in fade-in slide-in-from-bottom-4 ease-smooth duration-300">
            <SaveAnalysisButton analysis={selectedAnalysis} />
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
