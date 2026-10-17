import { useCallback, useEffect, useState, useSyncExternalStore } from "react"

const subscribeToClipboardAvailability = () => () => undefined

const getClipboardAvailability = () => {
  const { clipboard } = navigator

  return clipboard ? "readText" in clipboard : false
}

const getServerClipboardAvailability = () => false

export function useClipboardSuggestion(currentUrl: string | undefined) {
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null)
  const [ignoredUrl, setIgnoredUrl] = useState<string | null>(null)
  const [isPermissionGranted, setIsPermissionGranted] = useState(false)

  const isClipboardApiSupported = useSyncExternalStore(
    subscribeToClipboardAvailability,
    getClipboardAvailability,
    getServerClipboardAvailability
  )

  const checkClipboard = useCallback(async () => {
    try {
      if (
        !document.hasFocus() ||
        !navigator.clipboard ||
        !("readText" in navigator.clipboard)
      ) {
        return
      }

      const text = await navigator.clipboard.readText()
      setIsPermissionGranted(true)

      if (!text) {
        setClipboardUrl(null)

        return
      }

      const trimmed = text.trim()

      if (
        trimmed.startsWith("http") &&
        trimmed !== currentUrl &&
        trimmed !== ignoredUrl &&
        trimmed.length < 2000
      ) {
        setClipboardUrl(trimmed)
      } else {
        setClipboardUrl(null)
      }
    } catch {
      // Clipboard access can fail when permission is denied or focus is lost.
    }
  }, [currentUrl, ignoredUrl])

  useEffect(() => {
    const handleFocus = () => {
      void checkClipboard()
    }

    window.addEventListener("focus", handleFocus)

    return () => {
      window.removeEventListener("focus", handleFocus)
    }
  }, [checkClipboard])

  const ignoreClipboard = () => {
    if (clipboardUrl) {
      setIgnoredUrl(clipboardUrl)
      setClipboardUrl(null)
    }
  }

  const clearClipboard = () => {
    setClipboardUrl(null)
  }

  return {
    clipboardUrl,
    checkClipboard,
    ignoreClipboard,
    clearClipboard,
    isPermissionGranted,
    isClipboardApiSupported,
  }
}
