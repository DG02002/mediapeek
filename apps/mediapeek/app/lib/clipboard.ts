export const CLIPBOARD_ACCESS_BLOCKED_MESSAGE =
  "Clipboard access was blocked. Try again."

/**
 * Writes text to the clipboard, handling async generation in a way that
 * satisfies Safari's User Activation API limits (using ClipboardItem with Promise).
 */
export async function safeClipboardWrite(
  textOrPromise: string | Promise<string>,
  onSuccess?: () => void,
  onError?: (cause: Error) => void
) {
  try {
    // If it's already a string, just write it directly.
    // This is always safe if called during a click handler.
    if (textOrPromise instanceof Promise) {
      if ("ClipboardItem" in globalThis && "write" in navigator.clipboard) {
        const mime = "text/plain"

        const blobPromise = textOrPromise.then(
          (text) => new Blob([text], { type: mime })
        )

        const item = new ClipboardItem({ [mime]: blobPromise })

        await navigator.clipboard.write([item])
      } else {
        const text = await textOrPromise
        await navigator.clipboard.writeText(text)
      }
    } else {
      await navigator.clipboard.writeText(textOrPromise)
    }

    onSuccess?.()
  } catch (error) {
    console.error("Clipboard write failed:", error)
    const cause = error instanceof Error ? error : new Error(String(error))
    onError?.(cause)

    // If the error was specifically about ClipboardItem not supporting Promises (e.g. older Firefox),
    // we could try the fallback, but getting distinguish errors is hard.
    // The most common error here is "NotAllowedError" which means we lost activation.
  }
}
