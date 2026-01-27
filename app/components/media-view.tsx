'use client';

import { Maximize2, Minimize2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { useFetcher } from 'react-router';
import { z } from 'zod';

import { Button } from '~/components/ui/button';
import { Skeleton } from '~/components/ui/skeleton';
import { removeEmptyStrings } from '~/lib/media-utils';
import { cn } from '~/lib/utils';
import { startNativeViewTransition } from '~/lib/view-transition';
import type { MediaInfoJSON, MediaTrackJSON } from '~/types/media';

import { AccessibilitySection } from './media-view/accessibility-section';
import { AudioSection } from './media-view/audio-section';
import { ChapterSection } from './media-view/chapter-section';
import { GeneralSection } from './media-view/general-section';
import { LibrarySection } from './media-view/library-section';
import { MediaHeader } from './media-view/media-header';
import { SubtitleSection } from './media-view/subtitle-section';
import { VideoSection } from './media-view/video-section';

export const TextResponseSchema = z.object({
  results: z
    .object({
      text: z.string().optional(),
    })
    .optional(),
});

type TextResponse = z.infer<typeof TextResponseSchema>;

interface MediaViewProps {
  data: Record<string, string>;
  url: string;
}

export const MediaView = memo(function MediaView({
  data,
  url,
}: MediaViewProps) {
  const [isTextView, setIsTextView] = useState(false);
  const [showOriginalTitles, setShowOriginalTitles] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetcher = useFetcher<TextResponse>();
  const [_isPending, startTransition] = useTransition();

  // Stable handlers for View Switching to ensure responsiveness
  const handleSetIsTextView = useCallback(
    (val: boolean) => {
      startNativeViewTransition(
        () => {
          setIsTextView(val);
        },
        () => {
          startTransition(() => {
            setIsTextView(val);
          });
        },
      );
    },
    [startTransition],
  );

  const handleSetShowOriginalTitles = useCallback(
    (val: boolean) => {
      startNativeViewTransition(
        () => {
          setShowOriginalTitles(val);
        },
        () => {
          startTransition(() => {
            setShowOriginalTitles(val);
          });
        },
      );
    },
    [startTransition],
  );

  // Lazy load text view on demand using useFetcher
  useEffect(() => {
    if (isTextView && !data.text && !fetcher.data && fetcher.state === 'idle') {
      void fetcher.load(
        `/resource/analyze?url=${encodeURIComponent(url)}&format=text`,
      );
    }
  }, [isTextView, data.text, fetcher, url]);

  // Handle Escape key to exit full screen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullScreen]);

  // Reset scroll when toggling view mode
  useEffect(() => {
    if (!containerRef.current) return;

    const { top } = containerRef.current.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const absoluteTop = top + scrollTop;

    if (scrollTop > absoluteTop) {
      window.scrollTo({ top: absoluteTop, behavior: 'instant' });
    }
  }, [isTextView]);

  const { track: parsedData, creatingLibrary } = useMemo(() => {
    try {
      const jsonStr = data.json;
      if (!jsonStr) return { track: null, creatingLibrary: undefined };
      const json = JSON.parse(jsonStr) as MediaInfoJSON;
      if (!json.media?.track)
        return { track: null, creatingLibrary: undefined };
      return {
        track: removeEmptyStrings(json.media.track) as MediaTrackJSON[],
        creatingLibrary: json.creatingLibrary,
      };
    } catch {
      console.error('Failed to parse JSON');
      return { track: null, creatingLibrary: undefined };
    }
  }, [data]);

  // Merge lazy-loaded text into data
  const fullData = useMemo(() => {
    const fetchedText = fetcher.data?.results?.text;
    const isLoading = fetcher.state === 'loading';

    return {
      ...data,
      text:
        (data.text !== '' ? data.text : undefined) ??
        fetchedText ??
        (isLoading ? '' : ''),
    };
  }, [data, fetcher.data, fetcher.state]);

  const { General, VideoTracks, AudioTracks, TextTracks, MenuTrack } =
    useMemo(() => {
      if (!parsedData) {
        return {
          General: undefined,
          VideoTracks: [],
          AudioTracks: [],
          TextTracks: [],
          MenuTrack: undefined,
        };
      }
      return {
        General: parsedData.find((t) => t['@type'] === 'General'),
        VideoTracks: parsedData.filter((t) => t['@type'] === 'Video'),
        AudioTracks: parsedData.filter((t) => t['@type'] === 'Audio'),
        TextTracks: parsedData.filter((t) => t['@type'] === 'Text'),
        MenuTrack: parsedData.find((t) => t['@type'] === 'Menu'),
      };
    }, [parsedData]);

  if (!parsedData) {
    return (
      <div className="text-destructive rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
        <p className="font-medium">Analysis Error</p>
        <p className="text-sm">Unable to parse analysis data.</p>
        <pre className="mt-2 overflow-x-auto text-xs whitespace-pre-wrap opacity-70">
          {(data['@ref'] ?? '').endsWith('.json') && 'No JSON data'}
        </pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="animate-in fade-in mx-auto w-full max-w-5xl space-y-6 pb-20"
    >
      <MediaHeader
        url={url}
        generalTrack={General}
        videoTracks={VideoTracks}
        audioTracks={AudioTracks}
        textTracks={TextTracks}
        isTextView={isTextView}
        setIsTextView={handleSetIsTextView}
        showOriginalTitles={showOriginalTitles}
        setShowOriginalTitles={handleSetShowOriginalTitles}
        rawData={fullData}
      />

      {isTextView ? (
        <div className="animate-in fade-in duration-300">
          <motion.div
            layout
            initial={false}
            animate={{
              borderRadius: isFullScreen ? 0 : '0.5rem',
            }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30,
            }}
            className={cn(
              'bg-muted/30 border-border/50 overflow-hidden border transition-colors',
              isFullScreen
                ? 'bg-background fixed inset-0 z-50 h-screen w-screen'
                : 'rounded-lg',
            )}
          >
            <motion.div
              layout="position"
              className="bg-muted/50 border-border/50 flex items-center justify-between border-b px-4 py-2"
            >
              <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                TEXT Output
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="hover:bg-background/50 h-6 px-2 text-xs"
                onClick={() => {
                  setIsFullScreen(!isFullScreen);
                }}
                title={isFullScreen ? 'Exit Full Screen (Esc)' : 'Full Screen'}
              >
                {isFullScreen ? (
                  <>
                    <Minimize2 className="mr-1.5 h-3.5 w-3.5 opacity-70" />
                    Minimize
                  </>
                ) : (
                  <>
                    <Maximize2 className="mr-1.5 h-3.5 w-3.5 opacity-70" />
                    Maximize
                  </>
                )}
              </Button>
            </motion.div>
            <div className="relative min-h-[200px]">
              <AnimatePresence mode="wait">
                {fetcher.state === 'loading' ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 z-10 p-4"
                  >
                    <div className="space-y-3">
                      <Skeleton className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800" />
                      <Skeleton className="h-4 w-48 bg-zinc-200 dark:bg-zinc-800" />
                      <div className="space-y-2 pt-4">
                        <Skeleton className="h-3 w-3/4 bg-zinc-200 dark:bg-zinc-800" />
                        <Skeleton className="h-3 w-1/2 bg-zinc-200 dark:bg-zinc-800" />
                        <Skeleton className="h-3 w-full bg-zinc-200 dark:bg-zinc-800" />
                        <Skeleton className="h-3 w-5/6 bg-zinc-200 dark:bg-zinc-800" />
                        <Skeleton className="h-3 w-2/3 bg-zinc-200 dark:bg-zinc-800" />
                      </div>
                      <div className="space-y-2 pt-4">
                        <Skeleton className="h-3 w-full bg-zinc-200 dark:bg-zinc-800" />
                        <Skeleton className="h-3 w-4/5 bg-zinc-200 dark:bg-zinc-800" />
                        <Skeleton className="h-3 w-3/4 bg-zinc-200 dark:bg-zinc-800" />
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.pre
                    key="text-content"
                    initial={{ opacity: 0, filter: 'blur(5px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, filter: 'blur(5px)' }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className={cn(
                      'overflow-x-auto p-4 font-mono text-xs leading-relaxed whitespace-pre sm:text-base sm:whitespace-pre-wrap',
                      isFullScreen
                        ? 'h-[calc(100vh-42px)] max-w-none'
                        : 'max-w-[calc(100vw-3rem)] sm:max-w-none',
                    )}
                  >
                    {fullData.text || 'No text data available.'}
                  </motion.pre>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      ) : (
        <div className="animate-in fade-in space-y-6 duration-300">
          <GeneralSection generalTrack={General} />
          <VideoSection videoTracks={VideoTracks} />
          <AudioSection
            audioTracks={AudioTracks}
            showOriginalTitles={showOriginalTitles}
          />
          <SubtitleSection
            textTracks={TextTracks}
            showOriginalTitles={showOriginalTitles}
          />
          <ChapterSection menuTrack={MenuTrack} />
          <AccessibilitySection
            generalTrack={General}
            audioTracks={AudioTracks}
            textTracks={TextTracks}
          />
          <LibrarySection
            library={creatingLibrary}
            generalTrack={General}
            videoTracks={VideoTracks}
            audioTracks={AudioTracks}
            textTracks={TextTracks}
          />
        </div>
      )}
    </div>
  );
});
