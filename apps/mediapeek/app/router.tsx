import { createRouter } from "@tanstack/react-router"
import { createIsomorphicFn } from "@tanstack/react-start"
import { getRequest } from "@tanstack/react-start/server"

import { routeTree } from "./routeTree.gen"

const getRequestNonce = createIsomorphicFn()
  .client(() => undefined)
  .server(() => {
    try {
      return getRequest().headers.get("x-mediapeek-csp-nonce") ?? undefined
    } catch (error) {
      // Router tests create the router outside a Start request.
      if (
        error instanceof Error &&
        error.message.startsWith("No StartEvent found")
      ) {
        return undefined
      }

      throw error
    }
  })

export const getRouter = () => {
  const nonce = getRequestNonce()

  const router = createRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
    ssr: nonce ? { nonce } : undefined,
  })

  return router
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
