import { createThemeAction } from "remix-themes"

import { cloudflareContext } from "~/lib/cloudflare-context.server"

import { log } from "../lib/logger.server"
import { createThemeSessionResolverWithSecret } from "../sessions.server"
import type { Route } from "./+types/action.set-theme"

export const action = (args: Route.ActionArgs) => {
  const { context, request } = args
  const cloudflare = context.get(cloudflareContext)
  const sessionSecret = cloudflare.env.SESSION_SECRET?.trim()
  const { runtimeConfig } = cloudflare
  const requestId = request.headers.get("cf-ray") ?? crypto.randomUUID()

  if (!sessionSecret) {
    log(
      {
        severity: "WARNING",
        message: "SESSION_SECRET missing; theme action is disabled.",
        requestId,
        context: {
          errorClass: "THEME_CONTEXT_MISSING",
        },
      },
      { runtimeConfig }
    )

    return Response.json(
      {
        success: false,
        error: "Theme preferences are unavailable.",
      },
      { status: 503 }
    )
  }

  const resolver = createThemeSessionResolverWithSecret(
    sessionSecret,
    runtimeConfig.appEnv
  )

  return createThemeAction(resolver)(args)
}
