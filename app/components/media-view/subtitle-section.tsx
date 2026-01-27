import { memo } from 'react';

import type { MediaTrackJSON } from '~/types/media';

import { SubtitleTrackRow } from './subtitle-track-row';

export const SubtitleSection = memo(function SubtitleSection({
  textTracks,
  showOriginalTitles,
}: {
  textTracks: MediaTrackJSON[];
  showOriginalTitles: boolean;
}) {
  if (textTracks.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="text-foreground flex items-center gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Subtitles</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {textTracks.map((text, idx) => (
          <SubtitleTrackRow
            key={text.ID ?? text.UniqueID ?? idx}
            track={text}
            showOriginalTitles={showOriginalTitles}
          />
        ))}
      </div>
    </section>
  );
});
