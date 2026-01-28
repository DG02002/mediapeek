'use client';

import {
  AlertCircle,
  ArrowRight,
  Clipboard as ClipboardIcon,
  Loader2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  useActionState,
  useEffect,
  useOptimistic,
  useRef,
  useState,
} from 'react';
import { useFormStatus } from 'react-dom';

import { MediaSkeleton } from '~/components/media-skeleton';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import {
  InputGroup,
  InputGroupButton,
  InputGroupInput,
} from '~/components/ui/input-group';
import { useClipboardSuggestion } from '~/hooks/use-clipboard-suggestion';

import { useHapticFeedback } from '../hooks/use-haptic';
import { Header } from './header';
import { MediaView } from './media-view';
import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from './turnstile-widget';

// Separate component to utilize useFormStatus
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <InputGroupButton type="submit" disabled={pending}>
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ArrowRight className="h-4 w-4" />
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
      <ClipboardIcon className="h-4 w-4" />
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

  const [state, formAction, isPending] = useActionState(
    async (_prevState: FormState, formData: FormData): Promise<FormState> => {
      const url = formData.get('url') as string;
      const turnstileToken = formData.get('cf-turnstile-response') as string;

      if (!url) {
        return {
          results: null,
          error: 'Enter a valid URL.',
          status: '',
        };
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
        return {
          results: null,
          error: 'Complete the verification.',
          status: '',
        };
      }

      const startTime = performance.now();

      try {
        // --- SERVER ANALYSIS ---
        // Fetch only object (JSON) format initially to avoid CPU timeout.
        // Text format will be lazy-loaded on demand in the MediaView component.
        const response = await fetch(
          `/resource/analyze?url=${encodeURIComponent(url)}&format=object`,
          {
            headers: {
              'CF-Turnstile-Response': turnstileToken,
            },
          },
        );

        const contentType = response.headers.get('content-type');
        let data: { results?: Record<string, string>; error?: string } = {};

        if (contentType?.includes('application/json')) {
          data = await response.json();
        } else {
          // If response is not JSON (e.g., 503 HTML page), read as text to debug or just throw
          const text = await response.text();
          if (!response.ok) {
            throw new Error(
              `Server Error (${String(response.status)}): The analysis worker may have crashed or timed out.`,
            );
          }
          console.error('Unexpected non-JSON response:', text);
          throw new Error('Received invalid response from server.');
        }

        if (!response.ok || data.error) {
          throw new Error(
            data.error ?? 'Unable to analyze URL. Verify the link is correct.',
          );
        }
        const resultData = data.results ?? null;

        const endTime = performance.now();
        const duration = endTime - startTime;

        triggerCreativeSuccess();

        return {
          results: resultData,
          error: null,
          status: 'Done',
          url,
          duration,
        };
      } catch (err) {
        triggerError();
        return {
          results: null,
          error: err instanceof Error ? err.message : 'Analysis Failed',
          status: 'Failed',
          url,
        };
      }
    },
    initialState,
  );

  const [optimisticState, setOptimisticState] = useOptimistic(
    state,
    (currentState, optimisticValue: Partial<FormState>) => ({
      ...currentState,
      ...optimisticValue,
    }),
  );

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
  }, [state]);

  const handleFormAction = (formData: FormData) => {
    // Clear any previous error immediately
    setOptimisticState({ error: null });
    formAction(formData);
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

          <form action={handleFormAction} className="relative space-y-8">
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
                      <ArrowRight className="text-muted-foreground group-hover:text-foreground h-4 w-4 shrink-0 -rotate-45 transition-colors group-hover:rotate-0" />
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
                  <SubmitButton />
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

          {!isPending && optimisticState.error && (
            <div>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{optimisticState.error}</AlertDescription>
              </Alert>
            </div>
          )}
        </div>
      </div>
      {/* Loading Skeleton */}
      {isPending && <MediaSkeleton />}

      {/* Result Card */}
      {optimisticState.results && !isPending && (
        <div className="w-full max-w-5xl px-0 sm:px-12">
          <div className="animate-in fade-in slide-in-from-bottom-4 mt-2 duration-500">
            <MediaView
              data={optimisticState.results}
              url={optimisticState.url ?? ''}
            />{' '}
            {/* Default uses JSON for formatted view */}
          </div>
        </div>
      )}
    </div>
  );
}
