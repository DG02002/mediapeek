export type LineDiffRowKind = "context" | "added" | "removed"

export interface LineDiffRow {
  readonly kind: LineDiffRowKind
  readonly beforeNumber: number | null
  readonly afterNumber: number | null
  readonly text: string
}

interface CollapsedDiffGap {
  readonly kind: "gap"
  readonly hiddenCount: number
}

export type CollapsedDiffRow = LineDiffRow | CollapsedDiffGap

export interface SideBySideDiffRow {
  readonly kind: "context" | "change" | "gap"
  readonly before: LineDiffRow | null
  readonly after: LineDiffRow | null
  readonly hiddenCount?: number
}

export interface LineDiffOptions {
  readonly maxLines?: number
}

export interface CollapseOptions {
  readonly context?: number
}

const DEFAULT_MAX_DIFF_LINES = 5000
const DEFAULT_COLLAPSE_CONTEXT = 3

interface LcsCursor {
  beforeIndex: number
  afterIndex: number
  beforeNumber: number
  afterNumber: number
}

const splitLines = (content: string) => {
  if (content === "") {
    return []
  }

  const withoutTrailingNewline = content.endsWith("\n")
    ? content.slice(0, -1)
    : content

  return withoutTrailingNewline.split("\n")
}

const buildReplacementRows = (
  beforeLines: ReadonlyArray<string>,
  afterLines: ReadonlyArray<string>
) => [
  ...beforeLines.map((text, index) => ({
    kind: "removed" as const,
    beforeNumber: index + 1,
    afterNumber: null,
    text,
  })),
  ...afterLines.map((text, index) => ({
    kind: "added" as const,
    beforeNumber: null,
    afterNumber: index + 1,
    text,
  })),
]

const buildLcsLengths = (
  beforeLines: ReadonlyArray<string>,
  afterLines: ReadonlyArray<string>
) => {
  const columnCount = afterLines.length + 1
  const lengths = new Int32Array((beforeLines.length + 1) * columnCount)

  for (
    let beforeIndex = beforeLines.length - 1;
    beforeIndex >= 0;
    beforeIndex -= 1
  ) {
    for (
      let afterIndex = afterLines.length - 1;
      afterIndex >= 0;
      afterIndex -= 1
    ) {
      lengths[beforeIndex * columnCount + afterIndex] =
        beforeLines[beforeIndex] === afterLines[afterIndex]
          ? lengths[(beforeIndex + 1) * columnCount + afterIndex + 1] + 1
          : Math.max(
              lengths[(beforeIndex + 1) * columnCount + afterIndex],
              lengths[beforeIndex * columnCount + afterIndex + 1]
            )
    }
  }

  return { lengths, columnCount }
}

interface AppendCommonRowsArgs {
  rows: LineDiffRow[]
  beforeLines: ReadonlyArray<string>
  afterLines: ReadonlyArray<string>
  lengths: Int32Array
  columnCount: number
  cursor: LcsCursor
}

const appendCommonRows = ({
  rows,
  beforeLines,
  afterLines,
  lengths,
  columnCount,
  cursor,
}: AppendCommonRowsArgs) => {
  while (
    cursor.beforeIndex < beforeLines.length &&
    cursor.afterIndex < afterLines.length
  ) {
    if (beforeLines[cursor.beforeIndex] === afterLines[cursor.afterIndex]) {
      cursor.beforeNumber += 1
      cursor.afterNumber += 1
      rows.push({
        kind: "context",
        beforeNumber: cursor.beforeNumber,
        afterNumber: cursor.afterNumber,
        text: beforeLines[cursor.beforeIndex],
      })
      cursor.beforeIndex += 1
      cursor.afterIndex += 1
      continue
    }

    if (
      lengths[(cursor.beforeIndex + 1) * columnCount + cursor.afterIndex] >=
      lengths[cursor.beforeIndex * columnCount + cursor.afterIndex + 1]
    ) {
      cursor.beforeNumber += 1
      rows.push({
        kind: "removed",
        beforeNumber: cursor.beforeNumber,
        afterNumber: null,
        text: beforeLines[cursor.beforeIndex],
      })
      cursor.beforeIndex += 1
    } else {
      cursor.afterNumber += 1
      rows.push({
        kind: "added",
        beforeNumber: null,
        afterNumber: cursor.afterNumber,
        text: afterLines[cursor.afterIndex],
      })
      cursor.afterIndex += 1
    }
  }
}

const appendRemovedTail = (
  rows: LineDiffRow[],
  beforeLines: ReadonlyArray<string>,
  cursor: LcsCursor
) => {
  while (cursor.beforeIndex < beforeLines.length) {
    cursor.beforeNumber += 1
    rows.push({
      kind: "removed",
      beforeNumber: cursor.beforeNumber,
      afterNumber: null,
      text: beforeLines[cursor.beforeIndex],
    })
    cursor.beforeIndex += 1
  }
}

const appendAddedTail = (
  rows: LineDiffRow[],
  afterLines: ReadonlyArray<string>,
  cursor: LcsCursor
) => {
  while (cursor.afterIndex < afterLines.length) {
    cursor.afterNumber += 1
    rows.push({
      kind: "added",
      beforeNumber: null,
      afterNumber: cursor.afterNumber,
      text: afterLines[cursor.afterIndex],
    })
    cursor.afterIndex += 1
  }
}

export const diffLines = (
  before: string,
  after: string,
  options: LineDiffOptions = {}
): ReadonlyArray<LineDiffRow> => {
  const maxLines = options.maxLines ?? DEFAULT_MAX_DIFF_LINES
  const beforeLines = splitLines(before)
  const afterLines = splitLines(after)

  if (beforeLines.length > maxLines || afterLines.length > maxLines) {
    return buildReplacementRows(beforeLines, afterLines)
  }

  const rows: LineDiffRow[] = []

  const cursor: LcsCursor = {
    beforeIndex: 0,
    afterIndex: 0,
    beforeNumber: 0,
    afterNumber: 0,
  }

  const { lengths, columnCount } = buildLcsLengths(beforeLines, afterLines)
  appendCommonRows({
    rows,
    beforeLines,
    afterLines,
    lengths,
    columnCount,
    cursor,
  })
  appendRemovedTail(rows, beforeLines, cursor)
  appendAddedTail(rows, afterLines, cursor)

  return rows
}

export const collapseDiffLines = (
  rows: ReadonlyArray<LineDiffRow>,
  options: CollapseOptions = {}
): ReadonlyArray<CollapsedDiffRow> => {
  const context = options.context ?? DEFAULT_COLLAPSE_CONTEXT
  const hasChanges = rows.some((row) => row.kind !== "context")

  if (!hasChanges) {
    return rows
  }

  const keep = Array.from({ length: rows.length }, () => false)

  rows.forEach((row, index) => {
    if (row.kind === "context") {
      return
    }

    for (
      let neighbor = Math.max(0, index - context);
      neighbor <= Math.min(rows.length - 1, index + context);
      neighbor += 1
    ) {
      keep[neighbor] = true
    }
  })

  const collapsed: CollapsedDiffRow[] = []
  let hiddenRun = 0

  const flushHiddenRun = () => {
    if (hiddenRun > 0) {
      collapsed.push({ kind: "gap", hiddenCount: hiddenRun })
      hiddenRun = 0
    }
  }

  rows.forEach((row, index) => {
    if (keep[index]) {
      flushHiddenRun()
      collapsed.push(row)
    } else {
      hiddenRun += 1
    }
  })

  flushHiddenRun()

  return collapsed
}

interface SideBySideChangeGroup {
  readonly beforeRows: ReadonlyArray<LineDiffRow>
  readonly afterRows: ReadonlyArray<LineDiffRow>
  readonly nextIndex: number
}

const collectSideBySideChangeGroup = (
  rows: ReadonlyArray<CollapsedDiffRow>,
  startIndex: number
): SideBySideChangeGroup => {
  const beforeRows: LineDiffRow[] = []
  const afterRows: LineDiffRow[] = []
  let nextIndex = startIndex

  while (
    nextIndex < rows.length &&
    rows[nextIndex].kind !== "context" &&
    rows[nextIndex].kind !== "gap"
  ) {
    const row = rows[nextIndex]

    if (row.kind === "removed") {
      beforeRows.push(row)
    } else if (row.kind === "added") {
      afterRows.push(row)
    }

    nextIndex += 1
  }

  return { beforeRows, afterRows, nextIndex }
}

const pairSideBySideChangeGroup = (
  group: SideBySideChangeGroup
): ReadonlyArray<SideBySideDiffRow> =>
  Array.from(
    { length: Math.max(group.beforeRows.length, group.afterRows.length) },
    (_, index) => ({
      kind: "change",
      before: group.beforeRows[index] ?? null,
      after: group.afterRows[index] ?? null,
    })
  )

export const toSideBySideDiffRows = (
  rows: ReadonlyArray<CollapsedDiffRow>
): ReadonlyArray<SideBySideDiffRow> => {
  const sideBySideRows: SideBySideDiffRow[] = []
  let index = 0

  while (index < rows.length) {
    const row = rows[index]

    if (row.kind === "gap") {
      sideBySideRows.push({
        kind: "gap",
        before: null,
        after: null,
        hiddenCount: row.hiddenCount,
      })
      index += 1
    } else if (row.kind === "context") {
      sideBySideRows.push({
        kind: "context",
        before: row,
        after: row,
      })
      index += 1
    } else {
      const group = collectSideBySideChangeGroup(rows, index)
      sideBySideRows.push(...pairSideBySideChangeGroup(group))
      index = group.nextIndex
    }
  }

  return sideBySideRows
}
