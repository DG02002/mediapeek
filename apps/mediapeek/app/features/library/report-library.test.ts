import { describe, expect, it } from "vitest"

import {
  parseLibraryExport,
  prepareImportedReports,
  serializeReports,
  type StoredReport,
} from "./report-library"

const createReport = (id: string): StoredReport => ({
  id,
  sourceUrl: "https://example.com/video.mp4",
  filename: "video.mp4",
  analyzedAt: "2026-10-17T00:00:00.000Z",
  outputs: { json: '{"media":{"track":[]}}' },
})

describe("report library data", () => {
  it("round-trips the versioned JSON export format", () => {
    const reports = [createReport("report-1")]

    expect(parseLibraryExport(serializeReports(reports))).toEqual({
      ok: true,
      reports,
    })
  })

  it("returns typed errors for malformed and unsupported imports", () => {
    expect(parseLibraryExport("{not-json")).toMatchObject({
      ok: false,
      error: { code: "invalid-json" },
    })
    expect(
      parseLibraryExport('{"schemaVersion":2,"reports":[]}')
    ).toMatchObject({
      ok: false,
      error: { code: "invalid-library-file" },
    })
  })

  it("reassigns imported IDs that collide with saved or imported reports", () => {
    const reports = [createReport("duplicate-id"), createReport("duplicate-id")]
    const replacements = ["replacement-1", "replacement-2"]

    const prepared = prepareImportedReports(
      reports,
      ["duplicate-id"],
      () => replacements.shift() ?? "replacement-fallback"
    )

    expect(prepared.map((report) => report.id)).toEqual([
      "replacement-1",
      "replacement-2",
    ])
    expect(prepared.map((report) => report.sourceUrl)).toEqual([
      "https://example.com/video.mp4",
      "https://example.com/video.mp4",
    ])
  })
})
