import { useState } from "react"

import { Button } from "~/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import type { ClipboardPermission } from "~/features/analyze/use-clipboard-url"

interface ClipboardPermissionDialogProps {
  clipboardPermission: ClipboardPermission
  open: boolean
  onAllow: () => Promise<boolean>
  onOpenChange: (open: boolean) => void
}

export function ClipboardPermissionDialog({
  clipboardPermission,
  open,
  onAllow,
  onOpenChange,
}: ClipboardPermissionDialogProps) {
  const [isRequesting, setIsRequesting] = useState(false)
  const isDenied = clipboardPermission === "denied"

  const requestAccess = async () => {
    setIsRequesting(true)

    try {
      if (await onAllow()) {
        onOpenChange(false)
      }
    } finally {
      setIsRequesting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enable clipboard suggestions</DialogTitle>
          <DialogDescription>
            {isDenied
              ? "Your browser blocked clipboard access. Allow clipboard access for MediaPeek in the site settings, then try again."
              : "MediaPeek can offer a copied media URL above the input. It reads the clipboard only after you allow access."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Not now
          </Button>
          <Button
            type="button"
            disabled={isRequesting}
            onClick={() => void requestAccess()}
          >
            {isDenied ? "Try again" : "Allow clipboard access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
