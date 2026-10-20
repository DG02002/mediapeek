import { describe, expect, it } from "vitest"

import { validateUrl } from "./server-utils"

const blockedHosts = [
  { host: "0x7f.0.0.1", canonicalHost: "127.0.0.1" },
  { host: "0177.0.0.1", canonicalHost: "127.0.0.1" },
  { host: "2130706433", canonicalHost: "127.0.0.1" },
  { host: "0x7f000001", canonicalHost: "127.0.0.1" },
  { host: "127.1", canonicalHost: "127.0.0.1" },
]

describe("validateUrl in workerd", () => {
  it.each(blockedHosts)(
    "rejects $host after workerd canonicalizes it to $canonicalHost",
    ({ host, canonicalHost }) => {
      expect(new URL(`http://${host}/`).hostname).toBe(canonicalHost)
      expect(() => validateUrl(`http://${host}/media.mp4`)).toThrow(
        /local, private, or reserved/
      )
    }
  )

  it("accepts a public octal IPv4 address after canonicalization", () => {
    expect(new URL("http://010.010.010.010/").hostname).toBe("8.8.8.8")
    expect(() => validateUrl("http://010.010.010.010/media.mp4")).not.toThrow()
  })
})
