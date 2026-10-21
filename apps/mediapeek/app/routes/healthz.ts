import { resolveRuntimeConfig } from "@mediapeek/shared/runtime-config"
import { createFileRoute } from "@tanstack/react-router"

export const getHealthzResponse = (
  environment: Pick<
    Env,
    "ANALYZE_RATE_LIMITER" | "APP_ENV" | "COMMIT_HASH" | "SERVICE_VERSION"
  >
) => {
  const isProduction = resolveRuntimeConfig(environment).appEnv === "production"

  if (isProduction && environment.ANALYZE_RATE_LIMITER === undefined) {
    return Response.json(
      { ok: false, reason: "ANALYZE_RATE_LIMITER_MISSING" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }
    )
  }

  return Response.json(
    {
      ok: true,
      commit: environment.COMMIT_HASH ?? null,
      version: environment.SERVICE_VERSION ?? null,
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}

export const Route = createFileRoute("/healthz")({
  server: {
    handlers: {
      GET: ({ context }: { context: { env: Env } }) =>
        getHealthzResponse(context.env),
    },
  },
})
