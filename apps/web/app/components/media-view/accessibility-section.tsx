import { memo } from 'react';

import { getAccessibilityFeatures } from '~/lib/media-utils';
import type { MediaTrackJSON } from '~/types/media';

import { MediaIcon } from './media-icon';

export const AccessibilitySection = memo(function AccessibilitySection({
  generalTrack,
  audioTracks,
  textTracks,
}: {
  generalTrack: MediaTrackJSON | undefined;
  audioTracks: MediaTrackJSON[];
  textTracks: MediaTrackJSON[];
}) {
  const { hasSDH, hasCC, hasAD } = getAccessibilityFeatures(
    audioTracks,
    textTracks,
    generalTrack,
  );

  if (!hasSDH && !hasCC && !hasAD) return null;

  return (
    <div className="mt-8 space-y-6">
      <h3 className="text-sm font-semibold tracking-wider uppercase">
        Accessibility
      </h3>

      <div className="grid gap-6 md:grid-cols-2">
        {/* SDH */}
        {hasSDH && (
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:gap-4">
            <div className="flex w-20 shrink-0 items-center justify-center">
              <MediaIcon name="sdh" className="h-8 opacity-80" />
            </div>
            <div className="space-y-1">
              <h4 className="text-foreground/85 text-sm font-medium">
                SDH Subtitles
              </h4>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Subtitles for the Deaf and Hard-of-Hearing (SDH) refer to
                subtitles that include non-dialogue audio cues, similar to
                closed captions, but encoded as subtitle tracks.
              </p>
            </div>
          </div>
        )}

        {/* CC */}
        {hasCC && (
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:gap-4">
            <div className="flex w-20 shrink-0 items-center justify-center">
              <MediaIcon name="cc" className="h-8 opacity-80" />
            </div>
            <div className="space-y-1">
              <h4 className="text-foreground/85 text-sm font-medium">
                Closed Captions
              </h4>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Closed captions (CC) refer to subtitles in the available
                language with the addition of relevant non-dialogue information.
              </p>
            </div>
          </div>
        )}

        {/* AD */}
        {hasAD && (
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:gap-4">
            <div className="flex w-20 shrink-0 items-center justify-center">
              <MediaIcon name="ad" className="h-8 opacity-80" />
            </div>
            <div className="space-y-1">
              <h4 className="text-foreground/85 text-sm font-medium">
                Audio Descriptions
              </h4>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Audio descriptions (AD) refer to a narration track describing
                what is happening on screen, to provide context for those who
                are blind or have low vision.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
