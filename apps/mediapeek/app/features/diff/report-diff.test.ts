import { describe, expect, it } from "vitest"

import type {
  AudioTrackReport,
  MediaReport,
  VideoTrackReport,
} from "~/features/library/media-report"

import { diffMediaReports, diffReportOutputs } from "./report-diff"

const emptyReport = (overrides: Partial<MediaReport> = {}): MediaReport => ({
  file: { displayName: "movie.mkv" },
  videos: [],
  audios: [],
  subtitles: [],
  chapters: [],
  accessibility: { sdh: false, closedCaptions: false, audioDescription: false },
  badges: [],
  ...overrides,
})

const video = (key: string, id?: string, width?: string): VideoTrackReport => ({
  key,
  id,
  width,
})

const audio = (key: string, id?: string): AudioTrackReport => ({
  key,
  id,
  language: "English",
  isDefault: false,
  isForced: false,
  objectCount: 0,
  globalStructure: {},
  presentations: [],
  signalGroups: [],
})

const emptyDiff = {
  added: [],
  removed: [],
  changed: [],
}

describe("report diff", () => {
  it("returns no changes for two empty normalized reports", () => {
    expect(diffMediaReports(emptyReport(), emptyReport())).toEqual(emptyDiff)
  })

  it("reports scalar changes and added or removed fields", () => {
    const before = emptyReport({
      file: { displayName: "before.mkv", size: "1 GiB" },
      videos: [video("video:1", "1", "1920")],
    })

    const after = emptyReport({
      file: { displayName: "after.mkv" },
      videos: [video("video:1", "1", "3840")],
    })

    expect(diffMediaReports(before, after)).toEqual({
      added: [],
      removed: [{ section: "general", path: "file.size", value: "1 GiB" }],
      changed: [
        {
          section: "general",
          path: "file.displayName",
          before: "before.mkv",
          after: "after.mkv",
        },
        {
          section: "video",
          path: 'video[id="1"].width',
          before: "1920",
          after: "3840",
        },
      ],
    })
  })

  it("matches tracks by ID across reordering", () => {
    const before = emptyReport({
      videos: [video("video:1", "1", "1920"), video("video:2", "2", "1280")],
    })

    const after = emptyReport({
      videos: [video("video:2", "2", "1280"), video("video:1", "1", "1920")],
    })

    expect(diffMediaReports(before, after)).toEqual(emptyDiff)
  })

  it("falls back to type and index when a track has no matching ID", () => {
    const before = emptyReport({
      videos: [video("video:1", undefined, "1920")],
    })

    const after = emptyReport({ videos: [video("video:1", undefined, "1280")] })

    expect(diffMediaReports(before, after).changed).toEqual([
      {
        section: "video",
        path: "video[index=1].width",
        before: "1920",
        after: "1280",
      },
    ])
  })

  it("reports unmatched tracks as additions and removals", () => {
    const empty = emptyReport()
    const withAudio = emptyReport({ audios: [audio("audio:1", "1")] })
    const added = diffMediaReports(empty, withAudio)
    const removed = diffMediaReports(withAudio, empty)

    expect(removed.removed).toContainEqual({
      section: "audio",
      path: 'audio[id="1"].language',
      value: "English",
    })
    expect(added.added).toContainEqual({
      section: "audio",
      path: 'audio[id="1"].language',
      value: "English",
    })
  })

  it("treats order-insensitive arrays as sets and matches chapters by time", () => {
    const before = emptyReport({
      badges: ["HDR", "AV1"],
      chapters: [
        { time: "00:00:00.000", name: "Opening" },
        { time: "00:10:00.000", name: "Old chapter" },
      ],
    })

    const after = emptyReport({
      badges: ["AV1", "HDR"],
      chapters: [
        { time: "00:00:00.000", name: "New opening" },
        { time: "00:20:00.000", name: "New chapter" },
      ],
    })

    const diff = diffMediaReports(before, after)

    expect(diff.added).toContainEqual({
      section: "chapters",
      path: 'chapters[time="00:20:00.000"]',
      value: "New chapter",
    })
    expect(diff.removed).toContainEqual({
      section: "chapters",
      path: 'chapters[time="00:10:00.000"]',
      value: "Old chapter",
    })
    expect(diff.changed).toContainEqual({
      section: "chapters",
      path: 'chapters[time="00:00:00.000"].name',
      before: "Opening",
      after: "New opening",
    })
    expect(diff.added).toHaveLength(1)
    expect(diff.removed).toHaveLength(1)
  })

  it("returns a side-specific error for empty or malformed saved JSON", () => {
    const validReport = {
      sourceUrl: "https://example.com/movie.mkv",
      json: JSON.stringify({ media: { track: [{ "@type": "General" }] } }),
    }

    expect(
      diffReportOutputs({ sourceUrl: validReport.sourceUrl }, validReport)
    ).toMatchObject({ ok: false, side: "before" })
    expect(
      diffReportOutputs(validReport, { ...validReport, json: "{not-json" })
    ).toMatchObject({ ok: false, side: "after" })
  })
})
