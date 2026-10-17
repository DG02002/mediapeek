import { Schema } from "effect"

import {
  parseMediaReport,
  type MediaReport,
} from "~/features/library/media-report"

export type DiffValue = Schema.Json | undefined

export type DiffSection =
  | "general"
  | "video"
  | "audio"
  | "subtitle"
  | "chapters"

export interface DiffPath {
  readonly section: DiffSection
  readonly path: string
  readonly value: DiffValue
}

export interface ChangedField {
  readonly section: DiffSection
  readonly path: string
  readonly before: DiffValue
  readonly after: DiffValue
}

export interface ReportDiff {
  readonly added: ReadonlyArray<DiffPath>
  readonly removed: ReadonlyArray<DiffPath>
  readonly changed: ReadonlyArray<ChangedField>
}

export interface ReportOutputInput {
  readonly sourceUrl: string
  readonly json?: string
}

export type ReportOutputDiffResult =
  | { readonly ok: true; readonly diff: ReportDiff }
  | {
      readonly ok: false
      readonly side: "before" | "after"
      readonly message: string
    }

interface MutableReportDiff {
  added: DiffPath[]
  removed: DiffPath[]
  changed: ChangedField[]
}

interface TrackIdentity {
  readonly key: string
  readonly id?: string
}

interface GeneralReportFields {
  readonly file: MediaReport["file"]
  readonly container?: MediaReport["container"]
  readonly accessibility: MediaReport["accessibility"]
  readonly badges: MediaReport["badges"]
  readonly engine?: MediaReport["engine"]
}

type DiffObjectInput = GeneralReportFields | TrackIdentity

interface TrackCollectionInput<Track extends TrackIdentity> {
  readonly section: DiffSection
  readonly kind: string
  readonly before: ReadonlyArray<Track>
  readonly after: ReadonlyArray<Track>
  readonly diff: MutableReportDiff
}

interface CompareInput {
  readonly section: DiffSection
  readonly path: string
  readonly before: DiffValue
  readonly after: DiffValue
  readonly diff: MutableReportDiff
}

const isRecord = Schema.is(Schema.JsonObject)
const isArray = Schema.is(Schema.Array(Schema.Json))

const stableValue = (value: Schema.Json): string => {
  if (isArray(value)) {
    return `[${value.map(stableValue).toSorted().join(",")}]`
  }

  if (isRecord(value)) {
    const fields = Object.keys(value)
      .toSorted()
      .map((key) => `${JSON.stringify(key)}:${stableValue(value[key])}`)

    return `{${fields.join(",")}}`
  }

  return JSON.stringify(value) ?? "null"
}

const compareArrayValues = ({
  section,
  path,
  before,
  after,
  diff,
}: CompareInput): void => {
  const previous = isArray(before) ? before : []
  const next = isArray(after) ? after : []

  const beforeValues = new Map(
    previous.map((value) => [stableValue(value), value] as const)
  )

  const afterValues = new Map(
    next.map((value) => [stableValue(value), value] as const)
  )

  for (const [key, value] of [...beforeValues].toSorted(([first], [second]) =>
    first.localeCompare(second)
  )) {
    if (!afterValues.has(key)) {
      diff.removed.push({ section, path: `${path}[]`, value })
    }
  }

  for (const [key, value] of [...afterValues].toSorted(([first], [second]) =>
    first.localeCompare(second)
  )) {
    if (!beforeValues.has(key)) {
      diff.added.push({ section, path: `${path}[]`, value })
    }
  }
}

const compareRecordValues = ({
  section,
  path,
  before,
  after,
  diff,
}: CompareInput) => {
  const previous = isRecord(before) ? before : {}
  const next = isRecord(after) ? after : {}
  const keys = new Set([...Object.keys(previous), ...Object.keys(next)])

  const comparedKeys = [...keys]
    .filter((key) => section === "general" || key !== "key")
    .toSorted()

  for (const key of comparedKeys) {
    compareValues({
      section,
      path: path ? `${path}.${key}` : key,
      before: previous[key],
      after: next[key],
      diff,
    })
  }
}

const compareScalarValues = ({
  section,
  path,
  before,
  after,
  diff,
}: CompareInput): void => {
  if (
    (isArray(before) && (isArray(after) || after === undefined)) ||
    (before === undefined && isArray(after))
  ) {
    compareArrayValues({ section, path, before, after, diff })

    return
  }

  if ((isRecord(before) || before === undefined) && isRecord(after)) {
    compareRecordValues({ section, path, before, after, diff })

    return
  }

  if (isRecord(before) && after === undefined) {
    compareRecordValues({ section, path, before, after, diff })

    return
  }

  if (Object.is(before, after)) {
    return
  }

  if (before === undefined) {
    diff.added.push({ section, path, value: after })

    return
  }

  if (after === undefined) {
    diff.removed.push({ section, path, value: before })

    return
  }

  diff.changed.push({ section, path, before, after })
}

const compareValues = (input: CompareInput): void => {
  if (input.before === undefined && input.after === undefined) {
    return
  }

  compareScalarValues(input)
}

const toJsonObject = (value: DiffObjectInput) =>
  Schema.decodeUnknownSync(Schema.JsonObject)(JSON.parse(JSON.stringify(value)))

const trackPath = (kind: string, track: TrackIdentity, index: number) => {
  const identity = track.id
    ? `id=${JSON.stringify(track.id)}`
    : `index=${String(index + 1)}`

  return `${kind}[${identity}]`
}

const compareTrackCollections = <Track extends TrackIdentity>({
  section,
  kind,
  before,
  after,
  diff,
}: TrackCollectionInput<Track>) => {
  const matchedAfter = new Set<number>()
  const matchedPairs = new Map<number, number>()

  before.forEach((track, beforeIndex) => {
    if (!track.id) {
      return
    }

    const afterIndex = after.findIndex(
      (candidate, candidateIndex) =>
        !matchedAfter.has(candidateIndex) && candidate.id === track.id
    )

    if (afterIndex !== -1) {
      matchedAfter.add(afterIndex)
      matchedPairs.set(beforeIndex, afterIndex)
    }
  })

  for (const beforeIndex of before.keys()) {
    if (matchedPairs.has(beforeIndex)) {
      continue
    }

    const fallbackIndex = beforeIndex

    if (after[fallbackIndex] && !matchedAfter.has(fallbackIndex)) {
      matchedAfter.add(fallbackIndex)
      matchedPairs.set(beforeIndex, fallbackIndex)
    }
  }

  before.forEach((track, beforeIndex) => {
    const afterIndex = matchedPairs.get(beforeIndex)
    const path = trackPath(kind, track, beforeIndex)

    if (afterIndex === undefined) {
      compareValues({
        section,
        path,
        before: toJsonObject(track),
        after: undefined,
        diff,
      })

      return
    }

    const afterTrack = after[afterIndex]

    compareValues({
      section,
      path: trackPath(kind, track.id ? track : afterTrack, beforeIndex),
      before: toJsonObject(track),
      after: toJsonObject(afterTrack),
      diff,
    })
  })

  after.forEach((track, afterIndex) => {
    if (!matchedAfter.has(afterIndex)) {
      compareValues({
        section,
        path: trackPath(kind, track, afterIndex),
        before: undefined,
        after: toJsonObject(track),
        diff,
      })
    }
  })
}

const compareChapters = (
  before: MediaReport["chapters"],
  after: MediaReport["chapters"],
  diff: MutableReportDiff
) => {
  const beforeByTime = new Map(before.map((chapter) => [chapter.time, chapter]))
  const afterByTime = new Map(after.map((chapter) => [chapter.time, chapter]))

  for (const [time, chapter] of beforeByTime) {
    const path = `chapters[time=${JSON.stringify(time)}]`
    const nextChapter = afterByTime.get(time)

    if (!nextChapter) {
      diff.removed.push({ section: "chapters", path, value: chapter.name })

      continue
    }

    compareValues({
      section: "chapters",
      path: `${path}.name`,
      before: chapter.name,
      after: nextChapter.name,
      diff,
    })
  }

  for (const [time, chapter] of afterByTime) {
    if (!beforeByTime.has(time)) {
      diff.added.push({
        section: "chapters",
        path: `chapters[time=${JSON.stringify(time)}]`,
        value: chapter.name,
      })
    }
  }
}

export const diffMediaReports = (
  before: MediaReport,
  after: MediaReport
): ReportDiff => {
  const diff: MutableReportDiff = { added: [], removed: [], changed: [] }

  const beforeGeneral = toJsonObject({
    file: before.file,
    container: before.container,
    accessibility: before.accessibility,
    badges: before.badges,
    engine: before.engine,
  })

  const afterGeneral = toJsonObject({
    file: after.file,
    container: after.container,
    accessibility: after.accessibility,
    badges: after.badges,
    engine: after.engine,
  })

  compareValues({
    section: "general",
    path: "",
    before: beforeGeneral,
    after: afterGeneral,
    diff,
  })
  compareTrackCollections({
    section: "video",
    kind: "video",
    before: before.videos,
    after: after.videos,
    diff,
  })
  compareTrackCollections({
    section: "audio",
    kind: "audio",
    before: before.audios,
    after: after.audios,
    diff,
  })
  compareTrackCollections({
    section: "subtitle",
    kind: "subtitle",
    before: before.subtitles,
    after: after.subtitles,
    diff,
  })
  compareChapters(before.chapters, after.chapters, diff)

  return diff
}

export const diffReportOutputs = (
  before: ReportOutputInput,
  after: ReportOutputInput
): ReportOutputDiffResult => {
  const beforeReport = parseMediaReport({
    json: before.json ?? "",
    sourceUrl: before.sourceUrl,
  })

  if (!beforeReport.ok) {
    return {
      ok: false,
      side: "before",
      message: beforeReport.error.message,
    }
  }

  const afterReport = parseMediaReport({
    json: after.json ?? "",
    sourceUrl: after.sourceUrl,
  })

  if (!afterReport.ok) {
    return {
      ok: false,
      side: "after",
      message: afterReport.error.message,
    }
  }

  return {
    ok: true,
    diff: diffMediaReports(beforeReport.report, afterReport.report),
  }
}
