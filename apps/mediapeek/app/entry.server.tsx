import { isDevelopmentEnvironment } from "@mediapeek/shared/runtime-config"
import { isbot } from "isbot"
import { renderToReadableStream } from "react-dom/server"
import {
  ServerRouter,
  type EntryContext,
  type RouterContextProvider,
} from "react-router"

import { cloudflareContext } from "~/lib/cloudflare-context.server"
import { createContentSecurityPolicy } from "~/security/content-security-policy"

type HandleRequestArguments = [
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext: RouterContextProvider,
]

export default async function handleRequest(...args: HandleRequestArguments) {
  const [
    request,
    initialResponseStatusCode,
    responseHeaders,
    routerContext,
    loadContext,
  ] = args

  let responseStatusCode = initialResponseStatusCode
  let shellRendered = false
  const userAgent = request.headers.get("user-agent")

  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} />,
    {
      onError(error) {
        responseStatusCode = 500

        if (shellRendered) {
          console.error(error)
        }
      },
    }
  )

  shellRendered = true

  // Ensure requests from bots and SPA Mode renders wait for all content to load before responding
  // https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
  if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
    await body.allReady
  }

  responseHeaders.set("Content-Type", "text/html")

  const cloudflare = loadContext.get(cloudflareContext)

  const isDevelopment = isDevelopmentEnvironment(
    cloudflare.runtimeConfig.appEnv
  )

  const contentSecurityPolicy = createContentSecurityPolicy({
    isDevelopment,
    turnstileEnabled: cloudflare.runtimeConfig.turnstileEnabled,
  })

  responseHeaders.set("Content-Security-Policy", contentSecurityPolicy)
  responseHeaders.set("X-Content-Type-Options", "nosniff")
  responseHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin")
  responseHeaders.set("X-Frame-Options", "SAMEORIGIN")
  responseHeaders.set("X-XSS-Protection", "1; mode=block")
  responseHeaders.set(
    "Strict-Transport-Security",
    "max-age=31536000; includeSubDomains; preload"
  )
  responseHeaders.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  )

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  })
}
