import { Schema } from "effect"
import { describe, expect, it } from "vitest"

import {
  analysisOutputFormats,
  AnalysisOutputRequestSchema,
} from "./analysis-output-formats"

describe("analysis output formats", () => {
  it.each([
    ["object", "json"],
    ["JSON", "json"],
    ["json", "json"],
    ["Text", "text"],
    ["text", "text"],
    ["XML", "xml"],
    ["xml", "xml"],
    ["HTML", "html"],
    ["html", "html"],
  ] as const)("canonicalizes %s to %s", (request, canonical) => {
    expect(analysisOutputFormats.parse([request])).toEqual([canonical])
  })

  it("defaults an omitted selection to JSON", () => {
    expect(analysisOutputFormats.parse(undefined)).toEqual(["json"])
  })

  it("exposes the Effect schema for request aliases", () => {
    expect(Schema.decodeUnknownSync(AnalysisOutputRequestSchema)("JSON")).toBe(
      "JSON"
    )
  })

  it("deduplicates compatibility aliases in first-request order", () => {
    expect(
      analysisOutputFormats.parse(["Text", "object", "JSON", "XML", "text"])
    ).toEqual(["text", "json", "xml"])
  })

  it.each([{ value: [] }, { value: ["all"] }, { value: ["yaml"] }])(
    "rejects invalid selection $value",
    ({ value }) => {
      expect(() => analysisOutputFormats.parse(value)).toThrow(/./)
    }
  )

  it("presents each canonical output exactly once", () => {
    expect(analysisOutputFormats.choices()).toEqual([
      { id: "json", label: "JSON" },
      { id: "text", label: "Text" },
      { id: "xml", label: "XML" },
      { id: "html", label: "HTML" },
    ])
  })

  it.each([
    ["json", { format: "object", full: true }],
    ["text", { format: "text", full: true }],
    ["xml", { format: "XML", full: false }],
    ["html", { format: "HTML", full: false }],
  ] as const)("configures MediaInfo for %s", (format, expected) => {
    const target = { options: { format: "object", full: false } }

    analysisOutputFormats.configure(format, target)

    expect(target.options).toEqual(expected)
  })
})
