import { memo, useMemo } from "react"

import { StructureBlock } from "~/components/media-view/structure-block"
import type { AudioTrackReport } from "~/features/reports/media-report"

interface AudioStreamStructureProps {
  track: AudioTrackReport
}

export const AudioStreamStructure = memo(function AudioStreamStructure({
  track,
}: AudioStreamStructureProps) {
  const structures = useMemo(
    () =>
      [
        { key: "Presentation", data: track.presentations },
        { key: "SignalGroup", data: track.signalGroups },
      ].filter(({ data }) => data.length > 0),
    [track.presentations, track.signalGroups]
  )

  if (
    Object.keys(track.globalStructure).length === 0 &&
    structures.length === 0
  ) {
    return null
  }

  return (
    <div className="mt-4 flex w-full flex-col gap-6">
      {Object.keys(track.globalStructure).length > 0 && (
        <StructureBlock data={track.globalStructure} label="Extra" depth={0} />
      )}

      {/* Render Structures */}
      {structures.map(({ key, data }) => (
        <StructureBlock key={key} data={data} label={`${key}s`} depth={0} />
      ))}
    </div>
  )
})
