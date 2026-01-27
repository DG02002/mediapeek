import { memo } from 'react';

import type { MediaTrackJSON } from '~/types/media';

import { AudioTrackRow } from './audio-track-row';

export const AudioSection = memo(function AudioSection({
  audioTracks,
  showOriginalTitles,
}: {
  audioTracks: MediaTrackJSON[];
  showOriginalTitles: boolean;
}) {
  if (audioTracks.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="text-foreground flex items-center gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Audio</h2>
      </div>
      <div className="flex flex-col gap-3">
        {audioTracks.map((audio, idx) => (
          <AudioTrackRow
            key={audio.ID ?? audio.UniqueID ?? idx}
            track={audio}
            trackNumber={audio['@typeorder']}
            showTrackNumber={audioTracks.length > 1}
            showOriginalTitles={showOriginalTitles}
          />
        ))}
      </div>
    </section>
  );
});
