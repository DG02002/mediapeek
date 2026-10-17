import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getClipboardUrl, useClipboardUrl } from "./use-clipboard-url"

const originalClipboard = navigator.clipboard
const readText = vi.fn<() => Promise<string>>()

describe("getClipboardUrl", () => {
  it("trims a copied HTTP URL", () => {
    expect(
      getClipboardUrl("  https://example.com/video.mp4  ", undefined, null)
    ).toBe("https://example.com/video.mp4")
  })

  it("ignores the current URL, dismissed URL, and non-HTTP values", () => {
    expect(
      getClipboardUrl(
        "https://example.com/video.mp4",
        "https://example.com/video.mp4",
        null
      )
    ).toBeNull()
    expect(
      getClipboardUrl(
        "https://example.com/video.mp4",
        undefined,
        "https://example.com/video.mp4"
      )
    ).toBeNull()
    expect(getClipboardUrl("javascript:alert(1)", undefined, null)).toBeNull()
    expect(getClipboardUrl("not a URL", undefined, null)).toBeNull()
  })
})

describe("useClipboardUrl", () => {
  beforeEach(() => {
    readText.mockReset()
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText },
    })
  })

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    })
  })

  it("offers a copied URL after access is allowed", async () => {
    readText.mockResolvedValue("https://example.com/video.mp4")
    const { result } = renderHook(() => useClipboardUrl(undefined))

    await act(async () => {
      expect(await result.current.requestClipboardAccess()).toBe(true)
    })

    expect(result.current.clipboardPermission).toBe("granted")
    expect(result.current.clipboardUrl).toBe("https://example.com/video.mp4")
  })

  it("reports a browser permission denial and clears the suggestion", async () => {
    readText.mockRejectedValue(
      new DOMException("Clipboard access was denied", "NotAllowedError")
    )
    const { result } = renderHook(() => useClipboardUrl(undefined))

    await act(async () => {
      expect(await result.current.requestClipboardAccess()).toBe(false)
    })

    expect(result.current.clipboardPermission).toBe("denied")
    expect(result.current.clipboardUrl).toBeNull()
  })
})
