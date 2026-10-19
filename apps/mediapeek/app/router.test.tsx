import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { getRouter } from "./router"

describe("router intent preloading", () => {
  it("loads route data on link focus and reuses it for navigation", async () => {
    const loader = vi.fn(() => "loaded")

    // SAFETY: This test registers `/target` outside the app route tree.
    const rootRoute = createRootRoute({
      component: () => (
        <>
          <Link to={"/target" as never}>Target</Link>
          <Outlet />
        </>
      ),
    })

    const targetRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: "target",
      loader,
      component: () => <p>Loaded</p>,
    })

    const routeTree = rootRoute.addChildren([targetRoute])

    const applicationRouter = getRouter()

    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ["/"] }),
      defaultPreload: applicationRouter.options.defaultPreload,
      defaultPreloadStaleTime:
        applicationRouter.options.defaultPreloadStaleTime,
    })

    await router.load()
    render(<RouterProvider router={router} />)

    fireEvent.focus(screen.getByRole("link", { name: "Target" }))

    await waitFor(() => {
      expect(loader).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole("link", { name: "Target" }))

    expect(await screen.findByText("Loaded")).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/target")
    expect(loader).toHaveBeenCalledTimes(1)
  })
})
