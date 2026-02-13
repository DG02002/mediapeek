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
  InputGroup,
  InputGroupButton,
  InputGroupInput,
} from '@mediapeek/ui/components/input-group';
import { AnimatePresence, motion } from 'motion/react';
import { type SyntheticEvent, useEffect, useRef, useState } from 'react';

import { MediaSkeleton } from '~/components/media-skeleton';
import { useClipboardSuggestion } from '~/hooks/use-clipboard-suggestion';

import { useHapticFeedback } from '../hooks/use-haptic';
import { Header } from './header';
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

const initialState: FormState = {
  results: null,
  error: null,
  status: '',
  duration: null,
};

export function MediaForm() {
  const { triggerCreativeSuccess, triggerError, triggerSuccess } =
    useHapticFeedback();
  const turnstileInputRef = useRef<HTMLInputElement>(null);
  const turnstileWidgetRef = useRef<TurnstileWidgetHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isTurnstileVerified, setIsTurnstileVerified] = useState(false);
  const [state, setState] = useState<FormState>(initialState);
  const [isPending, setIsPending] = useState(false);

  const {
    clipboardUrl,
    ignoreClipboard,
    isPermissionGranted,
    checkClipboard,
    // Used to feature-detect Chromium (supports Permission API) vs Safari (does not).
    // In Safari, reading on focus triggers an annoying system "Paste" bubble, so we skip it there.
    isClipboardApiSupported,
  } = useClipboardSuggestion(state.url);

  // Reset Turnstile when state changes (meaning submission completed)
  useEffect(() => {
    if (state.status === 'Done' || state.status === 'Failed') {
      turnstileWidgetRef.current?.reset();
      if (turnstileInputRef.current) {
        turnstileInputRef.current.value = '';
      }
    }
  }, [state.status]);

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

    setIsPending(true);
    setState((prev) => ({ ...prev, error: null }));
    const startTime = performance.now();

    try {
      const response = await fetch(
        `/resource/analyze?url=${encodeURIComponent(url)}&format=object`,
        {
          headers: {
            'CF-Turnstile-Response': turnstileToken,
          },
        },
      );

      const contentType = response.headers.get('content-type');
      let data: AnalyzeResponse = {};

      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        if (!response.ok) {
          throw new Error(
            `Server Error (${String(response.status)}): The analysis server failed or timed out.`,
          );
        }
        console.error('Unexpected non-JSON response:', text);
        throw new Error('Received invalid response from server.');
      }

      const errorMessage =
        typeof data.error === 'string' ? data.error : data.error?.message;
      if (!response.ok || data.success === false || errorMessage) {
        throw new Error(
          errorMessage ?? 'Unable to analyze URL. Verify the link is correct.',
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
    } catch (err) {
      triggerError();
      setState({
        results: null,
        error: err instanceof Error ? err.message : 'Analysis Failed',
        status: 'Failed',
        url,
      });
    } finally {
      setIsPending(false);
    }
  };

  const onSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    void submitAnalysis(formData);
  };

  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center py-10">
      <div className="relative w-full max-w-5xl sm:px-12 sm:pt-12 sm:pb-2">
        <div className="relative z-10 space-y-10">
          <div>
            <div>
              <Header showDescription />
            </div>
          </div>

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

            {/* Turnstile Container */}
            {typeof window !== 'undefined' &&
              (
                window as unknown as {
                  ENV?: { ENABLE_TURNSTILE?: string };
                }
              ).ENV?.ENABLE_TURNSTILE === 'true' && (
                <div
                  className={`flex justify-center ${isTurnstileVerified ? 'hidden' : ''}`}
                >
                  <TurnstileWidget
                    ref={turnstileWidgetRef}
                    onVerify={(token) => {
                      setIsTurnstileVerified(true);
                      if (turnstileInputRef.current) {
                        turnstileInputRef.current.value = token;
                      }
                    }}
                    onExpire={() => {
                      setIsTurnstileVerified(false);
                    }}
                  />
                  <input
                    type="hidden"
                    name="cf-turnstile-response"
                    id="cf-turnstile-response"
                    ref={turnstileInputRef}
                  />
                </div>
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
      {/* Loading Skeleton */}
      {isPending && <MediaSkeleton />}

      {/* Result Card */}
      {state.results && !isPending && (
        <div className="w-full max-w-5xl px-0 sm:px-12">
          <div className="animate-in fade-in slide-in-from-bottom-4 ease-smooth mt-2 duration-300">
            <MediaView data={state.results} url={state.url ?? ''} />{' '}
            {/* Default uses JSON for formatted view */}
          </div>
        </div>
      )}
    </div>
  );
}
