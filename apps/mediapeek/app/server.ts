import {
  isDevelopmentEnvironment,
  resolveRuntimeConfig,
  type RuntimeConfig,
} from "@mediapeek/shared/runtime-config"
import type { Register as StartRegister } from "@tanstack/react-start"
import handler, { createServerEntry } from "@tanstack/react-start/server-entry"
import { env as workerEnv } from "cloudflare:workers"

import { DEVTOOLS_WELL_KNOWN_PATH } from "~/constants"
import { withRequestLogging } from "~/lib/request-logger.server"
import { createContentSecurityPolicy } from "~/security/content-security-policy"

const applySecurityHeaders = (
  response: Response,
  runtimeConfig: RuntimeConfig,
  nonce: string
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
      nonce,
    })
  )
  headers.set("X-Content-Type-Options", "nosniff")
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  headers.set("X-Frame-Options", "SAMEORIGIN")
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
    const nonce = crypto.randomUUID()
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-mediapeek-csp-nonce", nonce)
    const requestWithNonce = new Request(request, { headers: requestHeaders })

    const context: StartRegister["server"]["requestContext"] & {
      readonly request: Request
      readonly nonce: string
    } = {
      env: workerEnv,
      runtimeConfig,
      request: requestWithNonce,
      nonce,
    }

    const response = await handler.fetch(requestWithNonce, { ...opts, context })

    return applySecurityHeaders(response, runtimeConfig, nonce)
  },
})

export default withRequestLogging(entry.fetch)
