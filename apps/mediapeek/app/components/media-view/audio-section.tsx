import { memo } from "react"

import type { AudioTrackReport } from "~/features/reports/media-report"

import { AudioTrackRow } from "./audio-track-row"

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
      <div className="text-foreground flex items-center gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Audio</h2>
      </div>
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
