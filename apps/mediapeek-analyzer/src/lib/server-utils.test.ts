import { describe, expect, it } from "vitest"

import { validateUrl } from "./server-utils"

const blockedIpv4Hosts = [
  "127.0.0.1",
  "0x7f.0.0.1",
  "0177.0.0.1",
  "2130706433",
  "0x7f000001",
  "017700000001",
  "10.0.0.1",
  "0xa.0.0.1",
  "012.0.0.1",
  "167772161",
  "0x0a000001",
  "01200000001",
  "192.168.1.1",
  "0xc0.0xa8.0x1.0x1",
  "0300.0250.01.01",
  "3232235777",
  "0xc0a80101",
  "030052000401",
]

// Workerd URL parsing is pinned in the web Worker runtime test:
// apps/mediapeek/app/lib/url-canonicalization.server.test.ts.
describe("validateUrl", () => {
  it.each(blockedIpv4Hosts)("rejects blocked IPv4 encoding %s", (host) => {
    expect(() => validateUrl(`https://${host}/media.mp4`)).toThrow(
      /local, private, or reserved/
    )
  })

  it.each([
    "8.8.8.8",
    "0x8.0x8.0x8.0x8",
    "010.010.010.010",
    "134744072",
    "0x08080808",
    "01002004010",
  ])("accepts public IPv4 encoding %s", (host) => {
    expect(() => validateUrl(`https://${host}/media.mp4`)).not.toThrow()
  })

  it.each(["[::ffff:127.0.0.1]", "[fc00::1]", "[fe80::1]"])(
    "rejects blocked IPv6 address %s",
    (host) => {
      expect(() => validateUrl(`https://${host}/media.mp4`)).toThrow(
        /local, private, or reserved/
      )
    }
  )

  it("rejects IPv6 zone identifiers and malformed colon hosts", () => {
    expect(() => validateUrl("https://[fe80::1%25eth0]/media.mp4")).toThrow()
    expect(() => validateUrl("https://[1:2:3:4:5:6:7:8:9]/media.mp4")).toThrow()
  })

  it.each(["localhost", "localhost.localdomain", "ip6-localhost"])(
    "rejects local hostname %s",
    (host) => {
      expect(() => validateUrl(`https://${host}/media.mp4`)).toThrow(
        /local, private, or reserved/
      )
    }
  )

  it.each(["example.com", "media.example.org"])(
    "accepts normal hostname %s",
    (host) => {
      expect(() => validateUrl(`https://${host}/media.mp4`)).not.toThrow()
    }
  )
})
