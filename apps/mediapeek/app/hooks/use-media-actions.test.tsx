import { renderHook, waitFor } from "@testing-library/react"
import { act } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import type { AnalysisSession } from "~/features/analyze/analysis-session"
import { CLIPBOARD_ACCESS_BLOCKED_MESSAGE } from "~/lib/clipboard"

import { useMediaActions, type MediaActionsServices } from "./use-media-actions"

const outputMock = vi.fn<Pick<AnalysisSession, "output">["output"]>()

const safeClipboardWriteMock =
  vi.fn<MediaActionsServices["safeClipboardWrite"]>()

const uploadToPrivateBinMock =
  vi.fn<MediaActionsServices["uploadToPrivateBin"]>()

const services: MediaActionsServices = {
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

  it("requests copy output through the shared session", async () => {
    outputMock.mockResolvedValue("text-output")

    const { result } = renderHook(() =>
      useMediaActions({
        data: {},
        url: "https://example.com/video.mp4",
        session: { output: outputMock },
        requestTurnstileToken: vi.fn<() => Promise<string | null>>(),
        services,
      })
    )

    await act(async () => {
      result.current.handleCopy("text", "Text")
    })
    await waitFor(() => {
      expect(outputMock).toHaveBeenCalledOnce()
    })

    await act(async () => {
      result.current.handleCopy("text", "Text")
    })

    await waitFor(() => {
      expect(outputMock).toHaveBeenCalledTimes(2)
      expect(safeClipboardWriteMock).toHaveBeenCalledTimes(2)
    })
  })

  it("shows an error when clipboard access is blocked", async () => {
    safeClipboardWriteMock.mockImplementation(
      async (_textPromise, _onSuccess, onError) => {
        onError?.(new Error("NotAllowedError"))
      }
    )

    const { result } = renderHook(() =>
      useMediaActions({
        data: { text: "General" },
        url: "https://example.com/video.mp4",
        session: { output: outputMock },
        services,
      })
    )

    act(() => result.current.handleCopy("text", "Text"))

    await waitFor(() => {
      expect(services.toastError).toHaveBeenCalledWith("Copy Failed", {
        description: CLIPBOARD_ACCESS_BLOCKED_MESSAGE,
      })
    })
  })

  it("caches share urls by format after first upload", async () => {
    outputMock.mockResolvedValue("<xml />")
    uploadToPrivateBinMock.mockResolvedValue({
      url: "https://privatebin.net/?abc#key",
      deleteUrl: "https://privatebin.net/?pasteid=abc&deletetoken=def",
    })

    const { result } = renderHook(() =>
      useMediaActions({
        data: {},
        url: "https://example.com/video.mp4",
        session: { output: outputMock },
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
    expect(outputMock).toHaveBeenCalledTimes(1)
    expect(uploadToPrivateBinMock).toHaveBeenCalledTimes(1)
  })

  it("shares empty output as data", async () => {
    uploadToPrivateBinMock.mockResolvedValue({
      url: "https://privatebin.net/?empty#key",
      deleteUrl: "https://privatebin.net/?pasteid=empty&deletetoken=token",
    })

    const { result } = renderHook(() =>
      useMediaActions({
        data: { text: "" },
        url: "https://example.com/video.mp4",
        session: { output: outputMock },
        services,
      })
    )

    await expect(result.current.getShareUrl("text", "Text")).resolves.toBe(
      "https://privatebin.net/?empty#key"
    )
    expect(outputMock).not.toHaveBeenCalled()
    expect(uploadToPrivateBinMock).toHaveBeenCalledWith("")
  })
})
