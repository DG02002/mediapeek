import { renderHook, waitFor } from "@testing-library/react"
import { act } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { useMediaActions, type MediaActionsServices } from "./use-media-actions"

const fetchAnalyzeFormatMock =
  vi.fn<MediaActionsServices["fetchAnalyzeFormat"]>()

const safeClipboardWriteMock =
  vi.fn<MediaActionsServices["safeClipboardWrite"]>()

const uploadToPrivateBinMock =
  vi.fn<MediaActionsServices["uploadToPrivateBin"]>()

const services: MediaActionsServices = {
  fetchAnalyzeFormat: fetchAnalyzeFormatMock,
  safeClipboardWrite: safeClipboardWriteMock,
  uploadToPrivateBin: uploadToPrivateBinMock,
  toastLoading: vi.fn(() => "toast-id"),
  toastDismiss: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  logError: vi.fn(),
}

describe("useMediaActions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    safeClipboardWriteMock.mockImplementation(
      async (textPromise, onSuccess) => {
        await textPromise
        onSuccess?.()
      }
    )
  })

  it("caches generated copy payload by format", async () => {
    fetchAnalyzeFormatMock.mockResolvedValue({
      ok: true,
      content: "text-output",
      retriedWithTurnstile: false,
    })

    const { result } = renderHook(() =>
      useMediaActions({
        data: {},
        url: "https://example.com/video.mp4",
        requestTurnstileToken: vi.fn<() => Promise<string | null>>(),
        services,
      })
    )

    await act(async () => {
      result.current.handleCopy("text", "Text")
    })
    await waitFor(() => {
      expect(fetchAnalyzeFormatMock).toHaveBeenCalledTimes(1)
    })

    await act(async () => {
      result.current.handleCopy("text", "Text")
    })

    await waitFor(() => {
      expect(fetchAnalyzeFormatMock).toHaveBeenCalledTimes(1)
      expect(safeClipboardWriteMock).toHaveBeenCalledTimes(2)
    })
  })

  it("caches share urls by format after first upload", async () => {
    fetchAnalyzeFormatMock.mockResolvedValue({
      ok: true,
      content: "<xml />",
      retriedWithTurnstile: false,
    })
    uploadToPrivateBinMock.mockResolvedValue({
      url: "https://privatebin.net/?abc#key",
      deleteUrl: "https://privatebin.net/?pasteid=abc&deletetoken=def",
    })

    const { result } = renderHook(() =>
      useMediaActions({
        data: {},
        url: "https://example.com/video.mp4",
        requestTurnstileToken: vi.fn<() => Promise<string | null>>(),
        services,
      })
    )

    let firstUrl = ""
    await act(async () => {
      firstUrl = (await result.current.getShareUrl("xml", "XML")) ?? ""
    })

    let secondUrl = ""
    await act(async () => {
      secondUrl = (await result.current.getShareUrl("xml", "XML")) ?? ""
    })

    expect(firstUrl).toBe("https://privatebin.net/?abc#key")
    expect(secondUrl).toBe("https://privatebin.net/?abc#key")
    expect(fetchAnalyzeFormatMock).toHaveBeenCalledTimes(1)
    expect(uploadToPrivateBinMock).toHaveBeenCalledTimes(1)
  })
})
