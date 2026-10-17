import { Result, Schema } from "effect"

const DATABASE_NAME = "mediapeek"
const DATABASE_VERSION = 1
const REPORT_STORE_NAME = "reports"

const ReportOutputsSchema = Schema.Struct({
  json: Schema.optionalKey(Schema.String),
  text: Schema.optionalKey(Schema.String),
  html: Schema.optionalKey(Schema.String),
  xml: Schema.optionalKey(Schema.String),
})

const StoredReportSchema = Schema.Struct({
  id: Schema.String,
  sourceUrl: Schema.String,
  filename: Schema.String,
  analyzedAt: Schema.String,
  outputs: ReportOutputsSchema,
})

const ReportLibraryExportSchema = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  reports: Schema.Array(StoredReportSchema),
})

export type StoredReport = typeof StoredReportSchema.Type

export type NewStoredReport = Omit<StoredReport, "id">

export type LibraryImportParseResult =
  | { readonly ok: true; readonly reports: ReadonlyArray<StoredReport> }
  | {
      readonly ok: false
      readonly error: {
        readonly code: "invalid-json" | "invalid-library-file"
        readonly message: string
      }
    }

const openReportDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)

    request.addEventListener("upgradeneeded", () => {
      const database = request.result

      if (!database.objectStoreNames.contains(REPORT_STORE_NAME)) {
        const reports = database.createObjectStore(REPORT_STORE_NAME, {
          keyPath: "id",
        })

        reports.createIndex("analyzedAt", "analyzedAt", { unique: false })
      }
    })

    request.addEventListener(
      "error",
      () =>
        reject(
          request.error ?? new Error("Unable to open the report library.")
        ),
      { once: true }
    )

    request.addEventListener("success", () => resolve(request.result), {
      once: true,
    })
  })

const waitForRequest = <Value>(request: IDBRequest<Value>) =>
  new Promise<Value>((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result), {
      once: true,
    })
    request.addEventListener(
      "error",
      () =>
        reject(
          request.error ?? new Error("The report library request failed.")
        ),
      { once: true }
    )
  })

const waitForTransaction = (transaction: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve(), { once: true })
    transaction.addEventListener(
      "abort",
      () =>
        reject(
          transaction.error ??
            new Error("The report library write was aborted.")
        ),
      { once: true }
    )
    transaction.addEventListener(
      "error",
      () =>
        reject(
          transaction.error ??
            new Error("The report library transaction failed.")
        ),
      { once: true }
    )
  })

const withReportStore = async <Value>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => Promise<Value>
): Promise<Value> => {
  const database = await openReportDatabase()
  const transaction = database.transaction(REPORT_STORE_NAME, mode)
  const completed = waitForTransaction(transaction)

  try {
    const value = await run(transaction.objectStore(REPORT_STORE_NAME))
    await completed

    return value
  } catch (error) {
    await completed.catch(() => undefined)

    throw error
  } finally {
    database.close()
  }
}

type PersistedJsonValue = Schema.Json | undefined

const decodeStoredReport = (value: PersistedJsonValue) =>
  Schema.decodeUnknownResult(StoredReportSchema)(value)

const decodeStoredReports = (values: ReadonlyArray<Schema.Json>) =>
  values.flatMap((value) => {
    const decoded = decodeStoredReport(value)

    return Result.isSuccess(decoded) ? [decoded.success] : []
  })

export const serializeReports = (reports: ReadonlyArray<StoredReport>) =>
  JSON.stringify(
    {
      schemaVersion: 1,
      reports,
    },
    null,
    2
  )

export const parseLibraryExport = (
  content: string
): LibraryImportParseResult => {
  let parsedJson: unknown

  try {
    parsedJson = JSON.parse(content)
  } catch {
    return {
      ok: false,
      error: {
        code: "invalid-json",
        message: "The selected file is not valid JSON.",
      },
    }
  }

  const decoded = Schema.decodeUnknownResult(ReportLibraryExportSchema)(
    parsedJson
  )

  if (Result.isFailure(decoded)) {
    return {
      ok: false,
      error: {
        code: "invalid-library-file",
        message: "The JSON file does not contain a MediaPeek report library.",
      },
    }
  }

  return { ok: true, reports: decoded.success.reports }
}

export const prepareImportedReports = (
  reports: ReadonlyArray<StoredReport>,
  existingIds: ReadonlyArray<string>,
  createId: () => string = () => crypto.randomUUID()
) => {
  const usedIds = new Set(existingIds)
  const prepared: StoredReport[] = []

  for (const report of reports) {
    let { id } = report

    if (usedIds.has(id)) {
      id = createId()
    }

    while (usedIds.has(id)) {
      id = createId()
    }

    usedIds.add(id)
    prepared.push({ ...report, id })
  }

  return prepared
}

export const listReports = async (): Promise<ReadonlyArray<StoredReport>> =>
  withReportStore("readonly", async (store) => {
    const values = await waitForRequest<Schema.Json[]>(store.getAll())

    return decodeStoredReports(values).toSorted((first, second) =>
      second.analyzedAt.localeCompare(first.analyzedAt)
    )
  })

export const saveReport = async (
  report: NewStoredReport
): Promise<StoredReport> => {
  const stored: StoredReport = {
    ...report,
    id: crypto.randomUUID(),
  }

  return withReportStore("readwrite", async (store) => {
    await waitForRequest(store.add(stored))

    return stored
  })
}

const addImportedReport = async (report: StoredReport) =>
  withReportStore("readwrite", async (store) => {
    await waitForRequest(store.add(report))

    return report
  })

export const deleteReport = async (id: string): Promise<void> =>
  withReportStore("readwrite", async (store) => {
    await waitForRequest(store.delete(id))
  })

export const exportAll = async (): Promise<number> => {
  const reports = await listReports()

  const file = new Blob([serializeReports(reports)], {
    type: "application/json",
  })

  const downloadUrl = URL.createObjectURL(file)
  const link = document.createElement("a")

  link.href = downloadUrl
  link.download = `mediapeek-reports-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0)

  return reports.length
}

export const importAll = async (file: Blob): Promise<number> => {
  const parsed = parseLibraryExport(await file.text())

  if (!parsed.ok) {
    throw new Error(parsed.error.message)
  }

  const existingReports = await listReports()

  const reports = prepareImportedReports(
    parsed.reports,
    existingReports.map((report) => report.id)
  )

  await Promise.all(reports.map((report) => addImportedReport(report)))

  return reports.length
}
