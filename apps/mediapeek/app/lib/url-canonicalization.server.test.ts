import { describe, expect, it } from "vitest"

describe("URL canonicalization in workerd", () => {
  it.each(["0x7f.0.0.1", "0177.0.0.1", "2130706433", "0x7f000001", "127.1"])(
    "normalizes blocked IPv4 encoding %s to the loopback address",
    (host) => {
      expect(new URL(`http://${host}/`).hostname).toBe("127.0.0.1")
    }
  )

  it("normalizes a public octal IPv4 address", () => {
    expect(new URL("http://010.010.010.010/").hostname).toBe("8.8.8.8")
  })
})
