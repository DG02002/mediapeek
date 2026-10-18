import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "~/components/theme-provider"
import { ModeToggle } from "~/features/settings/mode-toggle"

const renderThemeProvider = async () => {
  const rootRoute = createRootRoute({
    component: () => (
      <ThemeProvider defaultTheme="system" storageKey="theme">
        <ModeToggle />
      </ThemeProvider>
    ),
  })

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] }),
    defaultPreload: false,
  })

  await router.load()
  render(<RouterProvider router={router} />)
}

describe("theme persistence", () => {
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    localStorage.removeItem("theme")
    document.documentElement.classList.remove("light", "dark")
    document.documentElement.style.colorScheme = ""

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    })
  })

  afterEach(() => {
    cleanup()
    localStorage.removeItem("theme")
    document.documentElement.classList.remove("light", "dark")
    document.documentElement.style.colorScheme = ""
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: originalMatchMedia,
    })
  })

  it("persists the selected theme across renders", async () => {
    await renderThemeProvider()

    fireEvent.click(screen.getByRole("button", { name: "Dark" }))

    await waitFor(() => {
      expect(localStorage.getItem("theme")).toBe("dark")
      expect(document.documentElement.classList.contains("dark")).toBe(true)
    })

    cleanup()
    await renderThemeProvider()

    expect(localStorage.getItem("theme")).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
  })
})
