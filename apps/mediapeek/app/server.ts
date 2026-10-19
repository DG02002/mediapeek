import {
  isDevelopmentEnvironment,
  resolveRuntimeConfig,
  type RuntimeConfig,
} from "@mediapeek/shared/runtime-config"
import type { Register as StartRegister } from "@tanstack/react-start"
import handler, { createServerEntry } from "@tanstack/react-start/server-entry"
import { env as workerEnv } from "cloudflare:workers"
import { withEvlog } from "evlog/workers"

import { createContentSecurityPolicy } from "~/security/content-security-policy"

const DEVTOOLS_WELL_KNOWN_PATH =
  "/.well-known/appspecific/com.chrome.devtools.json"

const applySecurityHeaders = (
  response: Response,
  runtimeConfig: RuntimeConfig
) => {
  const contentType = response.headers.get("content-type") ?? ""

  if (!contentType.includes("text/html")) {
    return response
  }

  const headers = new Headers(response.headers)
  headers.set(
    "Content-Security-Policy",
    createContentSecurityPolicy({
      isDevelopment: isDevelopmentEnvironment(runtimeConfig.appEnv),
      turnstileEnabled: runtimeConfig.turnstileEnabled,
    })
  )
  headers.set("X-Content-Type-Options", "nosniff")
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  headers.set("X-Frame-Options", "SAMEORIGIN")
  headers.set("X-XSS-Protection", "1; mode=block")
  headers.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  )
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

const entry = createServerEntry({
  async fetch(request, opts) {
    const url = new URL(request.url)

    if (url.pathname === DEVTOOLS_WELL_KNOWN_PATH) {
      return new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    const runtimeConfig = resolveRuntimeConfig(workerEnv)

    const context: StartRegister["server"]["requestContext"] & {
      readonly request: Request
    } = {
      env: workerEnv,
      runtimeConfig,
      request,
    }

    const response = await handler.fetch(request, { ...opts, context })

    return applySecurityHeaders(response, runtimeConfig)
  },
})

// /resource/analyze already emits its own richer per-request log through
// requestStorage and finalizeAnalyzeRequest; the rest are health or asset
// noise.
const UNLOGGED_PATH_PATTERNS = [
  "/resource/analyze",
  "/healthz",
  "/robots.txt",
  DEVTOOLS_WELL_KNOWN_PATH,
  "/_build/**",
  "/*.png",
  "/*.ico",
]

// The Workers fetch arguments flow straight into the Start entry, the same
// passthrough Cloudflare's custom-entrypoint guide uses for handler.fetch.
type EntryOptions = Parameters<typeof entry.fetch>[1]

export default withEvlog(
  (request, env: EntryOptions) => entry.fetch(request, env),
  {
    exclude: UNLOGGED_PATH_PATTERNS,
  }
)
