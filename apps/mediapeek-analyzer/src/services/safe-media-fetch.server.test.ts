import { afterEach, describe, expect, it, vi } from "vitest"

import { validateUrl } from "../lib/server-utils"
import { safeMediaFetch } from "./safe-media-fetch.server"

describe("outbound media URL policy", () => {
  it.each([
    "file:///etc/passwd",
    "ftp://example.com/file",
    "https://user:pass@example.com/file",
    "http://127.0.0.1",
    "http://10.0.0.1",
    "http://100.64.0.1",
    "http://169.254.169.254",
    "http://172.16.0.1",
    "http://192.168.1.1",
    "http://192.0.2.1",
    "http://224.0.0.1",
    "http://[::]",
    "http://[::1]",
    "http://[fc00::1]",
    "http://[fe80::1]",
    "http://[ff00::1]",
    "http://[2001:db8::1]",
    "http://[::ffff:127.0.0.1]",
  ])("rejects %s", (url) =>
    expect(() => validateUrl(url)).toThrow(/Invalid URL/)
  )

  it.each(["https://example.com/media.mp4", "http://8.8.8.8/file"])(
    "accepts %s",
    (url) => {
      expect(() => validateUrl(url)).not.toThrow()
    }
  )
})

describe("safeMediaFetch redirects", () => {
  afterEach(() => vi.restoreAllMocks())

  it("follows public and relative redirects while preserving range headers", async () => {
    const cancel = vi.fn()

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(new ReadableStream({ cancel }), {
          status: 302,
          headers: { location: "/next" },
        })
      )
      .mockResolvedValueOnce(new Response("media", { status: 200 }))

    const response = await safeMediaFetch("https://example.com/start", {
      headers: { range: "bytes=0-9" },
    })

    expect(await response.text()).toBe("media")
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [, redirectedCall] = fetchMock.mock.calls

    if (!redirectedCall) {
      throw new Error("Expected the redirected fetch call.")
    }

    const [redirectedInput, redirectedInit] = redirectedCall
    expect(redirectedInput).toBeInstanceOf(URL)

    if (!(redirectedInput instanceof URL)) {
      throw new Error("Expected the redirected fetch input to be a URL.")
    }

    expect(redirectedInput.href).toBe("https://example.com/next")
    expect(new Headers(redirectedInit?.headers).get("range")).toBe("bytes=0-9")
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it("rejects private redirects and missing locations", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "http://127.0.0.1/admin" },
      })
    )
    await expect(safeMediaFetch("https://example.com/start")).rejects.toThrow(
      /private, or reserved/
    )
    vi.restoreAllMocks()
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 302 })
    )
    await expect(safeMediaFetch("https://example.com/start")).rejects.toThrow(
      /Missing Location/
    )
  })

  it("limits redirect chains", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 302, headers: { location: "/again" } })
    )
    await expect(safeMediaFetch("https://example.com/start")).rejects.toThrow(
      /Too many/
    )
  })
})
