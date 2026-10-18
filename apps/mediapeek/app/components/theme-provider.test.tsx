import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router"
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

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
  let prefersDark = false
  let systemMedia: MediaQueryList | undefined
  let systemListenerAdded = false
  const originalMatchMedia = window.matchMedia

  beforeEach(() => {
    localStorage.removeItem("theme")
    document.documentElement.classList.remove("light", "dark")
    prefersDark = false
    systemMedia = undefined
    systemListenerAdded = false

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: (query: string) => {
        const media = originalMatchMedia(query)

        if (query === "(prefers-color-scheme: dark)") {
          const events = new EventTarget()
          const addEventListener = events.addEventListener.bind(events)

          Object.defineProperty(media, "matches", {
            configurable: true,
            get: () => prefersDark,
          })
          Object.defineProperties(media, {
            addEventListener: {
              configurable: true,
              value: (
                type: string,
                listener: EventListenerOrEventListenerObject | null,
                options?: boolean | AddEventListenerOptions
              ) => {
                systemListenerAdded = true
                addEventListener(type, listener, options)
              },
            },
            removeEventListener: {
              configurable: true,
              value: events.removeEventListener.bind(events),
            },
            dispatchEvent: {
              configurable: true,
              value: events.dispatchEvent.bind(events),
            },
          })
          systemMedia = media
        }

        return media
      },
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

  it("persists a selected theme across reloads and follows system changes", async () => {
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

    systemListenerAdded = false
    fireEvent.click(screen.getByRole("button", { name: "Auto" }))

    await waitFor(() => {
      expect(localStorage.getItem("theme")).toBe("system")
      expect(systemListenerAdded).toBe(true)
      expect(document.documentElement.classList.contains("light")).toBe(true)
    })

    prefersDark = true

    await act(async () => {
      prefersDark = true
      systemMedia?.dispatchEvent(new Event("change"))
    })

    await waitFor(() => {
      expect(document.documentElement.classList.contains("dark")).toBe(true)
    })
  })
})
