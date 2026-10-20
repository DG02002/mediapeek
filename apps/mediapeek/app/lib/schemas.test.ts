import { ANALYZE_URL_MAX_LENGTH } from "@mediapeek/shared/constants"
import { analyzeSchema } from "@mediapeek/shared/schemas"
import type { Schema } from "effect"
import { describe, expect, it } from "vitest"

type AnalyzeSchemaInput = typeof Schema.Json.Type

const validateAnalyzeSchema = (input: AnalyzeSchemaInput) => {
  const result = analyzeSchema["~standard"].validate(input)

  if (result instanceof Promise) {
    throw new Error("Expected synchronous schema validation")
  }

  return result
}

describe("analyzeSchema", () => {
  it("validates a correct URL and applies default format", () => {
    const result = validateAnalyzeSchema({
      url: "https://example.com/video.mp4",
    })

    expect("value" in result).toBe(true)

    if ("value" in result) {
      expect(result.value.url).toBe("https://example.com/video.mp4")
      expect(result.value.format).toEqual(["json"])
    }
  })

  it("rejects an invalid URL", () => {
    const result = validateAnalyzeSchema({ url: "not-a-url" })

    expect("issues" in result).toBe(true)

    if ("issues" in result) {
      expect(result.issues?.[0]?.message).toBe("Invalid URL provided.")
    }
  })

  it("accepts array-based formats", () => {
    const result = validateAnalyzeSchema({
      url: "https://example.com",
      format: ["object", "text"],
    })

    expect("value" in result).toBe(true)

    if ("value" in result) {
      expect(result.value.format).toEqual(["json", "text"])
    }
  })

  it("accepts a valid URL at the 4096-character limit", () => {
    const prefix = "https://example.com/"
    const url = `${prefix}${"a".repeat(ANALYZE_URL_MAX_LENGTH - prefix.length)}`
    const result = validateAnalyzeSchema({ url })

    expect("value" in result).toBe(true)

    if ("value" in result) {
      expect(result.value.url).toHaveLength(ANALYZE_URL_MAX_LENGTH)
    }
  })

  it("rejects a URL longer than 4096 characters", () => {
    const prefix = "https://example.com/"
    const url = `${prefix}${"a".repeat(ANALYZE_URL_MAX_LENGTH + 1 - prefix.length)}`
    const result = validateAnalyzeSchema({ url })

    expect("issues" in result).toBe(true)
  })
})
