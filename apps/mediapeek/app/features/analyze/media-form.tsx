"use client"

import { AlertCircleIcon, ArrowRight02Icon } from "@hugeicons/core-free-icons"
import { Schema } from "effect"
import {
  type ClipboardEvent,
  type SyntheticEvent,
  useRef,
  useState,
} from "react"
import { useNavigate } from "react-router"

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Icon } from "~/components/ui/icon"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "~/components/ui/input-group"
import { ClipboardAccessIcon } from "~/features/analyze/clipboard-access-icon"
import { ClipboardPermissionDialog } from "~/features/analyze/clipboard-permission-dialog"
import { useAnalysisQueue } from "~/features/analyze/queue/use-analysis-queue"
import { TurnstileVerificationDialog } from "~/features/analyze/turnstile-verification-dialog"
import { useClipboardUrl } from "~/features/analyze/use-clipboard-url"
import { useTurnstileVerification } from "~/features/analyze/use-turnstile-verification"

const getFormString = (formData: FormData, name: string) => {
  const value = formData.get(name)

  return Schema.is(Schema.String)(value) ? value : null
}

export function MediaForm() {
  const navigate = useNavigate()
  const { queue } = useAnalysisQueue()
  const [formError, setFormError] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState("")
  const [isClipboardDialogOpen, setIsClipboardDialogOpen] = useState(false)
  const pendingUrlRef = useRef<string | null>(null)

  const {
    enabled: turnstileEnabled,
    inputRef: turnstileInputRef,
    widgetRef: turnstileWidgetRef,
    isOpen: isTurnstileDialogOpen,
    setIsOpen: setIsTurnstileDialogOpen,
    settle: settleTurnstileTokenRequest,
    requestToken: requestTurnstileToken,
  } = useTurnstileVerification()

  const {
    clipboardUrl,
    clipboardPermission,
    ignoreClipboard,
    checkClipboard,
    isClipboardApiSupported,
    requestClipboardAccess,
  } = useClipboardUrl(undefined)

  const enqueueUrl = (url: string, turnstileToken?: string) => {
    const outcome = queue.add(url, turnstileToken).at(0)

    if (outcome?.kind === "queued") {
      setInputValue("")
      setFormError(null)
      void navigate(`/app/item/${outcome.itemId}`)

      return
    }

    if (outcome?.kind === "duplicate") {
      setInputValue("")
      setFormError("That URL is already available in this session.")
      void navigate(`/app/item/${outcome.itemId}`)

      return
    }

    setFormError(
      outcome?.kind === "error" ? outcome.message : "Enter a media URL."
    )
  }

  const submitUrl = (rawUrl: string) => {
    const url = rawUrl.trim()

    if (!url) {
      setFormError("Enter a media URL.")

      return
    }

    if (url.split(/\r?\n/u).filter(Boolean).length > 1) {
      setFormError("Analyze one URL at a time.")

      return
    }

    const turnstileToken = turnstileEnabled
      ? (turnstileInputRef.current?.value.trim() ?? "")
      : ""

    if (turnstileEnabled && !turnstileToken) {
      pendingUrlRef.current = url
      setFormError(null)
      void requestTurnstileToken()

      return
    }

    enqueueUrl(url, turnstileToken || undefined)
  }

  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    submitUrl(getFormString(new FormData(event.currentTarget), "url") ?? "")
  }

  const handleInputPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const text = event.clipboardData.getData("text/plain")

    if (!text.includes("\n")) {
      return
    }

    event.preventDefault()
    setFormError("Analyze one URL at a time.")
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
                      submitUrl(url)
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
                  <AlertTitle>Analysis could not start</AlertTitle>
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
                  title="Analyze URL"
                  aria-label="Analyze URL"
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
              <TurnstileVerificationDialog
                open={isTurnstileDialogOpen}
                widgetRef={turnstileWidgetRef}
                onOpenChange={(open) => {
                  setIsTurnstileDialogOpen(open)

                  if (!open) {
                    const hadPendingAction = pendingUrlRef.current !== null

                    pendingUrlRef.current = null
                    settleTurnstileTokenRequest(null)

                    if (hadPendingAction) {
                      setFormError(
                        "Verification was canceled. Complete the security check to continue."
                      )
                    }
                  }
                }}
                onVerify={(token) => {
                  if (turnstileInputRef.current) {
                    turnstileInputRef.current.value = token
                  }

                  const pendingUrl = pendingUrlRef.current
                  pendingUrlRef.current = null
                  settleTurnstileTokenRequest(token)
                  setIsTurnstileDialogOpen(false)

                  if (pendingUrl) {
                    enqueueUrl(pendingUrl, token)
                  }
                }}
                onError={() => {
                  if (turnstileInputRef.current) {
                    turnstileInputRef.current.value = ""
                  }

                  pendingUrlRef.current = null
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
            )}
          </form>
        </div>
      </div>
    </div>
  )
}
