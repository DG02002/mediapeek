import { toast } from "sonner"
import { afterEach, describe, expect, it, vi } from "vitest"

import { CLIPBOARD_ACCESS_BLOCKED_MESSAGE } from "~/lib/clipboard"

import { copyShareLinkToClipboard } from "./options-menu"

let originalClipboard: PropertyDescriptor | undefined

afterEach(() => {
  if (originalClipboard) {
    Object.defineProperty(navigator, "clipboard", originalClipboard)
  } else {
    Reflect.deleteProperty(navigator, "clipboard")
  }

  originalClipboard = undefined
  vi.restoreAllMocks()
})

describe("copyShareLinkToClipboard", () => {
  it("shows an error when copying a share link is blocked", async () => {
    const writeText = vi
      .fn<(text: string) => Promise<void>>()
      .mockRejectedValue(new Error("NotAllowedError"))

    originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard")

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })

    const toastSuccess = vi.spyOn(toast, "success")
    const toastError = vi.spyOn(toast, "error")

    await expect(
      copyShareLinkToClipboard("https://privatebin.net/?paste#key")
    ).resolves.toBe(false)

    expect(writeText).toHaveBeenCalledWith("https://privatebin.net/?paste#key")
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith("Copy Failed", {
      description: CLIPBOARD_ACCESS_BLOCKED_MESSAGE,
    })
  })
})
