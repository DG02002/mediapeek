'use client';

import { useMemo, useState } from 'react';

import type { MediaInfoJSON } from '~/types/media';

import { AccessibilitySection } from './media-view/accessibility-section';
import { AudioSection } from './media-view/audio-section';
import { ChapterSection } from './media-view/chapter-section';
import { MediaHeader } from './media-view/media-header';
import { SubtitleSection } from './media-view/subtitle-section';
import { VideoSection } from './media-view/video-section';

interface MediaViewProps {
  data: Record<string, string>;
}

export function MediaView({ data }: MediaViewProps) {
  const [isTextView, setIsTextView] = useState(false);

  const parsedData = useMemo(() => {
    try {
      const jsonStr = data.json;
      if (!jsonStr) return null;
      const json = JSON.parse(jsonStr) as MediaInfoJSON;
      if (!json.media || !json.media.track) return null;
      return json.media.track;
    } catch {
      console.error('Failed to parse JSON');
      return null;
    }
  }, [data]);

  if (!parsedData) {
    return (
      <div className="text-destructive rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-900/20">
        <p className="font-medium">Analysis Data Error</p>
        <p className="text-sm">Could not parse MediaInfo JSON output.</p>
        <pre className="mt-2 overflow-x-auto text-xs whitespace-pre-wrap opacity-70">
          {data.json || 'No JSON data'}
        </pre>
      </div>
    );
  }

  const General = parsedData.find((t) => t['@type'] === 'General');
  const VideoTracks = parsedData.filter((t) => t['@type'] === 'Video');
  const AudioTracks = parsedData.filter((t) => t['@type'] === 'Audio');
  const TextTracks = parsedData.filter((t) => t['@type'] === 'Text');
  const MenuTrack = parsedData.find((t) => t['@type'] === 'Menu');

  return (
    <div className="animate-in fade-in mx-auto w-full max-w-5xl space-y-6 pb-20">
      <MediaHeader
        generalTrack={General}
        videoTracks={VideoTracks}
        audioTracks={AudioTracks}
        textTracks={TextTracks}
        isTextView={isTextView}
        setIsTextView={setIsTextView}
        rawData={data}
      />

      {isTextView ? (
        <div className="animate-in fade-in duration-300">
          <div className="bg-muted/30 border-border/50 overflow-hidden rounded-lg border">
            <div className="bg-muted/50 border-border/50 border-b px-4 py-2">
              <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                TEXT Output
              </span>
            </div>
            <pre className="max-w-[calc(100vw-3rem)] overflow-x-auto p-4 font-mono text-base leading-relaxed whitespace-pre sm:max-w-none sm:whitespace-pre-wrap">
              {data.text || 'No text data available.'}
            </pre>
          </div>
        </div>
      ) : (
        <div className="animate-in fade-in space-y-6 duration-300">
          {General?.['Encoded_Application'] && (
            <div className="text-sm">
              <span className="text-muted-foreground mr-2 font-medium"></span>
              <span className="text-muted-foreground font-mono">
                {General['Encoded_Application']}
              </span>
            </div>
          )}
          <VideoSection videoTracks={VideoTracks} generalTrack={General} />
          <AudioSection audioTracks={AudioTracks} />
          <SubtitleSection textTracks={TextTracks} />
          <ChapterSection menuTrack={MenuTrack} />
          <AccessibilitySection
            audioTracks={AudioTracks}
            textTracks={TextTracks}
          />
        </div>
      )}
    </div>
  );
}
