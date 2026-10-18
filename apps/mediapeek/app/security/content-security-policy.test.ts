import { describe, expect, it } from "vitest"

import { createContentSecurityPolicy } from "./content-security-policy"

describe("createContentSecurityPolicy", () => {
  it("omits Turnstile origins when Turnstile is disabled", () => {
    const policy = createContentSecurityPolicy({
      isDevelopment: false,
      turnstileEnabled: false,
    })

    expect(policy).not.toContain("challenges.cloudflare.com")
    expect(policy).toContain("frame-src 'self';")
  })

  it("allows Turnstile scripts and frames when enabled", () => {
    const policy = createContentSecurityPolicy({
      isDevelopment: false,
      turnstileEnabled: true,
    })

    expect(policy).toContain(
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: https://challenges.cloudflare.com;"
    )
    expect(policy).toContain(
      "frame-src 'self' https://challenges.cloudflare.com;"
    )
  })
})
