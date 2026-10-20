import { describe, expect, it, vi } from "vitest"

import { copyShareLinkToClipboard } from "./options-menu"

describe("copyShareLinkToClipboard", () => {
  it("shows an error when copying a share link is blocked", async () => {
    const writeText = vi
      .fn<(text: string) => Promise<void>>()
      .mockRejectedValue(new Error("NotAllowedError"))

    const toastSuccess = vi.fn()
    const toastError = vi.fn()

    await expect(
      copyShareLinkToClipboard("https://privatebin.net/?paste#key", {
        writeText,
        toastSuccess,
        toastError,
      })
    ).resolves.toBe(false)

    expect(writeText).toHaveBeenCalledWith("https://privatebin.net/?paste#key")
    expect(toastSuccess).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledWith("Copy Failed", {
      description: "Clipboard access was blocked. Try again.",
    })
  })
})
