import { fireEvent, render, screen } from "@testing-library/react"
import { act } from "react"
import { describe, expect, it, vi } from "vitest"

import { ClipboardPermissionDialog } from "./clipboard-permission-dialog"

describe("ClipboardPermissionDialog", () => {
  it("explains a denied permission and leaves the dialog open after retry fails", async () => {
    const onAllow = vi.fn(async () => false)
    const onOpenChange = vi.fn()

    render(
      <ClipboardPermissionDialog
        clipboardPermission="denied"
        open
        onAllow={onAllow}
        onOpenChange={onOpenChange}
      />
    )

    expect(
      screen.getByText(/your browser blocked clipboard access/i)
    ).toBeTruthy()

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    })

    expect(onAllow).toHaveBeenCalledOnce()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it("closes after clipboard access is allowed", async () => {
    const onOpenChange = vi.fn()

    render(
      <ClipboardPermissionDialog
        clipboardPermission="prompt"
        open
        onAllow={async () => true}
        onOpenChange={onOpenChange}
      />
    )

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Allow clipboard access" })
      )
    })

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
