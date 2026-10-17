import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import React from "react"
import { describe, expect, it, vi } from "vitest"

import type { AnalyzeClientResult } from "~/lib/analyze-client"

import { MediaView } from "./media-view"

type FetchAnalyzeFormat = (options: {
  url: string
  format: string
  requestTurnstileToken?: () => Promise<string | null>
}) => Promise<AnalyzeClientResult>

describe("MediaView", () => {
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
