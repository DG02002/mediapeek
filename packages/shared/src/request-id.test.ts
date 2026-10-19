import { describe, expect, it } from "vitest"

import { getRequestId, REQUEST_ID_PATTERN } from "./request-id"

const createRequest = (headers: Record<string, string>) =>
  new Request("https://example.com/analyze", { headers })

describe("getRequestId", () => {
  it("prefers a valid x-request-id", () => {
    const request = createRequest({
      "x-request-id": "client-request-123",
      "x-mediapeek-request-id": "internal-request-123",
    })

    expect(getRequestId(request)).toBe("client-request-123")
  })

  it("uses a valid propagated request ID after an invalid x-request-id", () => {
    const request = createRequest({
      "x-request-id": "invalid/request-id",
      "x-mediapeek-request-id": "internal-request-123",
    })

    expect(getRequestId(request)).toBe("internal-request-123")
  })

  it("uses a valid Cloudflare ray after invalid request IDs", () => {
    const request = createRequest({
      "x-request-id": "invalid/request-id",
      "x-mediapeek-request-id": "invalid/request-id",
      "cf-ray": "ray-id-123",
    })

    expect(getRequestId(request)).toBe("ray-id-123")
  })

  it("generates a UUID when every incoming request ID is invalid", () => {
    const request = createRequest({
      "x-request-id": "invalid/request-id",
      "x-mediapeek-request-id": "invalid/request-id",
      "cf-ray": "invalid/request-id",
    })

    const requestId = getRequestId(request)

    expect(REQUEST_ID_PATTERN.test(requestId)).toBe(true)
    expect(requestId).not.toBe("invalid/request-id")
  })
})
