import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import { render } from "@testing-library/react"

import { routeTree } from "~/routeTree.gen"

export const renderRoute = async (initialEntry: string) => {
  window.ENV ??= { TURNSTILE_ENABLED: false, APP_ENV: "test" }

  const history = createMemoryHistory({ initialEntries: [initialEntry] })

  const router = createRouter({
    routeTree,
    history,
    defaultPreload: false,
  })

  await router.load()
  const rendered = render(<RouterProvider router={router} />)

  return { container: rendered.container, router }
}
