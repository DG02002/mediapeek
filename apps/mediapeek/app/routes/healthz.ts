import { cloudflareContext } from "~/lib/cloudflare-context.server"

import type { Route } from "./+types/healthz"

export const loader = ({ context }: Route.LoaderArgs) => {
  const { env } = context.get(cloudflareContext)

  return Response.json(
    {
      ok: true,
      commit: env.COMMIT_HASH ?? null,
      version: env.SERVICE_VERSION ?? null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  )
}
