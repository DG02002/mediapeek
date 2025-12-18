import { AlertCircle, Loader2 } from 'lucide-react';
import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';

import { Alert, AlertDescription, AlertTitle } from '~/components/ui/alert';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Input } from '~/components/ui/input';
import { Skeleton } from '~/components/ui/skeleton';

import { useHapticFeedback } from '../hooks/use-haptic';
import { CopyButton } from './copy-button';
import { FormatMenu } from './format-menu';
import { ModeToggle } from './mode-toggle';
import { PrivateBinButton } from './privatebin-button';

// Separate component to utilize useFormStatus
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Processing...
        </>
      ) : (
        'Get Info'
      )}
    </Button>
  );
}

// Initial state for the action
type FormState = {
  result: string | null;
  error: string | null;
  status: string;
  url?: string;
  duration?: number | null;
};

const initialState: FormState = {
  result: null,
  error: null,
  status: '',
  duration: null,
};

export function MediaForm() {
  const [realtimeStatus, setRealtimeStatus] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<string>('text');

  useEffect(() => {
    // Check if running on client side
    if (typeof window !== 'undefined') {
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      if (isMobile) {
        setSelectedFormat('minimal');
      }
    }
  }, []);

  const { triggerSuccess, triggerError } = useHapticFeedback();
  const [state, formAction, isPending] = useActionState(
    async (_prevState: FormState, formData: FormData): Promise<FormState> => {
      const url = formData.get('url') as string;
      if (!url) {
        return { result: null, error: 'URL is required', status: '' };
      }

      setRealtimeStatus('Analyzing media metadata via secure proxy...');
      const startTime = performance.now();

      try {
        // --- SERVER ANALYSIS ---
        const response = await fetch(
          `/resource/analyze?url=${encodeURIComponent(url)}&format=${selectedFormat}`,
        );
        const data = (await response.json()) as {
          result?: string;
          error?: string;
        };

        if (!response.ok || data.error) {
          throw new Error(data.error || 'Server analysis failed');
        }
        const resultData = data.result || '';

        const endTime = performance.now();
        const duration = endTime - startTime;

        // Haptic Feedback
        triggerSuccess();

        return {
          result: resultData,
          error: null,
          status: 'Done',
          url,
          duration,
        };
      } catch (err) {
        // Haptic Feedback on Error
        triggerError();
        return {
          result: null,
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
      {/* Main Container */}
      <div className="relative w-full max-w-5xl sm:p-12">
        <div className="relative z-10 space-y-10">
          {/* Header - Left Aligned */}
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
                View detailed metadata for video, audio, image, and subtitle
                files.
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
            <div className="space-y-2">
              <label
                htmlFor="media-url"
                className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Media URL
              </label>
              <div className="group relative">
                <Input
                  id="media-url"
                  name="url"
                  placeholder="https://example.com/video.mp4"
                  autoComplete="off"
                  key={state.url}
                  defaultValue={state.url || ''}
                  required
                />
              </div>
            </div>

            <div className="flex gap-4">
              <div className="relative">
                <FormatMenu
                  value={selectedFormat}
                  onChange={setSelectedFormat}
                />
                <input type="hidden" name="format" value={selectedFormat} />
              </div>
              <SubmitButton />
            </div>
          </form>

          {/* Status Indicator */}
          {(isPending || state.error) && (
            <div>
              {!isPending && state.error ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              ) : (
                <p className="text-muted-foreground text-sm font-medium">
                  {realtimeStatus}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isPending && !state.result && (
        <div className="mt-8 w-full max-w-5xl px-0 sm:px-12">
          <div className="bg-card w-full overflow-hidden rounded-xl border shadow-sm">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-8 w-24" />
            </div>
            <div className="space-y-4 p-6">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[90%]" />
              <Skeleton className="h-4 w-[85%]" />
              <Skeleton className="h-4 w-[60%]" />
            </div>
          </div>
        </div>
      )}

      {/* Result Card */}
      {state.result && !isPending && (
        <div className="w-full max-w-5xl px-0 sm:px-12">
          <div className="bg-card mt-8 w-full rounded-xl border shadow-sm">
            <div className="bg-card/95 sticky top-0 z-20 flex flex-col items-start gap-4 border-b px-6 py-4 backdrop-blur-sm first:rounded-t-xl sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <h2 className="scroll-m-20 text-3xl font-semibold tracking-tight first:mt-0">
                  Metadata
                </h2>
                {state.duration && (
                  <Badge variant="secondary">
                    Duration: {(state.duration / 1000).toFixed(1)}s
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <CopyButton content={state.result!} />
                <PrivateBinButton content={state.result!} />
              </div>
            </div>
            <div className="relative rounded-b-xl p-6">
              <div className="overflow-x-auto">
                <pre className="text-base leading-none font-medium">
                  {state.result}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
