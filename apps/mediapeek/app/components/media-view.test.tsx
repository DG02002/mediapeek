import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"
import { describe, expect, it, vi } from "vitest"

import type { AnalyzeClientResult } from "~/lib/analyze-client"
import { clientLog } from "~/lib/client-logger"

import { MediaView } from "./media-view"

type FetchAnalyzeFormat = (options: {
  url: string
  format: string
  requestTurnstileToken?: () => Promise<string | null>
}) => Promise<AnalyzeClientResult>

describe("MediaView", () => {
  it("logs and displays JSON parse failures", async () => {
    const logError = vi.spyOn(clientLog, "error")

    render(
      <MediaView data={{ json: "{" }} url="https://example.com/file.mp4" />
    )

    const alert = await screen.findByRole("alert")

    expect(alert.textContent).toContain(
      "Unable to read this Media Report. Try analyzing the URL again."
    )
    await waitFor(() => {
      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "media_report_json_parse_failed",
          error: expect.any(String),
        })
      )
    })

    logError.mockRestore()
  })

  it("renders sections from the parsed Media Report", () => {
    render(
      <MediaView
        data={{
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
                  CompleteName: "movie.mkv",
                  Format: "Matroska",
                  Duration_String: "47 min",
                },
                {
                  "@type": "Video",
                  Format: "AVC",
                  Width: 1920,
                  Height: 1080,
                },
                {
                  "@type": "Audio",
                  Format: "AAC",
                  Language_String: "English",
                  Channels: 2,
                },
                {
                  "@type": "Text",
                  Format: "UTF-8",
                  Language_String: "English",
                  Title: "English SDH",
                },
                {
                  "@type": "Menu",
                  extra: { _00_00_00_000: "en:Opening" },
                },
              ],
            },
          }),
        }}
        url="https://example.com/movie.mkv"
      />
    )

    expect(screen.getByRole("heading", { name: "movie.mkv" })).toBeTruthy()
    expect(screen.getAllByText("Matroska")).toHaveLength(2)
    expect(screen.getAllByText("1920 x 1080")).toHaveLength(2)
    expect(screen.getByRole("heading", { name: "Chapters" })).toBeTruthy()
    expect(screen.getAllByText("Opening")).toHaveLength(2)
    expect(screen.getAllByText("SDH Subtitles")).toHaveLength(2)
    expect(screen.getAllByText("MediaInfoLib 25.04")).toHaveLength(2)
  })

  it("loads text output once when toggled into text view", async () => {
    const fetchFormat = vi.fn<FetchAnalyzeFormat>().mockResolvedValue({
      ok: true,
      content: "General\nComplete name : file.mp4",
      retriedWithTurnstile: false,
    })

    const requestTurnstileToken = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValue("token-123")

    render(
      <MediaView
        data={{
          json: JSON.stringify({
            media: {
              track: [{ "@type": "General", CompleteName: "file.mp4" }],
            },
          }),
        }}
        url="https://example.com/file.mp4"
        requestTurnstileToken={requestTurnstileToken}
        fetchFormat={fetchFormat}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Options" }))
    fireEvent.click(await screen.findByText("View as Text"))

    await waitFor(() => {
      expect(fetchFormat).toHaveBeenCalledTimes(1)
      expect(fetchFormat).toHaveBeenCalledWith({
        url: "https://example.com/file.mp4",
        format: "text",
        requestTurnstileToken,
      })
    })
    await waitFor(() => {
      expect(screen.getByText(/Complete name : file\.mp4/i)).toBeTruthy()
    })

    fireEvent.click(screen.getByRole("button", { name: "Options" }))
    fireEvent.click(await screen.findByText("View as Text"))
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
    expect(fetchFormat).toHaveBeenCalledTimes(1)
  })
})
