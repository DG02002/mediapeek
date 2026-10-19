import { memo } from "react"

import type { AudioTrackReport } from "~/features/reports/media-report"

import { AudioTrackRow } from "./audio-track-row"
import { SectionHeading } from "./section-heading"

export const AudioSection = memo(function AudioSection({
  audioTracks,
  showOriginalTitles,
}: {
  audioTracks: ReadonlyArray<AudioTrackReport>
  showOriginalTitles: boolean
}) {
  if (audioTracks.length === 0) {
    return null
  }

  return (
    <section className="space-y-4">
      <SectionHeading title="Audio" />
      <div className="flex flex-col gap-3">
        {audioTracks.map((audio) => (
          <AudioTrackRow
            key={audio.key}
            track={audio}
            trackNumber={audio.order}
            showTrackNumber={audioTracks.length > 1}
            showOriginalTitles={showOriginalTitles}
          />
        ))}
      </div>
    </section>
  )
})
