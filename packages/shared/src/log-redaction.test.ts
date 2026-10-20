import { describe, expect, it } from "vitest"

import { redactSensitiveUrl, summarizeSensitiveToken } from "./log-redaction"

describe("redactSensitiveUrl", () => {
  it("redacts known sensitive query params", () => {
    const redacted = redactSensitiveUrl(
      "https://example.com/video.mkv?token=abc123&x-amz-signature=xyz&sig=abc&signature=def&expires=10&foo=bar"
    )

    expect(redacted).toContain("token=%5BREDACTED%5D")
    expect(redacted).toContain("x-amz-signature=%5BREDACTED%5D")
    expect(redacted).toContain("sig=%5BREDACTED%5D")
    expect(redacted).toContain("signature=%5BREDACTED%5D")
    expect(redacted).toContain("expires=%5BREDACTED%5D")
    expect(redacted).toContain("foo=bar")
  })
})

describe("summarizeSensitiveToken", () => {
  it("returns metadata only", () => {
    expect(summarizeSensitiveToken(" abc ")).toEqual({
      tokenPresent: true,
      tokenLength: 3,
    })
    expect(summarizeSensitiveToken("")).toEqual({
      tokenPresent: false,
      tokenLength: 0,
    })
  })
})
