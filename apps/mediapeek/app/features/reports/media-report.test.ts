import { describe, expect, it } from "vitest"

import { parseMediaReport } from "./media-report"

describe("Media report", () => {
  it("interprets file, tracks, archive state, chapters, and accessibility", () => {
    const parsed = parseMediaReport({
      json: JSON.stringify({
        creatingLibrary: {
          name: "MediaInfoLib",
          version: "25.04",
          url: "https://mediaarea.net",
        },
        media: {
          track: [
            {
              "@type": "General",
              CompleteName: "inner.mkv",
              Format: "Matroska",
              Duration_String: "1 h 2 min",
              FileSize_String: "4.2 GiB",
              Archive_Name: "outer.zip",
              Archive_Sizing_Status: "estimated",
              Archive_Sizing_Source: "unknown",
              Archive_Sizing_Warning:
                "Archive-derived values may be inaccurate.",
            },
            {
              "@type": "Video",
              "@typeorder": "1",
              Format: "AVC",
              Format_Info: "Advanced Video Codec",
              Width: "1920",
              Height: "1080",
            },
            {
              "@type": "Audio",
              "@typeorder": "2",
              Format: "AAC",
              Language_String: "English",
              Title: "Audio Description",
            },
            {
              "@type": "Text",
              "@typeorder": "3",
              Format: "UTF-8",
              Language_String: "English",
              Title: "English SDH",
            },
            {
              "@type": "Menu",
              extra: {
                _00_10_00_000: "en:Second chapter",
                _00_00_00_000: "en:First chapter",
              },
            },
          ],
        },
      }),
      sourceUrl: "https://example.com/outer.zip",
    })

    expect(parsed).toEqual({
      ok: true,
      report: expect.objectContaining({
        file: {
          displayName: "inner.mkv",
          duration: "1 h 2 min",
          size: "4.2 GiB",
          archive: {
            name: "outer.zip",
            sizing: {
              confidence: "estimated",
              source: "unknown",
              warning: "Archive-derived values may be inaccurate.",
            },
          },
        },
        container: {
          format: expect.objectContaining({ name: "Matroska" }),
        },
        videos: [
          expect.objectContaining({
            key: "video:1",
            formatName: "AVC",
            formatInfo: "Advanced Video Codec",
            width: "1920",
            height: "1080",
          }),
        ],
        audios: [
          expect.objectContaining({
            key: "audio:2",
            language: "English",
            title: "Audio Description",
          }),
        ],
        subtitles: [
          expect.objectContaining({
            key: "subtitle:3",
            language: "English",
            title: "English SDH",
          }),
        ],
        chapters: [
          { time: "00:00:00.000", name: "First chapter" },
          { time: "00:10:00.000", name: "Second chapter" },
        ],
        accessibility: {
          audioDescription: true,
          closedCaptions: false,
          sdh: true,
        },
        engine: {
          name: "MediaInfoLib",
          version: "25.04",
          url: "https://mediaarea.net",
        },
      }),
    })
  })

  it.each([
    { json: "", code: "missing-json" },
    { json: "{not-json", code: "invalid-json" },
    { json: "{}", code: "invalid-document" },
  ])("returns $code instead of throwing", ({ json, code }) => {
    expect(parseMediaReport({ json, sourceUrl: "" })).toMatchObject({
      ok: false,
      error: { code },
    })
  })
})
