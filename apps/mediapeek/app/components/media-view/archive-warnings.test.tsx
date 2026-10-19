import { render, screen } from "@testing-library/react"
import React from "react"
import { describe, expect, it } from "vitest"

import { parseMediaReport } from "~/features/reports/media-report"

import { MediaHeader } from "./media-header"
import { VideoTrackItem } from "./video-track-item"

const archiveSizingWarning =
  "Archive-backed analysis could not verify the inner file size. File size and bitrate may be inaccurate."

const parseReport = (tracks: unknown[]) => {
  const result = parseMediaReport({
    json: JSON.stringify({ media: { track: tracks } }),
    sourceUrl: "https://example.com/archive",
  })

  if (!result.ok) {
    throw new Error(result.error.message)
  }

  return result.report
}

describe("archive warning UI", () => {
  it("shows the archive estimate tooltip in the header when file size is estimated", () => {
    const report = parseReport([
      {
        "@type": "General",
        CompleteName: "inner-video.mkv",
        FileSize_String: "999 MiB",
        Duration_String: "47 min",
        Archive_Name: "outer.zip",
        Archive_Sizing_Warning: archiveSizingWarning,
      },
    ])

    render(
      <MediaHeader
        report={report}
        isTextView={false}
        setIsTextView={() => {}}
        showOriginalTitles={false}
        setShowOriginalTitles={() => {}}
        rawData={{}}
        url="https://example.com/archive"
        session={{ output: async () => "" }}
        onExportPng={async () => {}}
        isExportingPng={false}
      />
    )

    expect(screen.getByLabelText(/may be inaccurate/i)).toBeTruthy()
  })

  it("shows the archive estimate tooltip in the video bitrate row", () => {
    const report = parseReport([
      { "@type": "General", Archive_Sizing_Warning: archiveSizingWarning },
      {
        "@type": "Video",
        Format: "AVC",
        Width: 1920,
        Height: 800,
        BitRate_String: "9 589 kb/s",
      },
    ])

    const [video] = report.videos

    if (!video) {
      throw new Error("The test report did not contain a video track.")
    }

    render(
      <VideoTrackItem
        video={video}
        archiveSizingWarning={archiveSizingWarning}
      />
    )

    expect(screen.getByLabelText(/may be inaccurate/i)).toBeTruthy()
  })
})
