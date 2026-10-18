import {
  resolveRuntimeConfig,
  type RuntimeConfig,
} from "@mediapeek/shared/runtime-config"
import { createRequestHandler, RouterContextProvider } from "react-router"

import { cloudflareContext } from "../app/lib/cloudflare-context.server"

const requestHandlers = new Map<
  "production" | "development",
  ReturnType<typeof createRequestHandler>
>()

const getRequestHandler = (runtimeConfig: RuntimeConfig) => {
  const mode: "production" | "development" =
    runtimeConfig.appEnv === "production" ? "production" : "development"

  let handler = requestHandlers.get(mode)

  if (!handler) {
    handler = createRequestHandler(
      () => import("virtual:react-router/server-build"),
      mode
    )
    requestHandlers.set(mode, handler)
  }

  return handler
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const runtimeConfig = resolveRuntimeConfig(env)
    const requestHandler = getRequestHandler(runtimeConfig)
    const loadContext = new RouterContextProvider()
    loadContext.set(cloudflareContext, { env, ctx, runtimeConfig })

    // Default React Router handler
    try {
      return await requestHandler(request, loadContext)
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("No route matches URL")
      ) {
        console.warn(
          JSON.stringify({
            severity: "WARNING",
            errorClass: "ROUTE_NOT_FOUND",
            requestId: request.headers.get("cf-ray") ?? crypto.randomUUID(),
            message: error.message,
            path: url.pathname,
          })
        )

        return new Response("Not Found", { status: 404 })
      }

      throw error
    }
  },
} satisfies ExportedHandler<Env>
