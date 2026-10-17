import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"

import {
  fetchAnalyzeFormat,
  type AnalyzeClientResult,
} from "../lib/analyze-client"
import { clientLog } from "../lib/client-logger"
import { safeClipboardWrite } from "../lib/clipboard"
import { uploadToPrivateBin } from "../lib/privatebin"
import { useHapticFeedback } from "./use-haptic"

export interface MediaActionsServices {
  fetchAnalyzeFormat: (options: {
    url: string
    format: string
    requestTurnstileToken?: () => Promise<string | null>
  }) => Promise<AnalyzeClientResult>
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
  fetchAnalyzeFormat,
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
  requestTurnstileToken?: () => Promise<string | null>
  services?: MediaActionsServices
}

export function useMediaActions({
  data,
  url,
  requestTurnstileToken,
  services = defaultServices,
}: UseMediaActionsProps) {
  const fetchedData = useRef<Record<string, string>>({})
  const sharedUrls = useRef<Record<string, string>>({})
  const { triggerSuccess } = useHapticFeedback()
  const [isSharing, setIsSharing] = useState(false)

  const fetchContent = useCallback(
    async (format: string, label: string) => {
      const { [format]: initialContent } = data

      let content: string | undefined =
        initialContent ?? fetchedData.current[format]

      if (!content) {
        const toastId = services.toastLoading(`Generating ${label}...`)

        try {
          const result = await services.fetchAnalyzeFormat({
            url,
            format,
            requestTurnstileToken,
          })

          if (!result.ok) {
            throw new Error(result.message)
          }

          const { content: resultContent } = result
          content = resultContent

          fetchedData.current[format] = content
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
    [data, requestTurnstileToken, services, url]
  )

  const handleCopy = useCallback(
    (format: string, label: string) => {
      const contentPromise = fetchContent(format, label).then(
        (content: string | null | undefined) => {
          if (!content) {
            if (content === undefined) {
              services.toastError(`No ${label} Data Available`)
            }

            throw new Error("No content found")
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
        }
      )
    },
    [fetchContent, services, triggerSuccess]
  )

  const getShareUrl = useCallback(
    async (format: string, label: string) => {
      // Return cached URL if available
      if (sharedUrls.current[format]) {
        return sharedUrls.current[format]
      }

      const content = await fetchContent(format, label)

      if (!content) {
        if (typeof content === "undefined") {
          services.toastError(`No ${label} Data Available`)
        }

        throw new Error("No content found")
      }

      const toastId = services.toastLoading(
        `Encrypting and Uploading ${label}...`
      )

      setIsSharing(true)

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
      } finally {
        setIsSharing(false)
      }
    },
    [fetchContent, services]
  )

  return { handleCopy, getShareUrl, isSharing }
}
