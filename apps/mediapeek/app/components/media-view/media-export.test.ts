import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  MEDIA_EXPORT_DARK_BACKGROUND_COLOR,
  MEDIA_EXPORT_LIGHT_BACKGROUND_COLOR,
  MEDIA_EXPORT_SCALE,
} from "~/constants"

import {
  exportMediaReportAsPng,
  type MediaPngExportDependencies,
} from "./media-export"

const capturePngMock = vi.fn<MediaPngExportDependencies["capturePng"]>()

describe("exportMediaReportAsPng", () => {
  beforeEach(() => {
    capturePngMock.mockResolvedValue("data:image/png;base64,export")
  })

  afterEach(() => {
    capturePngMock.mockReset()
    vi.restoreAllMocks()
    document.documentElement.className = ""
    document.body.style.transition = ""
  })

  it("exports both themes and restores the page theme after each capture", async () => {
    const element = document.createElement("div")
    document.body.appendChild(element)
    document.documentElement.className = "dark app-theme"
    document.body.style.transition = "background-color 1s"
    const capturedDarkTheme: boolean[] = []
    const downloadedFilenames: string[] = []
    capturePngMock.mockImplementation(async () => {
      capturedDarkTheme.push(
        document.documentElement.classList.contains("dark")
      )

      return "data:image/png;base64,export"
    })

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {
        const downloadLink =
          document.body.querySelector<HTMLAnchorElement>("a[download]")

        if (downloadLink) {
          downloadedFilenames.push(downloadLink.download)
        }
      })

    await exportMediaReportAsPng(
      {
        element,
        filename: "sample/report.mkv",
        theme: "light",
      },
      {
        capturePng: capturePngMock,
      }
    )
    await exportMediaReportAsPng(
      {
        element,
        filename: "sample/report.mkv",
        theme: "dark",
      },
      {
        capturePng: capturePngMock,
      }
    )

    expect(capturePngMock).toHaveBeenNthCalledWith(1, element, {
      backgroundColor: MEDIA_EXPORT_LIGHT_BACKGROUND_COLOR,
      scale: MEDIA_EXPORT_SCALE,
    })
    expect(capturePngMock).toHaveBeenNthCalledWith(2, element, {
      backgroundColor: MEDIA_EXPORT_DARK_BACKGROUND_COLOR,
      scale: MEDIA_EXPORT_SCALE,
    })
    expect(capturedDarkTheme).toEqual([false, true])
    expect(downloadedFilenames).toEqual([
      "sample-report.mkv-light.png",
      "sample-report.mkv-dark.png",
    ])
    expect(clickSpy).toHaveBeenCalledTimes(2)
    expect(document.documentElement.className).toBe("dark app-theme")
    expect(document.body.style.transition).toBe("background-color 1s")

    clickSpy.mockRestore()
    element.remove()
  })
})
