import { CopyMenu } from '~/components/copy-menu';
import { ShareMenu } from '~/components/share-menu';
import { Label } from '~/components/ui/label';
import { Separator } from '~/components/ui/separator';
import { Switch } from '~/components/ui/switch';
import { formatDuration, formatSize } from '~/lib/formatters';
import { getAccessibilityFeatures } from '~/lib/media-utils';
import type { MediaTrackJSON } from '~/types/media';

import { MediaIcon } from './media-icon';

interface MediaHeaderProps {
  generalTrack?: MediaTrackJSON;
  videoTracks: MediaTrackJSON[];
  audioTracks: MediaTrackJSON[];
  textTracks: MediaTrackJSON[];
  isTextView: boolean;
  setIsTextView: (val: boolean) => void;
  rawData: Record<string, string>;
  url: string;
}

export function MediaHeader({
  generalTrack,
  videoTracks,
  audioTracks,
  textTracks,
  isTextView,
  setIsTextView,
  rawData,
  url,
}: MediaHeaderProps) {
  if (!generalTrack) return null;

  const headerIcons: string[] = [];
  // Use a loose type for accessing non-standard fields like "FileSize/String"
  const trackAny = generalTrack as unknown as Record<string, string>;

  // 1. Resolution
  if (videoTracks.length > 0) {
    const widthRaw = videoTracks[0]['Width'] || '0';
    const width = parseInt(widthRaw, 10);

    if (!isNaN(width)) {
      if (width >= 3840) headerIcons.push('4k');
      else if (width >= 1920) headerIcons.push('hd');
      else if (width <= 1280) headerIcons.push('sd');
    }

    // HDR / Dolby Vision
    const hdrFormat = videoTracks[0]['HDR_Format'] || '';
    const hdrCompatibility = videoTracks[0]['HDR_Format_Compatibility'] || '';

    if (hdrFormat.includes('HDR10+') || hdrCompatibility.includes('HDR10+')) {
      headerIcons.push('hdr10-plus');
    } else if (hdrFormat.includes('HDR')) {
      if (!hdrFormat.includes('Dolby Vision')) {
        headerIcons.push('hdr');
      }
    }

    if (hdrFormat.includes('Dolby Vision')) {
      headerIcons.push('dolby-vision');
    }
  }

  // 2. Audio Tech
  let hasAtmos = false;
  let hasDTS = false;
  let hasDolby = false;

  audioTracks.forEach((a) => {
    // Keys in JSON: "Format", "Format_Commercial_IfAny", "Title"
    const fmt = a['Format'] || '';
    const commercial = a['Format_Commercial_IfAny'] || '';
    const title = a['Title'] || '';
    const combined = (fmt + commercial + title).toLowerCase();

    if (combined.includes('atmos')) hasAtmos = true;
    if (combined.includes('dts')) hasDTS = true;
    if (
      combined.includes('dolby') ||
      combined.includes('ac-3') ||
      combined.includes('e-ac-3')
    )
      hasDolby = true;
  });

  if (hasAtmos) headerIcons.push('dolby-atmos');
  else if (
    hasDolby &&
    !audioTracks.some((a) => (a['Format'] || '').includes('DTS'))
  ) {
    headerIcons.push('dolby');
  }

  if (hasDTS) headerIcons.push('dts');

  // 3. Subtitle Tech (SDH & CC & AD)
  const { hasSDH, hasCC, hasAD } = getAccessibilityFeatures(
    audioTracks,
    textTracks,
    generalTrack,
  );
  if (hasCC) headerIcons.push('cc');
  if (hasSDH) headerIcons.push('sdh');
  if (hasAD) headerIcons.push('ad');

  const filenameRaw =
    generalTrack['CompleteName'] || generalTrack['File_Name'] || 'Unknown';
  // Extract basename
  const displayFilename =
    filenameRaw.split('/').pop()?.split('\\').pop() || filenameRaw;

  // Access fields via trackAny to avoid TS errors
  const fileSize =
    trackAny['FileSize/String'] || formatSize(generalTrack['FileSize']);
  const duration =
    trackAny['Duration/String'] || formatDuration(generalTrack['Duration']);

  return (
    <div className="bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-50 -mx-4 flex flex-col gap-4 px-4 pt-4 pb-0 backdrop-blur-md transition-all md:-mx-8 md:px-8">
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-xl font-bold tracking-tight break-all md:text-2xl">
          {displayFilename}
        </h1>
        <div className="text-muted-foreground flex w-full flex-wrap items-center gap-4 text-sm">
          {duration && <span>{duration}</span>}
          {fileSize && (
            <>
              <span className="opacity-30">|</span>
              <span>{fileSize}</span>
            </>
          )}

          {/* Header Icons Inline */}
          {headerIcons.length > 0 && (
            <div className="border-border flex items-center gap-3 sm:border-l sm:pl-4">
              {headerIcons.map((icon) => (
                <MediaIcon
                  key={icon}
                  name={icon}
                  className="h-6 w-10 opacity-90 transition-opacity hover:opacity-100"
                />
              ))}
            </div>
          )}

          {/* Copy & Share Menus - Right of Badges */}
          <div className="mt-2 flex w-full shrink-0 flex-wrap items-center justify-start gap-4 sm:mt-0 sm:ml-auto sm:w-auto sm:justify-end">
            <div className="flex items-center space-x-2">
              <Switch
                id="text-mode"
                checked={isTextView}
                onCheckedChange={setIsTextView}
              />
              <Label htmlFor="text-mode" className="text-xs whitespace-nowrap">
                View as Text
              </Label>
            </div>
            <CopyMenu data={rawData} url={url} />
            <ShareMenu data={rawData} url={url} />
          </div>
        </div>
      </div>
      <Separator />
    </div>
  );
}
