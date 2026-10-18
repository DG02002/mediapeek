import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"

const noop = () => undefined

const createMatchMediaList = (media: string): MediaQueryList => ({
  matches: media === "(min-width: 768px)",
  media,
  onchange: null,
  addListener: noop,
  removeListener: noop,
  addEventListener: noop,
  removeEventListener: noop,
  dispatchEvent: () => false,
})

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  value: (media: string) => createMatchMediaList(media),
})

Object.defineProperty(window, "scrollTo", {
  configurable: true,
  value: noop,
})

afterEach(cleanup)
