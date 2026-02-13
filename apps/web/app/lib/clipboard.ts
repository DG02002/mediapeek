/**
 * Writes text to the clipboard, handling async generation in a way that
 * satisfies Safari's User Activation API limits (using ClipboardItem with Promise).
 */
export async function safeClipboardWrite(
  textOrPromise: string | Promise<string>,
  onSuccess?: () => void,
  onError?: (error: unknown) => void,
) {
  try {
    // If it's already a string, just write it directly.
    // This is always safe if called during a click handler.
    if (typeof textOrPromise === 'string') {
      await navigator.clipboard.writeText(textOrPromise);
      onSuccess?.();
      return;
    }

    // It is a promise.
    // Try the modern ClipboardItem with Promise support (Safari 13.1+, Chrome 66+ partial, but Promise support is newer).
    // Safari specifically requires passing a Promise to ClipboardItem to keep the activation alive during fetch.
    if (
      typeof ClipboardItem !== 'undefined' &&
      'write' in navigator.clipboard
    ) {
      const mime = 'text/plain';
      const blobPromise = textOrPromise.then(
        (text) => new Blob([text], { type: mime }),
      );

      const item = new ClipboardItem({
        [mime]: blobPromise,
      });

      await navigator.clipboard.write([item]);
      onSuccess?.();
    } else {
      // Fallback: This will likely fail on Safari if the promise takes too long,
      // but it's the only option for browsers without ClipboardItem support.
      const text = await textOrPromise;
      await navigator.clipboard.writeText(text);
      onSuccess?.();
    }
  } catch (error) {
    console.error('Clipboard write failed:', error);
    onError?.(error);

    // If the error was specifically about ClipboardItem not supporting Promises (e.g. older Firefox),
    // we could try the fallback, but getting distinguish errors is hard.
    // The most common error here is "NotAllowedError" which means we lost activation.
  }
}
