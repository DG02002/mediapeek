'use client';

import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useActionState, useEffect, useRef } from 'react';
import { useFormStatus } from 'react-dom';

import { MediaSkeleton } from '~/components/media-skeleton';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import {
  InputGroup,
  InputGroupButton,
  InputGroupInput,
} from '~/components/ui/input-group';
import { useClipboardSuggestion } from '~/hooks/use-clipboard-suggestion';

import { useHapticFeedback } from '../hooks/use-haptic';
import { MediaView } from './media-view';
import { ModeToggle } from './mode-toggle';
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

function GithubButton({ className }: { className?: string }) {
  return (
    <Button variant="ghost" size="icon" asChild className={className}>
      <a
        href="https://github.com/luminalreason/mediapeek"
        target="_blank"
        rel="noreferrer"
      >
        <svg
          role="img"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          className="h-[1.2rem] w-[1.2rem] fill-current"
        >
          <title>GitHub</title>
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
        </svg>
        <span className="sr-only">GitHub</span>
      </a>
    </Button>
  );
}

type FormState = {
  results: Record<string, string> | null;
  error: string | null;
  status: string;
  url?: string;
  duration?: number | null;
};

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

      if (!turnstileToken) {
        return {
          results: null,
          error: 'Complete the verification.',
          status: '',
        };
      }

      const startTime = performance.now();

      try {
        // --- SERVER ANALYSIS ---
        const response = await fetch(
          `/resource/analyze?url=${encodeURIComponent(url)}&format=json,text`,
          {
            headers: {
              'CF-Turnstile-Response': turnstileToken,
            },
          },
        );

        const contentType = response.headers.get('content-type');
        let data: { results?: Record<string, string>; error?: string } = {};

        if (contentType && contentType.includes('application/json')) {
          data = (await response.json()) as {
            results?: Record<string, string>;
            error?: string;
          };
        } else {
          // If response is not JSON (e.g., 503 HTML page), read as text to debug or just throw
          const text = await response.text();
          if (!response.ok) {
            throw new Error(
              `Server Error (${response.status}): The analysis worker may have crashed or timed out.`,
            );
          }
          console.error('Unexpected non-JSON response:', text);
          throw new Error('Received invalid response from server.');
        }

        if (!response.ok || data.error) {
          throw new Error(
            data.error || 'Unable to analyze URL. Verify the link is correct.',
          );
        }
        const resultData = data.results || null;

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

  // Clipboard logic

  const { clipboardUrl, ignoreClipboard } = useClipboardSuggestion(state.url);

  // Reset Turnstile when state changes (meaning submission completed)
  useEffect(() => {
    if (state.status === 'Done' || state.status === 'Failed') {
      turnstileWidgetRef.current?.reset();
      if (turnstileInputRef.current) {
        turnstileInputRef.current.value = '';
      }
    }
  }, [state]);

  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center py-10">
      <div className="relative w-full max-w-5xl sm:p-12">
        <div className="relative z-10 space-y-10">
          <div>
            {/* Row 1: Title and Desktop Actions */}
            {/* Header Group: Icon + Title + Actions */}
            {/* Header Group: Icon + Title + Actions */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
              {/* Icon */}
              <a
                href="https://mediapeek.plnk.workers.dev/"
                className="block no-underline"
              >
                <div className="relative h-16 w-16 drop-shadow-md">
                  <img
                    src="/icons/icon-light.webp"
                    alt="MediaPeek Logo"
                    className="hidden h-full w-full object-contain dark:block"
                  />
                  <img
                    src="/icons/icon-dark.webp"
                    alt="MediaPeek Logo"
                    className="h-full w-full object-contain dark:hidden"
                  />
                </div>
              </a>

              {/* Content Column: Title/Actions + Description */}
              <div className="flex flex-1 flex-col">
                {/* Title and Desktop Actions */}
                <div className="flex items-center justify-between">
                  <a
                    href="https://mediapeek.plnk.workers.dev/"
                    className="no-underline"
                  >
                    <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
                      MediaPeek
                    </h1>
                  </a>
                  <div className="flex items-center gap-2">
                    <GithubButton className="hidden sm:inline-flex" />
                    <ModeToggle />
                  </div>
                </div>

                {/* Description and Mobile Actions */}
                <div className="flex w-full items-center justify-between gap-2">
                  <p className="text-muted-foreground leading-7">
                    Get detailed metadata for any media file.
                  </p>
                  <GithubButton className="inline-flex sm:hidden" />
                </div>
              </div>
            </div>
          </div>

          <form action={formAction} className="relative space-y-8">
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
                        const input = form.querySelector(
                          'input[name="url"]',
                        ) as HTMLInputElement;
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
                    name="url"
                    placeholder="https://example.com/video.mp4"
                    autoComplete="off"
                    // If we have a clipboard URL that was clicked, we want it here.
                    // But standard state update is cleaner.
                    key={state.url}
                    defaultValue={state.url || ''}
                    required
                  />
                  <SubmitButton />
                </InputGroup>
              </div>
            </div>

            <div className="flex justify-center">
              <TurnstileWidget
                ref={turnstileWidgetRef}
                onVerify={(token) => {
                  if (turnstileInputRef.current) {
                    turnstileInputRef.current.value = token;
                  }
                }}
              />
              <input
                type="hidden"
                name="cf-turnstile-response"
                id="cf-turnstile-response"
                ref={turnstileInputRef}
              />
            </div>
          </form>

          {!isPending && state.error && (
            <div>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
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
          <div className="animate-in fade-in slide-in-from-bottom-4 mt-8 duration-500">
            <MediaView data={state.results} url={state.url || ''} />{' '}
            {/* Default uses JSON for formatted view */}
          </div>
        </div>
      )}
    </div>
  );
}
