import { useCallback, useEffect, useState, useSyncExternalStore } from "react"

export type ClipboardPermission =
  | "prompt"
  | "granted"
  | "denied"
  | "unsupported"

type ClipboardReadResult = {
  allowed: boolean
  text: string | null
}

const subscribeToClipboardAvailability = () => () => undefined

const getClipboardAvailability = () => Boolean(globalThis.navigator?.clipboard)

const getServerClipboardAvailability = () => false

export function getClipboardUrl(
  text: string,
  currentUrl: string | undefined,
  ignoredUrl: string | null
) {
  const trimmed = text.trim()

  if (
    !trimmed ||
    trimmed.length >= 2000 ||
    trimmed === currentUrl ||
    trimmed === ignoredUrl
  ) {
    return null
  }

  try {
    const url = new URL(trimmed)

    return url.protocol === "http:" || url.protocol === "https:"
      ? trimmed
      : null
  } catch {
    return null
  }
}

export function useClipboardUrl(currentUrl: string | undefined) {
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null)
  const [ignoredUrl, setIgnoredUrl] = useState<string | null>(null)

  const [permission, setPermission] =
    useState<Exclude<ClipboardPermission, "unsupported">>("prompt")

  const isClipboardApiSupported = useSyncExternalStore(
    subscribeToClipboardAvailability,
    getClipboardAvailability,
    getServerClipboardAvailability
  )

  const readClipboard = useCallback(async (): Promise<ClipboardReadResult> => {
    if (!getClipboardAvailability()) {
      setClipboardUrl(null)

      return { allowed: false, text: null }
    }

    try {
      const text = await navigator.clipboard.readText()

      setPermission("granted")
      setClipboardUrl(getClipboardUrl(text, currentUrl, ignoredUrl))

      return { allowed: true, text }
    } catch (error) {
      if (
        error instanceof DOMException &&
        (error.name === "NotAllowedError" || error.name === "SecurityError")
      ) {
        setPermission("denied")
        setClipboardUrl(null)
      }

      return { allowed: false, text: null }
    }
  }, [currentUrl, ignoredUrl])

  const checkClipboard = useCallback(async () => {
    if (permission !== "granted" || !document.hasFocus()) {
      return
    }

    await readClipboard()
  }, [permission, readClipboard])

  const requestClipboardAccess = useCallback(async () => {
    const result = await readClipboard()

    return result.allowed
  }, [readClipboard])

  const pasteClipboardText = useCallback(async () => {
    const result = await readClipboard()

    return result.text
  }, [readClipboard])

  const ignoreClipboard = useCallback(() => {
    if (clipboardUrl) {
      setIgnoredUrl(clipboardUrl)
      setClipboardUrl(null)
    }
  }, [clipboardUrl])

  const clearClipboard = useCallback(() => {
    setClipboardUrl(null)
  }, [])

  useEffect(() => {
    if (permission !== "granted") {
      return undefined
    }

    const onFocus = () => void checkClipboard()
    const onPaste = () => void checkClipboard()

    window.addEventListener("focus", onFocus)
    document.addEventListener("paste", onPaste)

    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("paste", onPaste)
    }
  }, [checkClipboard, permission])

  const clipboardPermission: ClipboardPermission = isClipboardApiSupported
    ? permission
    : "unsupported"

  return {
    clipboardUrl,
    clipboardPermission,
    checkClipboard,
    clearClipboard,
    ignoreClipboard,
    isClipboardApiSupported,
    pasteClipboardText,
    requestClipboardAccess,
  }
}
