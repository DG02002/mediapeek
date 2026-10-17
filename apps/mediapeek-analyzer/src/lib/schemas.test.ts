import { analyzeSchema } from "@mediapeek/shared/schemas"
import { describe, expect, it } from "vitest"

describe("analyzeSchema", () => {
  it("validates a correct URL and applies default format", () => {
    const result = analyzeSchema["~standard"].validate({
      url: "https://example.com/video.mp4",
    })

    if (result instanceof Promise) {
      throw new Error("Expected sync validation")
    }

    expect("value" in result).toBe(true)

    if (!("value" in result)) {
      throw new Error("Expected schema parsing to succeed")
    }

    expect(result.value.url).toBe("https://example.com/video.mp4")
    expect(result.value.format).toEqual(["json"])
  })

  it("rejects an invalid URL", () => {
    const result = analyzeSchema["~standard"].validate({ url: "not-a-url" })

    if (result instanceof Promise) {
      throw new Error("Expected sync validation")
    }

    expect("issues" in result).toBe(true)

    if (!("issues" in result)) {
      throw new Error("Expected schema parsing to fail")
    }

    expect(result.issues?.[0]?.message).toBe("Invalid URL provided.")
  })

  it("accepts array-based formats", () => {
    const result = analyzeSchema["~standard"].validate({
      url: "https://example.com",
      format: ["object", "text"],
    })

    if (result instanceof Promise) {
      throw new Error("Expected sync validation")
    }

    expect("value" in result).toBe(true)

    if (!("value" in result)) {
      throw new Error("Expected schema parsing to succeed")
    }

    expect(result.value.format).toEqual(["json", "text"])
  })

  it.each(["file:///tmp/video.mp4", "ftp://example.com/video.mp4"])(
    "rejects unsupported URL protocol %s",
    (url) => {
      const result = analyzeSchema["~standard"].validate({ url })

      if (result instanceof Promise) {
        throw new Error("Expected sync validation")
      }

      expect("issues" in result).toBe(true)
    }
  )

  it("rejects unsupported, duplicate, and excessive formats", () => {
    const url = "https://example.com/video.mp4"

    const unsupported = analyzeSchema["~standard"].validate({
      url,
      format: ["YAML"],
    })

    const duplicate = analyzeSchema["~standard"].validate({
      url,
      format: ["JSON", "JSON"],
    })

    const excessive = analyzeSchema["~standard"].validate({
      url,
      format: ["object", "JSON", "Text", "XML", "HTML", "text"],
    })

    if (
      unsupported instanceof Promise ||
      duplicate instanceof Promise ||
      excessive instanceof Promise
    ) {
      throw new Error("Expected sync validation")
    }

    expect("issues" in unsupported).toBe(true)
    expect("issues" in duplicate).toBe(true)
    expect("issues" in excessive).toBe(true)
  })
})
