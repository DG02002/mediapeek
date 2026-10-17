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

afterEach(cleanup)
