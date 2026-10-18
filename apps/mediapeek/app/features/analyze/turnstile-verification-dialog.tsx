"use client"

import type { Ref } from "react"

import {
  TurnstileWidget,
  type TurnstileWidgetHandle,
} from "~/components/turnstile-widget"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"

interface TurnstileVerificationDialogProps {
  readonly open: boolean
  readonly widgetRef: Ref<TurnstileWidgetHandle>
  readonly onOpenChange: (open: boolean) => void
  readonly onVerify: (token: string) => void
  readonly onError: () => void
  readonly onExpire: () => void
}

export const TurnstileVerificationDialog = ({
  open,
  widgetRef,
  onOpenChange,
  onVerify,
  onError,
  onExpire,
}: TurnstileVerificationDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Verify Before Analysis</DialogTitle>
        <DialogDescription>
          Complete the security check to continue.
        </DialogDescription>
      </DialogHeader>
      <div className="flex min-h-[65px] justify-center">
        <TurnstileWidget
          ref={widgetRef}
          onVerify={onVerify}
          onError={onError}
          onExpire={onExpire}
        />
      </div>
    </DialogContent>
  </Dialog>
)
