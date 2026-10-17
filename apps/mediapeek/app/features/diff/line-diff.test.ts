import { describe, expect, it } from "vitest"

import { collapseDiffLines, diffLines } from "./line-diff"

const kindsOf = (rows: ReadonlyArray<{ kind: string }>) =>
  rows.map((row) => row.kind)

describe("diffLines", () => {
  it("returns context rows with aligned numbers for identical content", () => {
    const rows = diffLines("alpha\nbeta\n", "alpha\nbeta\n")

    expect(rows).toEqual([
      { kind: "context", beforeNumber: 1, afterNumber: 1, text: "alpha" },
      { kind: "context", beforeNumber: 2, afterNumber: 2, text: "beta" },
    ])
  })

  it("marks removed and added rows around a changed line", () => {
    const rows = diffLines("alpha\nbeta\ngamma\n", "alpha\nbeta two\ngamma\n")

    expect(kindsOf(rows)).toEqual(["context", "removed", "added", "context"])
    expect(rows[1]).toMatchObject({ beforeNumber: 2, afterNumber: null })
    expect(rows[2]).toMatchObject({ beforeNumber: null, afterNumber: 2 })
  })

  it("handles empty content on either side", () => {
    expect(diffLines("", "alpha\n")).toEqual([
      { kind: "added", beforeNumber: null, afterNumber: 1, text: "alpha" },
    ])
    expect(diffLines("alpha\n", "")).toEqual([
      { kind: "removed", beforeNumber: 1, afterNumber: null, text: "alpha" },
    ])
    expect(diffLines("", "")).toEqual([])
  })

  it("ignores a trailing newline instead of emitting an empty final line", () => {
    expect(diffLines("alpha", "alpha\n")).toEqual([
      { kind: "context", beforeNumber: 1, afterNumber: 1, text: "alpha" },
    ])
  })

  it("falls back to a full replacement beyond the line limit", () => {
    const before = Array.from(
      { length: 4 },
      (_, index) => `old-${String(index)}`
    ).join("\n")

    const after = Array.from(
      { length: 3 },
      (_, index) => `new-${String(index)}`
    ).join("\n")

    const rows = diffLines(before, after, { maxLines: 2 })

    expect(kindsOf(rows)).toEqual([
      "removed",
      "removed",
      "removed",
      "removed",
      "added",
      "added",
      "added",
    ])
  })
})

describe("collapseDiffLines", () => {
  it("keeps rows unchanged when nothing changed", () => {
    const rows = diffLines("alpha\nbeta\n", "alpha\nbeta\n")

    expect(collapseDiffLines(rows)).toEqual(rows)
  })

  it("collapses long unchanged runs into gap rows", () => {
    const before = [
      "one",
      "two",
      "three",
      "four",
      "five",
      "six",
      "seven",
      "eight",
      "nine",
      "ten",
      "eleven",
    ].join("\n")

    const after = before.replace("six", "six changed")
    const rows = collapseDiffLines(diffLines(before, after), { context: 1 })

    expect(rows.filter((row) => row.kind === "gap")).toEqual([
      { kind: "gap", hiddenCount: 4 },
      { kind: "gap", hiddenCount: 4 },
    ])
    expect(kindsOf(rows)).toEqual([
      "gap",
      "context",
      "removed",
      "added",
      "context",
      "gap",
    ])
  })

  it("keeps every row when changes are closer than the context size", () => {
    const rows = diffLines("alpha\nbeta\n", "alpha\nbeta two\n")

    expect(collapseDiffLines(rows, { context: 3 })).toEqual(rows)
  })
})
