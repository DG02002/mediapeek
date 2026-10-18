import { describe, expect, it } from "vitest"

import { resolveSource } from "./source-resolver"

describe("resolveSource", () => {
  it.each([
    ["https://drive.google.com/file/d/file_123/view?usp=sharing", "file_123"],
    ["https://drive.google.com/file/d/file-456", "file-456"],
    ["https://drive.google.com/open?id=file_789", "file_789"],
    ["https://drive.google.com/uc?id=file_abc&export=download", "file_abc"],
  ])("resolves a supported Drive file URL: %s", (sourceUrl, fileId) => {
    const result = resolveSource(sourceUrl)

    expect(result.status).toBe("resolved")

    if (result.status !== "resolved") {
      throw new Error("Expected resolution")
    }

    expect(result.provider).toBe("google-drive")
    expect(result.targetUrl).toContain(
      `drive.usercontent.google.com/download?id=${fileId}`
    )
  })

  it("preserves a Drive resource key required by link-shared files", () => {
    const result = resolveSource(
      "https://drive.google.com/file/d/file_123/view?resourcekey=key_456"
    )

    expect(result.status).toBe("resolved")

    if (result.status !== "resolved") {
      throw new Error("Expected resolution")
    }

    expect(new URL(result.targetUrl).searchParams.get("resourcekey")).toBe(
      "key_456"
    )
  })

  it.each([
    [
      "https://drive.google.com/drive/folders/folder_123",
      "folder_not_supported",
    ],
    ["https://drive.google.com/drive/my-drive", "provider_page_not_supported"],
    ["https://1drv.ms/f/example", "provider_page_not_supported"],
    ["https://onedrive.live.com/?id=example", "provider_page_not_supported"],
  ])("rejects an unsupported hosted-source page: %s", (sourceUrl, code) => {
    const result = resolveSource(sourceUrl)

    expect(result.status).toBe("unsupported")

    if (result.status !== "unsupported") {
      throw new Error("Expected unsupported result")
    }

    expect(result.code).toBe(code)
  })

  it("leaves direct HTTP media targets unchanged", () => {
    const sourceUrl = "https://media.example.com/video.mp4?token=abc"
    expect(resolveSource(sourceUrl)).toMatchObject({
      status: "resolved",
      provider: "direct",
      targetUrl: sourceUrl,
    })
  })
})
