import { memo } from "react"

import { VideoTrackItem } from "~/components/media-view/video-track-item"
import type { VideoTrackReport } from "~/features/reports/media-report"

import { SectionHeading } from "./section-heading"

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
      <SectionHeading title="Video" className="mb-2" headingClassName="mb-3" />
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
