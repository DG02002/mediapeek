import { describe, expect, it } from "vitest"

import { cleanAudioTrackTitle, cleanSubtitleTrackTitle } from "./formatters"

describe("track title cleanup", () => {
  it("removes punctuation-heavy audio codec labels from titles", () => {
    expect(
      cleanAudioTrackTitle(
        "English DD+ E-AC-3 5.1 @ 640 kb/s",
        {
          Format: "E-AC-3",
          Format_Commercial_IfAny: "Dolby Digital Plus",
          BitRate_String: "640 kb/s",
          Channels_String: "6 channels",
        },
        "English"
      )
    ).toBeNull()
  })

  it("cleans preview-style hi-res lossless titles fully", () => {
    expect(
      cleanAudioTrackTitle(
        "Hi-Res Lossless",
        {
          Format: "FLAC",
          Compression_Mode: "Lossless",
          BitDepth: 24,
          SamplingRate: 96000,
        },
        "English"
      )
    ).toBeNull()
  })

  it("removes titles that duplicate the audio language exactly", () => {
    expect(
      cleanAudioTrackTitle(
        "English",
        {
          Format: "E-AC-3",
          Format_String: "E-AC-3 JOC",
          Format_Commercial_IfAny: "Dolby Digital Plus with Dolby Atmos",
          BitRate_String: "768 kb/s",
          Channels_String: "6 channels",
          SamplingRate_String: "48.0 kHz",
        },
        "English"
      )
    ).toBeNull()
  })

  it("keeps meaningful subtitle labels after cleanup", () => {
    expect(
      cleanSubtitleTrackTitle(
        "English SDH Subtitle",
        { Format: "UTF-8" },
        "English"
      )
    ).toBe("SDH")
  })
})
