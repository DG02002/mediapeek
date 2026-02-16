import { Separator } from '@mediapeek/ui/components/separator';
import { memo, useMemo, useState } from 'react';

import { OptionsMenu } from '~/components/media-view/options-menu';
import { getMediaBadges, isValidFilename } from '~/lib/media-utils';
import type { MediaTrackJSON } from '~/types/media';

import { MediaIcon } from './media-icon';

interface MediaHeaderProps {
  generalTrack?: MediaTrackJSON;
  videoTracks: MediaTrackJSON[];
  audioTracks: MediaTrackJSON[];
  textTracks: MediaTrackJSON[];
  isTextView: boolean;
  setIsTextView: (val: boolean) => void;
  showOriginalTitles: boolean;
  setShowOriginalTitles: (val: boolean) => void;
  rawData: Record<string, string>;
  url: string;
  requestTurnstileToken?: () => Promise<string | null>;
}

export const MediaHeader = memo(function MediaHeader({
  generalTrack,
  videoTracks,
  audioTracks,
  textTracks,
  isTextView,
  setIsTextView,
  showOriginalTitles,
  setShowOriginalTitles,
  rawData,
  url,
  requestTurnstileToken,
}: MediaHeaderProps) {
  const [_, setPrivateBinUrl] = useState<string | null>(null);

  const headerIcons = useMemo(
    () =>
      generalTrack
        ? getMediaBadges(videoTracks, audioTracks, textTracks, generalTrack)
        : [],
    [videoTracks, audioTracks, textTracks, generalTrack],
  );

  if (!generalTrack) return null;

  const filenameRaw =
    generalTrack.CompleteName ?? generalTrack.File_Name ?? 'Unknown';
  // Extract basename
  let displayFilename =
    filenameRaw.split('/').pop()?.split('\\').pop() ?? filenameRaw;

  // Defensive validation: If backend logic missed it, check for binary garbage
  if (!isValidFilename(displayFilename)) {
    // Fallback to extracting filename from URL
    try {
      const urlObj = new URL(url);
      const urlPath = urlObj.pathname.split('/').pop();
      if (urlPath) {
        displayFilename = decodeURIComponent(urlPath);
      } else {
        displayFilename = 'Unknown';
      }
    } catch {
      displayFilename = 'Unknown';
    }
  }

  const archiveNameRaw = generalTrack.Archive_Name as string | undefined;
  const displayArchiveName =
    archiveNameRaw?.split('/').pop()?.split('\\').pop() ?? archiveNameRaw;

  const fileSizeRaw = generalTrack.FileSize_String;
  const fileSize =
    fileSizeRaw ??
    (generalTrack['FileSize/String'] as string | undefined) ??
    (generalTrack.FileSize as string | undefined);

  const durationRaw = generalTrack.Duration_String;
  const duration =
    durationRaw ??
    (generalTrack['Duration/String'] as string | undefined) ??
    (generalTrack.Duration as string | undefined);

  return (
    <div className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-50 -mx-4 flex flex-col gap-4 px-4 pt-4 pb-0 backdrop-blur-md transition-all md:-mx-8 md:px-8">
      <div className="flex flex-col items-start gap-2 md:gap-4">
        <div className="flex w-full flex-col gap-1">
          {displayArchiveName && (
            <div className="text-muted-foreground font-mono text-xs font-semibold tracking-wider break-all uppercase opacity-80 select-all">
              {displayArchiveName}
            </div>
          )}
          <h1 className="text-lg font-bold tracking-tight break-all md:text-2xl">
            {displayFilename}
          </h1>
        </div>
        <div className="text-muted-foreground flex w-full flex-wrap items-center gap-4 text-sm">
          {duration && <span>{duration}</span>}
          {fileSize && (
            <>
              <span className="opacity-30">|</span>
              <span>{fileSize}</span>
            </>
          )}

          {/* Icons & Options */}
          <div className="border-border flex flex-wrap items-center gap-3 sm:flex-1 sm:border-l sm:pl-4">
            {headerIcons.length > 0 &&
              headerIcons.map((icon) => (
                <MediaIcon
                  key={icon}
                  name={icon}
                  className="h-5 opacity-90 transition-opacity hover:opacity-100"
                />
              ))}

            {/* Actions */}
            <div className="ml-auto flex items-center gap-2">
              <OptionsMenu
                data={rawData}
                url={url}
                filename={displayFilename}
                requestTurnstileToken={requestTurnstileToken}
                isTextView={isTextView}
                setIsTextView={setIsTextView}
                showOriginalTitles={showOriginalTitles}
                setShowOriginalTitles={setShowOriginalTitles}
                onShareSuccess={setPrivateBinUrl}
              />
            </div>
          </div>
        </div>
      </div>
      <Separator />
    </div>
  );
});
