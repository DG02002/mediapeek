import { describe, expect, it } from "vitest"

import {
  redactSensitiveLogData,
  redactSensitiveUrl,
  summarizeSensitiveToken,
} from "./log-redaction"

describe("redactSensitiveUrl", () => {
  it("redacts known sensitive query params", () => {
    const redacted = redactSensitiveUrl(
      "https://example.com/video.mkv?token=abc123&x-amz-signature=xyz&foo=bar"
    )

    expect(redacted).toContain("token=%5BREDACTED%5D")
    expect(redacted).toContain("x-amz-signature=%5BREDACTED%5D")
    expect(redacted).toContain("foo=bar")
  })
})

describe("redactSensitiveLogData", () => {
  it("redacts sensitive object fields and nested urls", () => {
    const payload = {
      token: "abcdef",
      url: "https://cdn.example.com/a.mkv?sig=abc&expires=10",
      nested: {
        authorization: "Bearer token",
      },
    }

    const redacted = redactSensitiveLogData(payload)

    expect(redacted).toStrictEqual({
      token: "[REDACTED]",
      nested: {
        authorization: "[REDACTED]",
      },
      url: "https://cdn.example.com/a.mkv?sig=[REDACTED]&expires=[REDACTED]",
    })
  })

  it("preserves dates and undefined values", () => {
    const date = new Date("2026-10-17T00:00:00.000Z")
    const redacted = redactSensitiveLogData({ date, missing: undefined })

    expect(redacted).toStrictEqual({ date, missing: undefined })
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
