import { useEffect, useState } from 'react';

export function useClipboardSuggestion(currentUrl: string | undefined) {
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [ignoredUrl, setIgnoredUrl] = useState<string | null>(null);

  useEffect(() => {
    const checkClipboard = async () => {
      try {
        // Purity Check: Reading from an external source (clipboard) is a side effect, so it belongs in useEffect.
        // We also check for focus to avoid browser security errors/warnings.
        if (typeof document !== 'undefined' && !document.hasFocus()) return;

        const text = await navigator.clipboard.readText();
        if (!text) return;

        const trimmed = text.trim();
        if (
          trimmed.startsWith('http') &&
          trimmed !== currentUrl && // Don't suggest what is already in the input
          trimmed !== ignoredUrl && // Don't suggest what the user explicitly ignored
          trimmed.length < 2000
        ) {
          setClipboardUrl(trimmed);
        } else {
          setClipboardUrl(null);
        }
      } catch {
        // Silent catch: Permissions or focus issues are expected in some contexts.
      }
    };

    if (typeof window !== 'undefined') {
      checkClipboard();
      window.addEventListener('focus', checkClipboard);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', checkClipboard);
      }
    };
  }, [currentUrl, ignoredUrl]);

  const ignoreClipboard = () => {
    if (clipboardUrl) {
      setIgnoredUrl(clipboardUrl);
      setClipboardUrl(null);
    }
  };

  const clearClipboard = () => {
    setClipboardUrl(null);
  };

  return {
    clipboardUrl,
    ignoreClipboard,
    clearClipboard,
  };
}
