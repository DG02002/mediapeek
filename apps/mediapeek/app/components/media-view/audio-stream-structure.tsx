import { memo, useMemo } from "react"

import { StructureBlock } from "~/components/media-view/structure-block"
import {
  isMediaStructureArray,
  isMediaStructureRecord,
  isMediaStructureValue,
  type MediaStructureValue,
} from "~/lib/media-structure"
import type { MediaTrackJSON } from "~/types/media"

interface AudioStreamStructureProps {
  track: MediaTrackJSON
}

export const AudioStreamStructure = memo(function AudioStreamStructure({
  track,
}: AudioStreamStructureProps) {
  const { extra } = track

  const { globalData, structures } = useMemo(() => {
    if (!isMediaStructureRecord(extra)) {
      return { globalData: {}, structures: [] }
    }

    // 1. Identify "Global" / "Stream Info" fields
    const globalKeys = [
      "SignalGroupCount",
      "DrcSets_Count",
      "DrcSets_Effects",
      "Loudness_Count",
      "SamplePeakLevel",
      "Loudness_Anchor",
      "Loudness_Program",
      "ChannelMode",
      "BedChannelConfiguration",
    ]

    const gData: Record<string, MediaStructureValue> = {}
    globalKeys.forEach((key) => {
      const value = extra[key]

      if (value && isMediaStructureValue(value)) {
        gData[key] = value
      }
    })

    // 2. Identify known top-level structural arrays
    const structuralKeys = ["Presentation", "SignalGroup"]

    const structs = structuralKeys.flatMap((key) => {
      const data = extra[key]

      return isMediaStructureArray(data) && data.length > 0
        ? [{ key, data }]
        : []
    })

    return { globalData: gData, structures: structs }
  }, [extra])

  if (Object.keys(globalData).length === 0 && structures.length === 0) {
    return null
  }

  return (
    <div className="mt-4 flex w-full flex-col gap-6">
      {Object.keys(globalData).length > 0 && (
        <StructureBlock data={globalData} label="Extra" depth={0} />
      )}

      {/* Render Structures */}
      {structures.map(({ key, data }) => (
        <StructureBlock key={key} data={data} label={`${key}s`} depth={0} />
      ))}
    </div>
  )
})
