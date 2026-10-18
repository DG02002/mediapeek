import { ArrowRight02Icon, Loading03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useEffect, useRef, useState } from "react"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { Button } from "~/components/ui/button"
import { ClipboardAccessIcon } from "~/features/analyze/clipboard-access-icon"
import type { ClipboardPermission } from "~/features/analyze/use-clipboard-url"
import { cn } from "~/lib/utils"

interface ClipboardPermissionDialogProps {
  clipboardPermission: ClipboardPermission
  open: boolean
  onAllow: () => Promise<boolean>
  onOpenChange: (open: boolean) => void
}

const getClipboardCursorClassName = (step: number) => {
  if (step === 0) {
    return "left-[78%] top-[75%] opacity-0"
  }

  if (step === 1) {
    return "left-[48%] top-[58%] opacity-100"
  }

  return "left-[48%] top-[32%] opacity-0"
}

export function ClipboardPermissionDialog({
  clipboardPermission,
  open,
  onAllow,
  onOpenChange,
}: ClipboardPermissionDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const [carouselStep, setCarouselStep] = useState(0)
  const [isRequesting, setIsRequesting] = useState(false)
  const isDenied = clipboardPermission === "denied"
  const step = open ? carouselStep : 0

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const interval = window.setInterval(
      () => setCarouselStep((current) => (current + 1) % 3),
      1900
    )

    return () => window.clearInterval(interval)
  }, [open])

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

  const preview = (
    <div className="flex w-full flex-col items-center">
      <div
        className="relative -mx-10 -mt-10 w-[calc(100%+5rem)] overflow-hidden rounded-t-4xl bg-muted/35 px-6 py-10 shadow-[inset_0_-1px_rgba(0,0,0,0.08)] dark:bg-black/30 dark:shadow-[inset_0_-1px_rgba(255,255,255,0.08)]"
        aria-hidden="true"
      >
        <div className="flex flex-col gap-4">
          <div
            aria-hidden={step < 2}
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none",
              step >= 2
                ? "grid-rows-[1fr] opacity-100"
                : "grid-rows-[0fr] opacity-0"
            )}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="w-full rounded-md px-1 py-2 text-left">
                <span className="shimmer shimmer-color-blue-500/60 shimmer-duration-900 shimmer-spread-24 block max-w-full truncate text-base font-normal text-primary">
                  https://video.example/aurora-station-1080p.mp4
                </span>
              </div>
            </div>
          </div>

          <div
            className={cn(
              "flex h-13.5 w-full items-center rounded-full border-2 bg-background/30 pl-5 pr-1 transition-colors duration-500",
              step >= 1 ? "border-blue-500" : "border-border"
            )}
          >
            <span className="flex-1 text-base text-muted-foreground">
              Paste link
            </span>
            <span className="flex size-11 items-center justify-center rounded-full bg-foreground/35 text-background">
              <HugeiconsIcon
                icon={ArrowRight02Icon}
                strokeWidth={2}
                className="size-6"
              />
            </span>
          </div>
        </div>

        <svg
          viewBox="0 0 28 28"
          className={cn(
            "absolute z-10 size-6 drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)] transition-[left,top,opacity] duration-700 ease-out motion-reduce:hidden",
            getClipboardCursorClassName(step)
          )}
        >
          <path
            d="M5 3.5 22.1 17l-8.4 1.2-4.6 7.1L5 3.5Z"
            fill="white"
            stroke="black"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <ClipboardAccessIcon className="mt-6 size-12" />
    </div>
  )

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        initialFocus={cancelRef}
        className="p-10 data-[size=default]:max-w-[calc(100%-2rem)] sm:data-[size=default]:max-w-md"
      >
        {preview}
        <AlertDialogHeader className="w-full min-w-0 place-items-center gap-4 text-center sm:place-items-center sm:text-center">
          <AlertDialogTitle className="w-full px-0 text-center text-2xl font-normal leading-tight sm:px-10 sm:text-3xl">
            {isDenied ? "Allow clipboard access" : "Paste links faster"}
          </AlertDialogTitle>
          <AlertDialogDescription className="w-full min-w-0 break-words text-pretty text-center text-base text-muted-foreground">
            {isDenied
              ? "Your browser blocked clipboard access. Allow it for MediaPeek in the site settings, then try again."
              : "Allow clipboard access and MediaPeek can spot a copied media URL and offer it above this input. Nothing is submitted until you choose to analyze it."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="mt-4 flex w-full flex-col gap-3">
          <Button
            type="button"
            size="lg"
            className="h-13.5 w-full"
            disabled={isRequesting}
            onClick={() => void requestAccess()}
          >
            {isRequesting && (
              <HugeiconsIcon
                icon={Loading03Icon}
                data-icon="inline-start"
                aria-hidden="true"
                className="size-4 animate-spin"
              />
            )}
            {isDenied ? "Try again" : "Allow clipboard access"}
          </Button>
          <AlertDialogCancel
            ref={cancelRef}
            variant="outline"
            size="lg"
            className="h-13.5 w-full border-muted-foreground/20"
            disabled={isRequesting}
          >
            Not now
          </AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
