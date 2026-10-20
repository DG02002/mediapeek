import type { AnalysisOutputId } from "@mediapeek/shared/analysis-output-formats"
import { useCallback, useMemo, useRef } from "react"
import { toast } from "sonner"

import {
  createBrowserAnalysisSessionForOutputs,
  type AnalysisSession,
} from "../features/analyze/analysis-session"
import { clientLog } from "../lib/client-logger"
import {
  CLIPBOARD_ACCESS_BLOCKED_MESSAGE,
  safeClipboardWrite,
} from "../lib/clipboard"
import { uploadToPrivateBin } from "../lib/privatebin"
import { useHapticFeedback } from "./use-haptic"

export interface MediaActionsServices {
  safeClipboardWrite: typeof safeClipboardWrite
  uploadToPrivateBin: typeof uploadToPrivateBin
  toastLoading: (message: string) => string | number
  toastDismiss: (id?: string | number) => void
  toastError: (
    message: string,
    options?: { id?: string | number; description?: string }
  ) => void
  toastSuccess: (
    message: string,
    options?: { description?: string; duration?: number }
  ) => void
  logError: (entry: { event: string; format: string; error: string }) => void
}

const defaultServices: MediaActionsServices = {
  safeClipboardWrite,
  uploadToPrivateBin,
  toastLoading: (message) => toast.loading(message),
  toastDismiss: (id) => toast.dismiss(id),
  toastError: (message, options) => toast.error(message, options),
  toastSuccess: (message, options) => toast.success(message, options),
  logError: (entry) => clientLog.error(entry),
}

interface UseMediaActionsProps {
  data: Record<string, string>
  url: string
  session?: Pick<AnalysisSession, "output">
  requestTurnstileToken?: () => Promise<string | null>
  services?: MediaActionsServices
}

export function useMediaActions({
  data,
  url,
  session: providedSession,
  requestTurnstileToken,
  services = defaultServices,
}: UseMediaActionsProps) {
  const fallbackSession = useMemo(
    () => createBrowserAnalysisSessionForOutputs({ url, outputs: data }),
    [data, url]
  )

  const session = providedSession ?? fallbackSession
  const sharedUrls = useRef<Record<string, string>>({})
  const { triggerSuccess } = useHapticFeedback()

  const fetchContent = useCallback(
    async (format: AnalysisOutputId, label: string) => {
      const { [format]: initialContent } = data

      let content: string | null = initialContent ?? null

      if (content === null) {
        const toastId = services.toastLoading(`Generating ${label}...`)

        try {
          content = await session.output(format, requestTurnstileToken)

          services.toastDismiss(toastId)
        } catch (err) {
          services.logError({
            event: "media_format_generation_failed",
            format,
            error: err instanceof Error ? err.message : String(err),
          })
          services.toastError(`Unable to Generate ${label}`, {
            id: toastId,
            description: "Try again in a moment.",
          })

          return null
        }
      }

      if (format === "json" && content) {
        try {
          const parsed = JSON.parse(content)

          return JSON.stringify(parsed, null, 2)
        } catch {
          // If parsing fails, return original content
        }
      }

      return content
    },
    [data, requestTurnstileToken, services, session]
  )

  const handleCopy = useCallback(
    (format: AnalysisOutputId, label: string) => {
      const noContentError = new Error("No content found")

      const contentPromise = fetchContent(format, label).then(
        (content: string | null) => {
          if (content === null) {
            throw noContentError
          }

          return content
        }
      )

      void services.safeClipboardWrite(
        contentPromise,
        () => {
          triggerSuccess()
          services.toastSuccess("Copied to Clipboard", {
            description: `${label} data was copied.`,
            duration: 2000,
          })
        },
        (err) => {
          services.logError({
            event: "media_copy_failed",
            format,
            error: err instanceof Error ? err.message : String(err),
          })

          if (err !== noContentError) {
            services.toastError("Copy Failed", {
              description: CLIPBOARD_ACCESS_BLOCKED_MESSAGE,
            })
          }
        }
      )
    },
    [fetchContent, services, triggerSuccess]
  )

  const getShareUrl = useCallback(
    async (format: AnalysisOutputId, label: string) => {
      // Return cached URL if available
      if (sharedUrls.current[format]) {
        return sharedUrls.current[format]
      }

      const content = await fetchContent(format, label)

      if (content === null) {
        throw new Error("No content found")
      }

      const toastId = services.toastLoading(
        `Encrypting and Uploading ${label}...`
      )

      try {
        const { url: newUrl } = await services.uploadToPrivateBin(content)
        sharedUrls.current[format] = newUrl
        services.toastDismiss(toastId)

        return newUrl
      } catch (err) {
        services.logError({
          event: "media_report_share_failed",
          format,
          error: err instanceof Error ? err.message : String(err),
        })
        services.toastError("Unable to Upload", {
          id: toastId,
          description: "Could not upload to PrivateBin. Try again in a moment.",
        })
        throw err
      }
    },
    [fetchContent, services]
  )

  return { handleCopy, getShareUrl }
}
