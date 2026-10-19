import { createRouter } from "@tanstack/react-router"

import { routeTree } from "./routeTree.gen"

export const getRouter = () => {
  return createRouter({
    routeTree,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  })
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
