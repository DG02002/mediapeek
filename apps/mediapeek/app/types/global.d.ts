

declare const __BUILD_NUMBER__: string

interface Window {
  ENV: {
    TURNSTILE_SITE_KEY?: string
    TURNSTILE_ENABLED: boolean
    APP_ENV: string
  }
}
