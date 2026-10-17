"use client"

import {
  AlertCircleIcon,
  ArrowRight01Icon,
  ClipboardIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons"
import { ANALYZE_PROGRESS_STREAM_CONTENT_TYPE } from "@mediapeek/shared/analyze-progress"
import { Result, Schema } from "effect"
import { AnimatePresence, motion } from "motion/react"
import {
  type Dispatch,
  type SetStateAction,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"

import { MediaSkeleton } from "~/components/media-skeleton"
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
  InputGroupInput,
} from "~/components/ui/input-group"
import { useClipboardSuggestion } from "~/hooks/use-clipboard-suggestion"
import {
  isAnalyzeProgressStreamResponse,
  readAnalyzeStreamResponse,
} from "~/lib/analyze-stream"

import { useHapticFeedback } from "../hooks/use-haptic"
import { MediaView } from "./media-view"
import { TurnstileWidget, type TurnstileWidgetHandle } from "./turnstile-widget"

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <InputGroupButton type="submit" disabled={pending}>
      {pending ? (
        <Icon icon={Loading03Icon} size={16} className="animate-spin" />
      ) : (
        <Icon icon={ArrowRight01Icon} size={16} />
      )}
      <span className="sr-only">Analyze</span>
    </InputGroupButton>
  )
}

function PasteButton({ onPaste }: { onPaste: (text: string) => void }) {
  const { triggerSuccess, triggerError } = useHapticFeedback()

  const isSupported = useSyncExternalStore(
    subscribeWithoutChanges,
    getClipboardSupport,
    getClipboardSupportOnServer
  )

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()

      if (text) {
        onPaste(text)
        triggerSuccess()
      }
    } catch (err) {
      console.error("Failed to read clipboard", err)
      triggerError()
      // On Safari, this might happen if permission explicitly denied.
    }
  }

  if (!isSupported) {
    return null
  }

  return (
    <InputGroupButton
      type="button"
      onClick={() => {
        void handlePaste()
      }}
      title="Paste from clipboard"
    >
      <Icon icon={ClipboardIcon} size={16} />
      <span className="sr-only">Paste</span>
    </InputGroupButton>
  )
}

interface FormState {
  results: Record<string, string> | null
  error: string | null
  status: string
  url?: string
  duration?: number | null
}

interface PendingStatus {
  title: string
  message: string
}

class AnalyzeRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false
  ) {
    super(message)
    this.name = "AnalyzeRequestError"
  }
}

const analyzeResponseErrorSchema = Schema.Struct({
  message: Schema.optionalKey(Schema.String),
  retryable: Schema.optionalKey(Schema.Boolean),
})

const analyzeResponseSchema = Schema.Struct({
  success: Schema.optionalKey(Schema.Boolean),
  requestId: Schema.optionalKey(Schema.String),
  results: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  error: Schema.optionalKey(
    Schema.Union([Schema.String, analyzeResponseErrorSchema])
  ),
})

type AnalyzeResponseWire = typeof analyzeResponseSchema.Type

type AnalyzeResponse = Omit<AnalyzeResponseWire, "error"> & {
  error?: { message?: string; retryable?: boolean }
}

const normalizeAnalyzeResponse = (
  response: AnalyzeResponseWire
): AnalyzeResponse => {
  const { error, ...fields } = response

  if (error === undefined) {
    return fields
  }

  const stringError = Schema.decodeUnknownResult(Schema.String)(error)

  if (Result.isFailure(stringError)) {
    const objectError = Schema.decodeUnknownResult(analyzeResponseErrorSchema)(
      error
    )

    if (Result.isFailure(objectError)) {
      return fields
    }

    return { ...fields, error: objectError.success }
  }

  return {
    ...fields,
    error: { message: stringError.success, retryable: false },
  }
}

const getFormString = (formData: FormData, name: string) => {
  const value = formData.get(name)

  return Schema.is(Schema.String)(value) ? value : null
}

const isRetryableRequestError = (error: Error) => {
  if (error instanceof AnalyzeRequestError && error.retryable) {
    return true
  }

  return (
    error.name === "AbortError" ||
    /timed out|timeout|retry|upstream|unavailable/i.test(error.message)
  )
}

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

const readAnalyzeResponse = async (
  response: Response,
  updatePendingStatus: (status: PendingStatus) => void
): Promise<AnalyzeResponse> => {
  if (isAnalyzeProgressStreamResponse(response)) {
    const terminalEvent = await readAnalyzeStreamResponse(response, (event) => {
      updatePendingStatus({ title: event.title, message: event.message })
    })

    if (terminalEvent.type === "error") {
      throw new AnalyzeRequestError(
        terminalEvent.error.message,
        response.status,
        terminalEvent.error.retryable
      )
    }

    const decodedTerminalResponse = Schema.decodeUnknownSync(
      analyzeResponseSchema
    )({
      success: true,
      requestId: terminalEvent.requestId,
      results: terminalEvent.results,
    })

    return normalizeAnalyzeResponse(decodedTerminalResponse)
  }

  const contentType = response.headers.get("content-type")

  if (!contentType?.includes("application/json")) {
    const responseText = await response.text()

    if (!response.ok) {
      throw new AnalyzeRequestError(
        `Server error (${String(response.status)}). The analysis server failed or timed out.`,
        response.status,
        RETRYABLE_HTTP_STATUSES.has(response.status)
      )
    }

    console.error("Unexpected non-JSON response:", responseText)
    throw new AnalyzeRequestError(
      "Received an invalid response from the server."
    )
  }

  const decodedResponse = Schema.decodeUnknownSync(analyzeResponseSchema)(
    await response.json()
  )

  const data = normalizeAnalyzeResponse(decodedResponse)
  const errorMessage = data.error?.message
  const errorRetryable = data.error?.retryable

  if (!response.ok || data.success === false || errorMessage) {
    throw new AnalyzeRequestError(
      errorMessage ??
        "Unable to analyze the URL. Verify the link and try again.",
      response.status,
      errorRetryable ?? RETRYABLE_HTTP_STATUSES.has(response.status)
    )
  }

  return data
}

const performAnalyzeRequest = async ({
  url,
  turnstileToken,
  updatePendingStatus,
  attempt = 0,
}: {
  url: string
  turnstileToken: string
  updatePendingStatus: (status: PendingStatus) => void
  attempt?: number
}): Promise<AnalyzeResponse> => {
  const controller = new AbortController()

  const timeoutId = setTimeout(
    () => controller.abort(),
    ANALYZE_REQUEST_TIMEOUT_MS
  )

  try {
    const response = await fetch("/resource/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: ANALYZE_PROGRESS_STREAM_CONTENT_TYPE,
        "CF-Turnstile-Response": turnstileToken,
      },
      body: JSON.stringify({ url, format: ["object"] }),
      signal: controller.signal,
    })

    return await readAnalyzeResponse(response, updatePendingStatus)
  } catch (caughtError) {
    const error =
      caughtError instanceof Error
        ? caughtError
        : new Error(String(caughtError))

    if (attempt >= MAX_ANALYZE_RETRIES || !isRetryableRequestError(error)) {
      throw error
    }

    updatePendingStatus({
      title: "Retrying Request",
      message: `The request ended before analysis finished. Retrying now (${String(attempt + 1)}/${String(MAX_ANALYZE_RETRIES)}).`,
    })
    await delay(RETRY_BACKOFF_MS * (attempt + 1))

    return performAnalyzeRequest({
      url,
      turnstileToken,
      updatePendingStatus,
      attempt: attempt + 1,
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

const getAnalyzeErrorMessage = (error: Error) =>
  error.name === "AbortError"
    ? "Analysis timed out. Retry with a smaller or simpler source URL."
    : error.message

const subscribeWithoutChanges = () => () => {}
const getClipboardSupport = () => Boolean(navigator.clipboard)
const getClipboardSupportOnServer = () => false

const usePendingStatusVisibility = (isPending: boolean) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timeoutId = setTimeout(
      () => setIsVisible(isPending),
      isPending ? PROGRESS_VISIBILITY_DELAY_MS : 0
    )

    return () => clearTimeout(timeoutId)
  }, [isPending])

  return isVisible
}

const setFormError = (
  setState: Dispatch<SetStateAction<FormState>>,
  message: string
) => setState({ results: null, error: message, status: "" })

const resetTurnstileInput = (input: HTMLInputElement | null) => {
  if (input) {
    input.value = ""
  }
}

const completeAnalysis = ({
  url,
  startTime,
  results,
  setState,
  triggerCreativeSuccess,
}: {
  url: string
  startTime: number
  results: Record<string, string> | undefined
  setState: Dispatch<SetStateAction<FormState>>
  triggerCreativeSuccess: () => void
}) => {
  triggerCreativeSuccess()
  setState({
    results: results ?? null,
    error: null,
    status: "Done",
    url,
    duration: performance.now() - startTime,
  })
}

const failAnalysis = ({
  url,
  error,
  setState,
  triggerError,
}: {
  url: string
  error: Error
  setState: Dispatch<SetStateAction<FormState>>
  triggerError: () => void
}) => {
  triggerError()
  setState({
    results: null,
    error: getAnalyzeErrorMessage(error),
    status: "Failed",
    url,
  })
}

const resetAnalysisPendingState = ({
  setIsPending,
  setPendingStatus,
  pendingFormDataRef,
  turnstileWidgetRef,
  turnstileInputRef,
}: {
  setIsPending: Dispatch<SetStateAction<boolean>>
  setPendingStatus: Dispatch<SetStateAction<PendingStatus | null>>
  pendingFormDataRef: { current: FormData | null }
  turnstileWidgetRef: { current: TurnstileWidgetHandle | null }
  turnstileInputRef: { current: HTMLInputElement | null }
}) => {
  setIsPending(false)
  setPendingStatus(null)
  pendingFormDataRef.current = null
  turnstileWidgetRef.current?.reset()
  resetTurnstileInput(turnstileInputRef.current)
}

const initialState: FormState = {
  results: null,
  error: null,
  status: "",
  duration: null,
}

const ANALYZE_REQUEST_TIMEOUT_MS = 90_000
const MAX_ANALYZE_RETRIES = 2
const RETRY_BACKOFF_MS = 1_500
const PROGRESS_VISIBILITY_DELAY_MS = 5_000
const RETRYABLE_HTTP_STATUSES = new Set([502, 503, 504])

export function MediaForm() {
  const { triggerCreativeSuccess, triggerError, triggerSuccess } =
    useHapticFeedback()

  const turnstileInputRef = useRef<HTMLInputElement>(null)
  const turnstileWidgetRef = useRef<TurnstileWidgetHandle>(null)
  const pendingFormDataRef = useRef<FormData | null>(null)

  const turnstileTokenResolverRef = useRef<
    ((token: string | null) => void) | null
  >(null)

  const turnstileTokenPromiseRef = useRef<Promise<string | null> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [isTurnstileDialogOpen, setIsTurnstileDialogOpen] = useState(false)
  const [state, setState] = useState(initialState)
  const [isPending, setIsPending] = useState(false)
  const [pendingStatus, setPendingStatus] = useState<PendingStatus | null>(null)
  const shouldShowPendingStatus = usePendingStatusVisibility(isPending)

  const enableTurnstile =
    typeof window !== "undefined"
      ? window.ENV.ENABLE_TURNSTILE === "true"
      : false

  const {
    clipboardUrl,
    ignoreClipboard,
    isPermissionGranted,
    checkClipboard,
    // Used to feature-detect Chromium (supports Permission API) vs Safari (does not).
    // In Safari, reading on focus triggers an annoying system "Paste" bubble, so we skip it there.
    isClipboardApiSupported,
  } = useClipboardSuggestion(state.url)

  const settleTurnstileTokenRequest = useCallback((token: string | null) => {
    const resolve = turnstileTokenResolverRef.current
    turnstileTokenResolverRef.current = null
    turnstileTokenPromiseRef.current = null

    if (resolve) {
      resolve(token)
    }
  }, [])

  const requestTurnstileToken = useCallback(async () => {
    if (!enableTurnstile) {
      return null
    }

    if (turnstileTokenPromiseRef.current) {
      return turnstileTokenPromiseRef.current
    }

    turnstileWidgetRef.current?.reset()

    if (turnstileInputRef.current) {
      turnstileInputRef.current.value = ""
    }

    setState((prev) => ({ ...prev, error: null }))
    setIsTurnstileDialogOpen(true)

    const tokenPromise = new Promise<string | null>((resolve) => {
      turnstileTokenResolverRef.current = resolve
    })

    turnstileTokenPromiseRef.current = tokenPromise

    return tokenPromise
  }, [enableTurnstile])

  useEffect(
    () => () => {
      settleTurnstileTokenRequest(null)
    },
    [settleTurnstileTokenRequest]
  )

  const submitAnalysis = async (formData: FormData) => {
    const url = getFormString(formData, "url")

    const turnstileToken =
      getFormString(formData, "cf-turnstile-response") ?? ""

    if (!url) {
      setFormError(setState, "Enter a valid media URL.")

      return
    }

    if (enableTurnstile && !turnstileToken) {
      setFormError(setState, "Complete the security check to continue.")

      return
    }

    setIsPending(true)
    setPendingStatus({
      title: "Submitting Request",
      message: "Sending the analysis request.",
    })
    setState((prev) => ({ ...prev, error: null, status: "Loading" }))
    const startTime = performance.now()

    try {
      const data = await performAnalyzeRequest({
        url,
        turnstileToken,
        updatePendingStatus: setPendingStatus,
      })

      completeAnalysis({
        url,
        startTime,
        results: data.results,
        setState,
        triggerCreativeSuccess,
      })
    } catch (caughtError) {
      const error =
        caughtError instanceof Error
          ? caughtError
          : new Error(String(caughtError))

      failAnalysis({ url, error, setState, triggerError })
    } finally {
      resetAnalysisPendingState({
        setIsPending,
        setPendingStatus,
        pendingFormDataRef,
        turnstileWidgetRef,
        turnstileInputRef,
      })
    }
  }

  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    const turnstileToken =
      getFormString(formData, "cf-turnstile-response")?.trim() ?? ""

    if (enableTurnstile && !turnstileToken) {
      pendingFormDataRef.current = formData
      setState((prev) => ({ ...prev, error: null }))
      void requestTurnstileToken()

      return
    }

    void submitAnalysis(formData)
  }

  return (
    <div className="flex min-h-[50vh] w-full flex-col justify-center py-8">
      <div className="relative w-full sm:py-2">
        <div className="relative z-10 space-y-10">
          <form onSubmit={onSubmit} className="relative space-y-8" noValidate>
            {/* Clipboard Suggestion Pill */}
            <AnimatePresence>
              {clipboardUrl && (
                <motion.div
                  initial={{ height: 0, opacity: 0, marginBottom: 0 }}
                  animate={{ height: "auto", opacity: 1, marginBottom: 24 }}
                  exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="flex w-full justify-start overflow-hidden"
                >
                  <button
                    type="submit"
                    onClick={(e) => {
                      e.preventDefault()
                      triggerSuccess()
                      // Hide immediately and ignore this URL until it changes
                      ignoreClipboard()

                      // Populate input instantly (controlled) + Auto focus + Submit
                      const form = e.currentTarget.closest("form")

                      if (form) {
                        const input =
                          form.querySelector<HTMLInputElement>(
                            'input[name="url"]'
                          )

                        if (input) {
                          input.value = clipboardUrl
                          form.requestSubmit()
                        }
                      }
                    }}
                    className="hover:bg-muted/50 group flex max-w-full cursor-pointer flex-col items-start gap-1 rounded-xl px-4 py-3 text-left transition-colors"
                  >
                    <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                      Link from Clipboard
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="line-clamp-2 text-sm font-medium break-all">
                        {clipboardUrl}
                      </span>
                      <Icon
                        icon={ArrowRight01Icon}
                        size={16}
                        className="text-muted-foreground group-hover:text-foreground shrink-0 -rotate-45 transition-colors group-hover:rotate-0"
                      />
                    </div>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex w-full items-center gap-2">
              <div className="flex-1">
                <InputGroup>
                  <InputGroupInput
                    ref={inputRef}
                    name="url"
                    placeholder="https://example.com/video.mp4"
                    autoComplete="off"
                    key={state.url}
                    defaultValue={state.url ?? ""}
                    required
                    onFocus={() => {
                      // Lazy check for clipboard (Chromium only).
                      if (isClipboardApiSupported) {
                        void checkClipboard()
                      }
                    }}
                  />
                  {!isPermissionGranted && (
                    <PasteButton
                      onPaste={(text) => {
                        if (inputRef.current) {
                          inputRef.current.value = text
                          inputRef.current.focus()
                          // Trigger change event if needed, but for native input simple assignment is visual.
                        }
                      }}
                    />
                  )}
                  <SubmitButton pending={isPending} />
                </InputGroup>
              </div>
            </div>
            <input
              type="hidden"
              name="cf-turnstile-response"
              id="cf-turnstile-response"
              ref={turnstileInputRef}
            />

            {enableTurnstile && (
              <Dialog
                open={isTurnstileDialogOpen}
                onOpenChange={(open) => {
                  setIsTurnstileDialogOpen(open)

                  if (!open && isPending) {
                    return
                  }

                  if (!open) {
                    const hadPendingSubmit = pendingFormDataRef.current !== null

                    const hadTokenRequest =
                      turnstileTokenResolverRef.current !== null

                    pendingFormDataRef.current = null
                    settleTurnstileTokenRequest(null)

                    if (hadPendingSubmit || hadTokenRequest) {
                      setState((prev) => ({
                        ...prev,
                        error:
                          "Verification was canceled. Complete the security check to continue.",
                      }))
                    }
                  }
                }}
              >
                <DialogContent showCloseButton={!isPending}>
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
                        pendingFormDataRef.current = null
                        settleTurnstileTokenRequest(token)
                        setIsTurnstileDialogOpen(false)

                        if (!pendingFormData) {
                          return
                        }

                        pendingFormData.set("cf-turnstile-response", token)
                        void submitAnalysis(pendingFormData)
                      }}
                      onError={() => {
                        if (turnstileInputRef.current) {
                          turnstileInputRef.current.value = ""
                        }

                        pendingFormDataRef.current = null
                        settleTurnstileTokenRequest(null)
                        setIsTurnstileDialogOpen(false)
                        setState((prev) => ({
                          ...prev,
                          error:
                            "Security check failed. Refresh the page and try again.",
                        }))
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

          {!isPending && state.error && (
            <div>
              <Alert variant="destructive">
                <Icon icon={AlertCircleIcon} size={16} />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </div>
      {isPending && shouldShowPendingStatus && pendingStatus && (
        <div className="mb-4 w-full">
          <Alert>
            <Icon icon={Loading03Icon} size={16} className="animate-spin" />
            <AlertTitle>{pendingStatus.title}</AlertTitle>
            <AlertDescription>{pendingStatus.message}</AlertDescription>
          </Alert>
        </div>
      )}
      {/* Loading Skeleton */}
      {isPending && <MediaSkeleton />}

      {/* Result Card */}
      {state.results && !isPending && (
        <div className="w-full">
          <div className="animate-in fade-in slide-in-from-bottom-4 ease-smooth mt-2 duration-300">
            <MediaView
              data={state.results}
              url={state.url ?? ""}
              requestTurnstileToken={requestTurnstileToken}
            />{" "}
            {/* Default uses JSON for formatted view */}
          </div>
        </div>
      )}
    </div>
  )
}
