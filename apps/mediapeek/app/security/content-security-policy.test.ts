import { describe, expect, it } from "vitest"

import { createContentSecurityPolicy } from "./content-security-policy"

describe("createContentSecurityPolicy", () => {
  it("omits Turnstile origins when Turnstile is disabled", () => {
    const policy = createContentSecurityPolicy({
      isDevelopment: false,
      turnstileEnabled: false,
      nonce: "test-nonce",
    })

    expect(policy).not.toContain("challenges.cloudflare.com")
    expect(policy).toContain("frame-src 'self';")
    expect(policy).toContain("script-src 'self' 'nonce-test-nonce';")

    const scriptSource =
      policy
        .split(";")
        .find((directive) => directive.startsWith("script-src ")) ?? ""

    expect(scriptSource).not.toContain("'unsafe-inline'")
    expect(scriptSource).not.toContain("'unsafe-eval'")
    expect(scriptSource).not.toContain("https:")
  })

  it("allows Turnstile scripts and frames when enabled", () => {
    const policy = createContentSecurityPolicy({
      isDevelopment: false,
      turnstileEnabled: true,
      nonce: "test-nonce",
    })

    expect(policy).toContain(
      "script-src 'self' 'nonce-test-nonce' https://challenges.cloudflare.com;"
    )
    expect(policy).toContain(
      "frame-src 'self' https://challenges.cloudflare.com;"
    )
  })

  it("leaves the development script policy unchanged", () => {
    const policy = createContentSecurityPolicy({
      isDevelopment: true,
      turnstileEnabled: false,
      nonce: "test-nonce",
    })

    expect(policy).toContain(
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:;"
    )
  })
})
