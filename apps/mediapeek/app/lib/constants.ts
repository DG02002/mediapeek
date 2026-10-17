export function getTurnstileSiteKey(): string {
  const fallbackSiteKey = import.meta.env.DEV ? "1x00000000000000000000AA" : ""

  if (typeof window !== "undefined") {
    return (
      (window.ENV.TURNSTILE_SITE_KEY ??
        import.meta.env.VITE_TURNSTILE_SITE_KEY) ||
      fallbackSiteKey
    )
  }

  return import.meta.env.VITE_TURNSTILE_SITE_KEY || fallbackSiteKey
}
