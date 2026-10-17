export function getTurnstileSiteKey(): string {
  if (typeof window !== "undefined") {
    return window.ENV.TURNSTILE_SITE_KEY ?? ""
  }

  return ""
}
