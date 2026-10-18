"use client"

import { TurnstileVerificationDialog } from "~/features/analyze/turnstile-verification-dialog"
import type { TurnstileVerification } from "~/features/analyze/use-turnstile-verification"

interface TurnstileTokenDialogProps {
  readonly verification: TurnstileVerification
  readonly onCancel?: () => void
  readonly onError: () => void
  readonly onVerified?: (token: string) => void
}

export const TurnstileTokenDialog = ({
  verification,
  onCancel,
  onError,
  onVerified,
}: TurnstileTokenDialogProps) => {
  if (!verification.enabled) {
    return null
  }

  const { inputRef, widgetRef, isOpen, setIsOpen, settle } = verification

  const clearInput = () => {
    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  return (
    <>
      <input type="hidden" name="cf-turnstile-response" ref={inputRef} />
      <TurnstileVerificationDialog
        open={isOpen}
        widgetRef={widgetRef}
        onOpenChange={(open) => {
          setIsOpen(open)

          if (!open) {
            settle(null)
            onCancel?.()
          }
        }}
        onVerify={(token) => {
          if (inputRef.current) {
            inputRef.current.value = token
          }

          settle(token)
          setIsOpen(false)
          onVerified?.(token)
        }}
        onError={() => {
          clearInput()
          settle(null)
          setIsOpen(false)
          onError()
        }}
        onExpire={() => {
          clearInput()
          settle(null)
        }}
      />
    </>
  )
}
