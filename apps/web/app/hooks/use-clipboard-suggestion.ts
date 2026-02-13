import { useCallback, useEffect, useState } from 'react';

export function useClipboardSuggestion(currentUrl: string | undefined) {
  const [clipboardUrl, setClipboardUrl] = useState<string | null>(null);
  const [ignoredUrl, setIgnoredUrl] = useState<string | null>(null);

  const checkClipboard = useCallback(async () => {
    try {
      if (typeof document !== 'undefined' && !document.hasFocus()) return;

      const text = await navigator.clipboard.readText();
      if (!text) return;

      const trimmed = text.trim();
      if (
        trimmed.startsWith('http') &&
        trimmed !== currentUrl &&
        trimmed !== ignoredUrl &&
        trimmed.length < 2000
      ) {
        setClipboardUrl(trimmed);
      } else {
        setClipboardUrl(null);
      }
    } catch {
      // Silent catch: Permissions or focus issues are expected in some contexts.
    }
  }, [currentUrl, ignoredUrl]);

  /**
   * Track if browser supports `clipboard-read` permission query (Chromium).
   * Used to enable lazy-read on focus only for supported browsers to avoid Safari's "Paste" bubble.
   */
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [isClipboardApiSupported, setIsClipboardApiSupported] = useState(false);

  useEffect(() => {
    const attemptAutoRead = async () => {
      try {
        const nav = navigator as Partial<Navigator> & {
          permissions?: Permissions;
        };
        if (nav.permissions?.query) {
          const result = await nav.permissions.query({
            name: 'clipboard-read' as PermissionName,
          });

          setIsClipboardApiSupported(true);

          if (result.state === 'granted') {
            setIsPermissionGranted(true);
            void checkClipboard();
          } else if (result.state === 'prompt') {
            // Do not read on load. Wait for user interaction (focus).
            setIsPermissionGranted(false);
          }

          // Listen for change (e.g. user revoked/granted elsewhere)
          result.onchange = () => {
            setIsPermissionGranted(result.state === 'granted');
          };
        }
      } catch {
        // Ignored
      }
    };

    if (typeof window !== 'undefined') {
      void attemptAutoRead();
      window.addEventListener('focus', () => {
        void attemptAutoRead();
      });
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', () => {
          void attemptAutoRead();
        });
      }
    };
  }, [checkClipboard]);

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
    checkClipboard,
    ignoreClipboard,
    clearClipboard,
    isPermissionGranted,
    isClipboardApiSupported,
  };
}
