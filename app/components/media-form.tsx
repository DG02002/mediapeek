'use client';

import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';

import { MediaSkeleton } from '~/components/media-skeleton';
import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Button } from '~/components/ui/button';
import {
  InputGroup,
  InputGroupButton,
  InputGroupInput,
} from '~/components/ui/input-group';

import { useHapticFeedback } from '../hooks/use-haptic';
import { MediaView } from './media-view';
import { ModeToggle } from './mode-toggle';

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
  const { triggerSuccess, triggerError } = useHapticFeedback();
  const [state, formAction, isPending] = useActionState(
    async (_prevState: FormState, formData: FormData): Promise<FormState> => {
      const url = formData.get('url') as string;
      if (!url) {
        return {
          results: null,
          error: 'Please enter a valid URL.',
          status: '',
        };
      }

      const startTime = performance.now();

      try {
        // --- SERVER ANALYSIS ---
        const response = await fetch(
          `/resource/analyze?url=${encodeURIComponent(url)}&format=all`,
        );
        const data = (await response.json()) as {
          results?: Record<string, string>;
          error?: string;
        };

        if (!response.ok || data.error) {
          throw new Error(
            data.error || 'Unable to analyze this URL. Please verify the link.',
          );
        }
        const resultData = data.results || null;

        const endTime = performance.now();
        const duration = endTime - startTime;

        triggerSuccess();

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

  // Toast effect for errors only (success toast removed as per request)
  useEffect(() => {
    if (state.status === 'Failed' && state.error) {
      toast.error('Analysis Failed', {
        description: state.error,
      });
    }
  }, [state.status, state.error]);

  return (
    <div className="flex min-h-[50vh] w-full flex-col items-center justify-center py-10">
      <div className="relative w-full max-w-5xl sm:p-12">
        <div className="relative z-10 space-y-10">
          <div className="flex items-start justify-between">
            <div className="space-y-2 text-left">
              <a
                href="https://mediapeek.plnk.workers.dev/"
                className="no-underline"
              >
                <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
                  MediaPeek
                </h1>
              </a>
              <p className="text-muted-foreground leading-7">
                Get detailed metadata for any media file.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" asChild>
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
              <ModeToggle />
            </div>
          </div>

          <form action={formAction} className="space-y-8">
            <div className="flex w-full items-center gap-2">
              <div className="flex-1">
                <InputGroup>
                  <InputGroupInput
                    name="url"
                    placeholder="https://example.com/video.mp4"
                    autoComplete="off"
                    key={state.url}
                    defaultValue={state.url || ''}
                    required
                  />
                  <SubmitButton />
                </InputGroup>
              </div>
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
            <MediaView data={state.results} />{' '}
            {/* Default uses JSON for formatted view */}
          </div>
        </div>
      )}
    </div>
  );
}
