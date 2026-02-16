'use client';

import {
  AlertCircleIcon,
  ArrowRight01Icon,
  ClipboardIcon,
  Loading03Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@mediapeek/ui/components/alert';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@mediapeek/ui/components/dialog';
import {
  InputGroup,
  InputGroupButton,
  InputGroupInput,
} from '@mediapeek/ui/components/input-group';
import { AnimatePresence, motion } from 'motion/react';
import { type SyntheticEvent, useEffect, useRef, useState } from 'react';

import { MediaSkeleton } from '~/components/media-skeleton';
import { useClipboardSuggestion } from '~/hooks/use-clipboard-suggestion';

import { useHapticFeedback } from '../hooks/use-haptic';
import { MediaView } from './media-view';
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from './turnstile-widget';

function SubmitButton({ pending }: { pending: boolean }) {
  return (
    <InputGroupButton type="submit" disabled={pending}>
      {pending ? (
        <HugeiconsIcon
          icon={Loading03Icon}
          size={16}
          className="animate-spin"
        />
      ) : (
        <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
      )}
      <span className="sr-only">Analyze</span>
    </InputGroupButton>
  );
}

function PasteButton({ onPaste }: { onPaste: (text: string) => void }) {
  const { triggerSuccess, triggerError } = useHapticFeedback();
  const [isSupported] = useState(
    typeof navigator !== 'undefined' && !!navigator.clipboard,
  );

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onPaste(text);
        triggerSuccess();
      }
    } catch (err) {
      console.error('Failed to read clipboard', err);
      triggerError();
      // On Safari, this might happen if permission explicitly denied.
    }
  };

  if (!isSupported) return null;

  return (
    <InputGroupButton
      type="button"
      onClick={() => {
        void handlePaste();
      }}
      title="Paste from clipboard"
    >
      <HugeiconsIcon icon={ClipboardIcon} size={16} />
      <span className="sr-only">Paste</span>
    </InputGroupButton>
  );
}

interface FormState {
  results: Record<string, string> | null;
  error: string | null;
  status: string;
  url?: string;
  duration?: number | null;
}

interface ErrorShape {
  message?: string;
}

interface AnalyzeResponse {
  success?: boolean;
  requestId?: string;
  results?: Record<string, string>;
  error?: string | ErrorShape;
}

interface AnalyzeRequestError extends Error {
  status?: number;
  retryable?: boolean;
}

const initialState: FormState = {
  results: null,
  error: null,
  status: '',
  duration: null,
};

const ANALYZE_REQUEST_TIMEOUT_MS = 90_000;
const MAX_ANALYZE_RETRIES = 2;
const RETRY_BACKOFF_MS = 1_500;
const SLOW_STATUS_DELAY_MS = 5_000;
const SLOW_STATUS_MESSAGE = 'Source server is taking longer than usual. Still trying...';
const RETRYABLE_HTTP_STATUSES = new Set([502, 503, 504]);

export function MediaForm() {
  const { triggerCreativeSuccess, triggerError, triggerSuccess } =
    useHapticFeedback();
  const turnstileInputRef = useRef<HTMLInputElement>(null);
  const turnstileWidgetRef = useRef<TurnstileWidgetHandle>(null);
  const pendingFormDataRef = useRef<FormData | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isTurnstileVerified, setIsTurnstileVerified] = useState(false);
  const [isTurnstileDialogOpen, setIsTurnstileDialogOpen] = useState(false);
  const [state, setState] = useState<FormState>(initialState);
  const [isPending, setIsPending] = useState(false);
  const [pendingStatusMessage, setPendingStatusMessage] = useState<
    string | null
  >(null);

  const {
    clipboardUrl,
    ignoreClipboard,
    isPermissionGranted,
    checkClipboard,
    // Used to feature-detect Chromium (supports Permission API) vs Safari (does not).
    // In Safari, reading on focus triggers an annoying system "Paste" bubble, so we skip it there.
    isClipboardApiSupported,
  } = useClipboardSuggestion(state.url);

  useEffect(() => {
    if (!isPending || pendingStatusMessage) {
      return;
    }

    const timeoutId = setTimeout(() => {
      setPendingStatusMessage((current) => current ?? SLOW_STATUS_MESSAGE);
    }, SLOW_STATUS_DELAY_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isPending, pendingStatusMessage]);

  const submitAnalysis = async (formData: FormData) => {
    const url = formData.get('url') as string;
    const turnstileToken = formData.get('cf-turnstile-response') as string;

    if (!url) {
      setState({
        results: null,
        error: 'Enter a valid URL.',
        status: '',
      });
      return;
    }

    const enableTurnstile =
      typeof window !== 'undefined'
        ? (
            window as unknown as {
              ENV?: { ENABLE_TURNSTILE?: string };
            }
          ).ENV?.ENABLE_TURNSTILE === 'true'
        : false;

    if (enableTurnstile && !turnstileToken) {
      setState({
        results: null,
        error: 'Complete the verification.',
        status: '',
      });
      return;
    }

    const createAnalyzeError = (
      message: string,
      status?: number,
      retryable = false,
    ) => {
      const error = new Error(message) as AnalyzeRequestError;
      error.status = status;
      error.retryable = retryable;
      return error;
    };

    const isRetryableRequestError = (err: unknown) => {
      if (!(err instanceof Error)) return false;
      if ((err as AnalyzeRequestError).retryable) return true;
      if (err.name === 'AbortError') return true;
      return /timed out|timeout|retry|upstream|unavailable/i.test(err.message);
    };

    const wait = (ms: number) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      });

    setIsPending(true);
    setPendingStatusMessage(null);
    setState((prev) => ({ ...prev, error: null, status: 'Loading' }));
    const startTime = performance.now();

    try {
      let lastError: unknown = null;

      for (let attempt = 0; attempt <= MAX_ANALYZE_RETRIES; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, ANALYZE_REQUEST_TIMEOUT_MS);

        try {
          const response = await fetch('/resource/analyze', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'CF-Turnstile-Response': turnstileToken,
            },
            body: JSON.stringify({
              url,
              format: ['object'],
            }),
            signal: controller.signal,
          });

          const contentType = response.headers.get('content-type');
          let data: AnalyzeResponse = {};

          if (contentType?.includes('application/json')) {
            data = await response.json();
          } else {
            const text = await response.text();
            if (!response.ok) {
              throw createAnalyzeError(
                `Server Error (${String(response.status)}): The analysis server failed or timed out.`,
                response.status,
                RETRYABLE_HTTP_STATUSES.has(response.status),
              );
            }
            console.error('Unexpected non-JSON response:', text);
            throw createAnalyzeError('Received invalid response from server.');
          }

          const errorMessage =
            typeof data.error === 'string' ? data.error : data.error?.message;
          if (!response.ok || data.success === false || errorMessage) {
            throw createAnalyzeError(
              errorMessage ??
                'Unable to analyze URL. Verify the link is correct.',
              response.status,
              RETRYABLE_HTTP_STATUSES.has(response.status),
            );
          }

          const resultData = data.results ?? null;
          const endTime = performance.now();
          triggerCreativeSuccess();

          setState({
            results: resultData,
            error: null,
            status: 'Done',
            url,
            duration: endTime - startTime,
          });
          setPendingStatusMessage(null);
          return;
        } catch (err) {
          lastError = err;
          if (attempt < MAX_ANALYZE_RETRIES && isRetryableRequestError(err)) {
            setPendingStatusMessage(
              `Server is slow or unavailable. Retrying (${String(attempt + 1)}/${String(MAX_ANALYZE_RETRIES)})...`,
            );
            await wait(RETRY_BACKOFF_MS * (attempt + 1));
            continue;
          }
          break;
        } finally {
          clearTimeout(timeoutId);
        }
      }

      triggerError();
      const errorMessage =
        lastError instanceof Error && lastError.name === 'AbortError'
          ? 'Analysis timed out. Please retry with a smaller or simpler source URL.'
          : lastError instanceof Error
            ? lastError.message
            : 'Analysis Failed';
      setState({
        results: null,
        error: errorMessage,
        status: 'Failed',
        url,
      });
    } finally {
      setIsPending(false);
      setPendingStatusMessage(null);
      pendingFormDataRef.current = null;
      setIsTurnstileVerified(false);
      turnstileWidgetRef.current?.reset();
      if (turnstileInputRef.current) {
        turnstileInputRef.current.value = '';
      }
    }
  };

  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const enableTurnstile =
      typeof window !== 'undefined'
        ? (
            window as unknown as {
              ENV?: { ENABLE_TURNSTILE?: string };
            }
          ).ENV?.ENABLE_TURNSTILE === 'true'
        : false;

    const turnstileToken =
      (formData.get('cf-turnstile-response') as string | null)?.trim() ?? '';
    if (enableTurnstile && !turnstileToken) {
      pendingFormDataRef.current = formData;
      setState((prev) => ({ ...prev, error: null }));
      setIsTurnstileDialogOpen(true);
      return;
    }

    void submitAnalysis(formData);
  };

  const enableTurnstile =
    typeof window !== 'undefined'
      ? (
          window as unknown as {
            ENV?: { ENABLE_TURNSTILE?: string };
          }
        ).ENV?.ENABLE_TURNSTILE === 'true'
      : false;

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
                  animate={{ height: 'auto', opacity: 1, marginBottom: 24 }}
                  exit={{ height: 0, opacity: 0, marginBottom: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  className="flex w-full justify-start overflow-hidden"
                >
                  <button
                    type="submit"
                    onClick={(e) => {
                      e.preventDefault();
                      triggerSuccess();
                      // Hide immediately and ignore this URL until it changes
                      ignoreClipboard();

                      // Populate input instantly (controlled) + Auto focus + Submit
                      const form = e.currentTarget.closest('form');
                      if (form) {
                        const input =
                          form.querySelector<HTMLInputElement>(
                            'input[name="url"]',
                          );
                        if (input) {
                          input.value = clipboardUrl;
                          form.requestSubmit();
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
                      <HugeiconsIcon
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
                    defaultValue={state.url ?? ''}
                    required
                    onFocus={() => {
                      // Lazy check for clipboard (Chromium only).
                      if (isClipboardApiSupported) {
                        void checkClipboard();
                      }
                    }}
                  />
                  {!isPermissionGranted && (
                    <PasteButton
                      onPaste={(text) => {
                        if (inputRef.current) {
                          inputRef.current.value = text;
                          inputRef.current.focus();
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
                  setIsTurnstileDialogOpen(open);
                  if (!open && pendingFormDataRef.current && !isPending) {
                    pendingFormDataRef.current = null;
                    if (!isTurnstileVerified) {
                      setState((prev) => ({
                        ...prev,
                        error: 'Verification was cancelled.',
                      }));
                    }
                  }
                }}
              >
                <DialogContent showCloseButton={!isPending}>
                  <DialogHeader>
                    <DialogTitle>Verify Before Analysis</DialogTitle>
                    <DialogDescription>
                      Complete the Turnstile check to run this analysis request.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex min-h-[65px] justify-center">
                    <TurnstileWidget
                      ref={turnstileWidgetRef}
                      onVerify={(token) => {
                        setIsTurnstileVerified(true);
                        if (turnstileInputRef.current) {
                          turnstileInputRef.current.value = token;
                        }

                        const pendingFormData = pendingFormDataRef.current;
                        if (!pendingFormData) return;

                        pendingFormData.set('cf-turnstile-response', token);
                        pendingFormDataRef.current = null;
                        setIsTurnstileDialogOpen(false);
                        void submitAnalysis(pendingFormData);
                      }}
                      onError={() => {
                        setIsTurnstileVerified(false);
                        if (turnstileInputRef.current) {
                          turnstileInputRef.current.value = '';
                        }
                        setState((prev) => ({
                          ...prev,
                          error:
                            'Security check failed. Please refresh and try again.',
                        }));
                      }}
                      onExpire={() => {
                        setIsTurnstileVerified(false);
                        if (turnstileInputRef.current) {
                          turnstileInputRef.current.value = '';
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
                <HugeiconsIcon icon={AlertCircleIcon} size={16} />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{state.error}</AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </div>
      {isPending && pendingStatusMessage && (
        <div className="mb-4 w-full">
          <Alert>
            <AlertTitle>Processing</AlertTitle>
            <AlertDescription>{pendingStatusMessage}</AlertDescription>
          </Alert>
        </div>
      )}
      {/* Loading Skeleton */}
      {isPending && <MediaSkeleton />}

      {/* Result Card */}
      {state.results && !isPending && (
        <div className="w-full">
          <div className="animate-in fade-in slide-in-from-bottom-4 ease-smooth mt-2 duration-300">
            <MediaView data={state.results} url={state.url ?? ''} />{' '}
            {/* Default uses JSON for formatted view */}
          </div>
        </div>
      )}
    </div>
  );
}
