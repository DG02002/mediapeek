import { memo, type ReactNode, useMemo } from "react"

import type { AudioTrackReport } from "~/features/reports/media-report"
import { cleanBitrateString, cleanMetadataString } from "~/lib/formatters"

import { MediaDetailItem } from "./media-detail-item"

interface AudioTechDetailsProps {
  track: AudioTrackReport
}

interface DetailItem {
  label: string
  value: string | ReactNode | undefined
  sub?: string
}

export const AudioTechDetails = memo(function AudioTechDetails({
  track,
}: AudioTechDetailsProps) {
  const details: DetailItem[] = useMemo(() => {
    return [
      {
        label: "Format",
        value: track.formatText ?? track.formatCommercial ?? track.formatName,
      },
      {
        label: "Format Settings",
        value: [track.formatEndianness, track.formatSign]
          .filter(Boolean)
          .join(" / "),
      },
      {
        label: "Format Profile",
        value: [
          track.formatProfile,
          track.formatLevel && `@L${track.formatLevel}`,
          track.formatTier && `@${track.formatTier}`,
        ]
          .filter(Boolean)
          .join(""),
      },
      {
        label: "Format Mode",
        value: track.formatMode,
      },
      {
        label: "Bitrate",
        value: cleanBitrateString(track.bitrate ?? track.maximumBitrate ?? ""),

        sub: track.bitrateModeText ?? track.bitrateMode,
      },
      {
        label: "Sample Rate",

        value:
          track.samplingRateText ??
          (track.samplingRate ? `${track.samplingRate} Hz` : undefined),
      },
      {
        label: "Bit Depth",
        value:
          track.bitDepthText ??
          (track.bitDepth ? `${track.bitDepth}-bit` : undefined),
      },
      {
        label: "Delay",
        value: (() => {
          const d = track.delay
          const sd = track.sourceDelay

          if (d && d !== "0" && d !== "0.000") {
            return `${d}ms`
          }

          if (sd && sd !== "0" && sd !== "0.000") {
            return `${sd}ms`
          }

          return undefined
        })(),
        sub: (() => {
          const d = track.delay
          const sd = track.sourceDelay

          // If primary delay exists, we don't show source.
          // If primary is empty/0, and we use source delay, show its source if available.
          if (
            (!d || d === "0" || d === "0.000") &&
            sd &&
            sd !== "0" &&
            sd !== "0.000"
          ) {
            return track.sourceDelaySource
          }

          return undefined
        })(),
      },
      {
        label: "Dialogue Intelligence",
        value: track.dialogueNormalization,
      },
      {
        label: "Compression",

        value:
          track.compressionModeText ??
          cleanMetadataString(track.compressionMode),
      },
      {
        label: "Encoded Library",

        value: track.encodedLibraryText ?? track.encodedLibrary,
      },
      {
        label: "Service Kind",

        value: track.serviceKindText ?? track.serviceKind,
      },
      {
        label: "Codec Configuration Box",
        value: track.codecConfigurationBox,
      },
    ].filter((item) => item.value)
  }, [track])

  if (details.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-3 md:grid-cols-4 md:gap-4">
      {details.map((item, idx) => (
        <MediaDetailItem
          key={`${item.label}-${String(idx)}`}
          label={item.label}
          value={
            <>
              {item.value}
              {item.sub && (
                <span className="text-muted-foreground/60 ml-1.5 font-sans text-xs font-normal">
                  {item.sub}
                </span>
              )}
            </>
          }
        />
      ))}
    </div>
  )
})
