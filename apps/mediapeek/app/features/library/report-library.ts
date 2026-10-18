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

export type StoredReport = typeof StoredReportSchema.Type

export type NewStoredReport = Omit<StoredReport, "id">

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

export const deleteReport = async (id: string): Promise<void> =>
  withReportStore("readwrite", async (store) => {
    await waitForRequest(store.delete(id))
  })
