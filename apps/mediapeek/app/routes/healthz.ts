import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/healthz")({
  server: {
    handlers: {
      GET: ({ context }: { context: { env: Env } }) =>
        Response.json(
          {
            ok: true,
            commit: context.env.COMMIT_HASH ?? null,
            version: context.env.SERVICE_VERSION ?? null,
          },
          { headers: { "Cache-Control": "no-store" } }
        ),
    },
  },
})
