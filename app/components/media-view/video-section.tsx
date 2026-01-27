import { memo } from 'react';

import { VideoTrackItem } from '~/components/media-view/video-track-item';
import type { MediaTrackJSON } from '~/types/media';

export const VideoSection = memo(function VideoSection({
  videoTracks,
}: {
  videoTracks: MediaTrackJSON[];
}) {
  if (videoTracks.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="text-foreground mb-2 flex items-center gap-2">
        <h2 className="mb-3 text-xl font-semibold tracking-tight">Video</h2>
      </div>
      <div className="grid gap-4">
        {videoTracks.map((video, idx) => (
          <VideoTrackItem
            key={video.ID ?? video.UniqueID ?? idx}
            video={video}
          />
        ))}
      </div>
    </section>
  );
});
