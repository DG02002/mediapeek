import { Match } from "effect"
import { memo } from "react"

import type { VideoTrackReport } from "~/features/reports/media-report"
import {
  cleanBitrateString,
  getFirstDefinedFormat,
  mapDolbyProfile,
} from "~/lib/formatters"

import { ArchiveEstimateTooltip } from "./archive-estimate-tooltip"
import { MediaDetailItem } from "./media-detail-item"

interface VideoTrackItemProps {
  video: VideoTrackReport
  archiveSizingWarning?: string
}

export const VideoTrackItem = memo(function VideoTrackItem({
  video,
  archiveSizingWarning,
}: VideoTrackItemProps) {
  const { formatInfo } = video

  const codec = getFirstDefinedFormat(
    formatInfo ? `${video.formatName ?? ""} (${formatInfo})` : undefined,
    video.formatName
  )

  const profile = video.formatProfile
  const level = video.formatLevel
  const tier = video.formatTier

  const profileStr = [
    profile,
    level ? `@L${level}` : "",
    tier ? `@${tier}` : "",
  ]
    .filter(Boolean)
    .join("")

  const rawBitrate = video.bitrate ?? video.overallBitrate
  const bitrateStr = rawBitrate ? cleanBitrateString(rawBitrate) : null
  const bpf = video.bitsPerPixelFrame

  return (
    <div className="border-border/40 grid gap-x-8 gap-y-6 border-b pb-6 text-sm last:border-0 sm:grid-cols-2 md:grid-cols-4">
      <MediaDetailItem label="Codec">
        <div className="flex flex-col">
          <span className="text-foreground/85 font-semibold">{codec}</span>
          {video.codecId && (
            <span className="text-muted-foreground text-xs font-normal break-all">
              {video.codecId}
            </span>
          )}
          {profileStr && (
            <span className="text-muted-foreground text-xs font-normal break-all">
              {profileStr}
            </span>
          )}
        </div>
      </MediaDetailItem>
      <MediaDetailItem label="Resolution">
        <div className="flex flex-col">
          <span className="text-foreground/85 font-semibold">
            {video.width} x {video.height}
          </span>
          {video.displayAspectRatio && (
            <span className="text-muted-foreground text-xs font-normal">
              {video.displayAspectRatioText ?? video.displayAspectRatio}
            </span>
          )}
        </div>
      </MediaDetailItem>
      {bitrateStr && (
        <MediaDetailItem label="Bitrate">
          <div className="flex flex-col">
            <span className="text-foreground/85 inline-flex items-center gap-2 font-semibold">
              <span>{bitrateStr}</span>
              <ArchiveEstimateTooltip warning={archiveSizingWarning} />
            </span>
            {video.bitrateMode && (
              <span className="text-muted-foreground text-xs font-normal">
                {video.bitrateModeText ?? video.bitrateMode}
              </span>
            )}
            {bpf && (
              <span className="text-muted-foreground text-xs font-normal">
                Bits/(Pixel*Frame): {bpf}
              </span>
            )}
          </div>
        </MediaDetailItem>
      )}
      <MediaDetailItem label="Frame Rate">
        <div className="flex flex-col">
          <span className="text-foreground/85 font-semibold">
            {video.frameRateText ?? video.frameRate ?? "Unknown"}
          </span>
          {video.originalFrameRate && (
            <span className="text-muted-foreground text-xs font-normal">
              Original: {video.originalFrameRate}
            </span>
          )}
          {video.frameRateMode && (
            <span className="text-muted-foreground text-xs font-normal">
              {video.frameRateModeText ?? video.frameRateMode}
            </span>
          )}
        </div>
      </MediaDetailItem>

      {(video.colorPrimaries ??
        video.transferCharacteristics ??
        video.matrixCoefficients) && (
        <MediaDetailItem label="Colorimetry">
          <div className="flex flex-col">
            {video.colorPrimaries && (
              <span className="text-foreground/85 font-semibold break-all">
                {video.colorPrimaries}
              </span>
            )}
            {video.matrixCoefficients && (
              <span className="text-muted-foreground text-xs font-normal break-all">
                {video.matrixCoefficients}
              </span>
            )}
            {video.transferCharacteristics && (
              <span className="text-muted-foreground text-xs font-normal break-all">
                {video.transferCharacteristics} (Transfer)
              </span>
            )}
          </div>
        </MediaDetailItem>
      )}

      {video.hdrFormat && (
        <MediaDetailItem label="High Dynamic Range" value={video.hdrFormat}>
          <div className="flex flex-col gap-0.5">
            <span className="text-foreground/85 font-semibold break-all">
              {video.hdrFormat}
            </span>
            {video.hdrProfile && (
              <span className="text-muted-foreground text-xs break-all">
                {mapDolbyProfile(video.hdrProfile)}
              </span>
            )}
            {video.hdrCompatibility && (
              <span className="text-muted-foreground text-xs break-all">
                Compatibility: {video.hdrCompatibility}
              </span>
            )}
          </div>
        </MediaDetailItem>
      )}

      {(video.masteringDisplayPrimaries ?? video.masteringDisplayLuminance) && (
        <MediaDetailItem label="Mastering Display">
          <div className="flex flex-col">
            {video.masteringDisplayPrimaries && (
              <span className="text-foreground/85 font-semibold break-all">
                {video.masteringDisplayPrimaries}
              </span>
            )}
            {video.masteringDisplayLuminance && (
              <span className="text-muted-foreground text-xs font-normal break-all">
                {video.masteringDisplayLuminance}
              </span>
            )}
          </div>
        </MediaDetailItem>
      )}

      {(video.colorSpace ?? video.chromaSubsampling ?? video.colorRange) && (
        <MediaDetailItem label="Color">
          <div className="flex flex-col">
            {video.colorSpace && (
              <span className="text-foreground/85 font-semibold break-all">
                {video.colorSpace}
              </span>
            )}
            {video.chromaSubsampling && (
              <span className="text-muted-foreground text-xs font-normal break-all">
                {video.chromaSubsamplingText ?? video.chromaSubsampling}
                {video.chromaSubsamplingPosition &&
                  !(
                    video.chromaSubsamplingText ?? video.chromaSubsampling
                  ).includes(video.chromaSubsamplingPosition) &&
                  ` (${video.chromaSubsamplingPosition})`}
              </span>
            )}
            {video.colorRange && (
              <span className="text-muted-foreground text-xs font-normal break-all">
                {video.colorRange}
              </span>
            )}
          </div>
        </MediaDetailItem>
      )}

      {video.bitDepth && (
        <MediaDetailItem
          label="Bit Depth"
          value={video.bitDepthText ?? `${video.bitDepth} bits`}
        />
      )}

      {(video.scanType ?? video.standard) && (
        <MediaDetailItem label="Scan Type">
          <div className="flex flex-col">
            {video.standard && (
              <span className="text-foreground/85 font-semibold">
                {video.standard}
              </span>
            )}
            {video.scanType && (
              <span
                className={
                  video.standard
                    ? "text-muted-foreground text-xs font-normal"
                    : "text-foreground/85 font-semibold"
                }
              >
                {video.scanType}
              </span>
            )}
            {video.scanStoreMethod && (
              <span className="text-muted-foreground text-xs font-normal">
                {video.scanStoreMethod}
              </span>
            )}
            {video.scanOrder && (
              <span className="text-muted-foreground text-xs font-normal">
                {Match.value(video.scanOrder).pipe(
                  Match.when("TFF", () => "Top Field First"),
                  Match.when("BFF", () => "Bottom Field First"),
                  Match.orElse((scanOrder) => scanOrder)
                )}
              </span>
            )}
          </div>
        </MediaDetailItem>
      )}

      {(() => {
        const libName = video.encodedLibraryName
        const libVersion = video.encodedLibraryVersion
        const fullLib = video.encodedLibrary

        let displayMain = libName
        let displaySub = libVersion

        if (!displayMain && fullLib) {
          // Fallback: try to split "x264 - core 123"
          const match = /^(.*?) - (.*)$/.exec(fullLib)

          if (match) {
            const [, main, sub] = match
            displayMain = main
            displaySub = sub
          } else {
            displayMain = fullLib
          }
        }

        if (!displayMain) {
          return null
        }

        return (
          <MediaDetailItem label="Encoded Library">
            <div className="flex flex-col">
              <span className="text-foreground/85 font-semibold">
                {displayMain}
              </span>
              {displaySub && (
                <span className="text-muted-foreground text-xs font-normal break-all">
                  {displaySub}
                </span>
              )}
            </div>
          </MediaDetailItem>
        )
      })()}

      {video.codecConfigurationBox && (
        <MediaDetailItem
          label="Codec Configuration Box"
          value={video.codecConfigurationBox}
        >
          <span className="text-foreground/85 text-sm font-medium break-all">
            {video.codecConfigurationBox}
          </span>
        </MediaDetailItem>
      )}
    </div>
  )
})
