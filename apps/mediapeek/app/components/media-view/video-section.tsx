import { memo } from "react"

import { VideoTrackItem } from "~/components/media-view/video-track-item"
import type { VideoTrackReport } from "~/features/reports/media-report"

export const VideoSection = memo(function VideoSection({
  videoTracks,
  archiveSizingWarning,
}: {
  videoTracks: ReadonlyArray<VideoTrackReport>
  archiveSizingWarning?: string
}) {
  if (videoTracks.length === 0) {
    return null
  }

  return (
    <section className="space-y-4">
      <div className="text-foreground mb-2 flex items-center gap-2">
        <h2 className="mb-3 text-xl font-semibold tracking-tight">Video</h2>
      </div>
      <div className="grid gap-4">
        {videoTracks.map((video) => (
          <VideoTrackItem
            key={video.key}
            video={video}
            archiveSizingWarning={archiveSizingWarning}
          />
        ))}
      </div>
    </section>
  )
})
