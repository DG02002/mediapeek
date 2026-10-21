import { AnalyzeWarningCodeSchema } from "@mediapeek/shared/analyze-contract"
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
  warnings: Schema.optionalKey(Schema.Array(AnalyzeWarningCodeSchema)),
})

export type StoredReport = typeof StoredReportSchema.Type

type NewStoredReport = Omit<StoredReport, "id">

export interface StoredReportsSnapshot {
  readonly reports: ReadonlyArray<StoredReport>
  readonly isLoading: boolean
  readonly error: string | null
}

export interface StoredReportsStore {
  getServerSnapshot: () => StoredReportsSnapshot
  getSnapshot: () => StoredReportsSnapshot
  subscribe: (listener: () => void) => () => void
  list: () => Promise<void>
  save: (report: NewStoredReport) => Promise<StoredReport>
  delete: (id: string) => Promise<void>
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
      () => reject(request.error ?? new Error("Unable to open saved reports.")),
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
          request.error ?? new Error("The report storage request failed.")
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
          transaction.error ?? new Error("Saving the report was aborted.")
        ),
      { once: true }
    )
    transaction.addEventListener(
      "error",
      () =>
        reject(transaction.error ?? new Error("Unable to save the report.")),
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

    // Corrupt rows cannot be shown as reports, so omit them from this list.
    return Result.isSuccess(decoded) ? [decoded.success] : []
  })

const readReports = async (): Promise<ReadonlyArray<StoredReport>> =>
  withReportStore("readonly", async (store) => {
    const values = await waitForRequest<Schema.Json[]>(store.getAll())

    return decodeStoredReports(values).toSorted((first, second) =>
      second.analyzedAt.localeCompare(first.analyzedAt)
    )
  })

const saveReportToDatabase = async (
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

const deleteReportFromDatabase = async (id: string): Promise<void> =>
  withReportStore("readwrite", async (store) => {
    await waitForRequest(store.delete(id))
  })

const SERVER_SNAPSHOT: StoredReportsSnapshot = {
  reports: [],
  isLoading: true,
  error: null,
}

const toStorageErrorMessage = (cause: unknown) =>
  cause instanceof Error ? cause.message : "Unable to read saved reports."

let snapshot = SERVER_SNAPSHOT
let latestListRequest = 0
const listeners = new Set<() => void>()

const publish = (nextSnapshot: StoredReportsSnapshot) => {
  snapshot = nextSnapshot

  for (const listener of listeners) {
    listener()
  }
}

const list = async () => {
  const requestId = ++latestListRequest
  publish({ ...snapshot, isLoading: true, error: null })

  try {
    const reports = await readReports()

    if (requestId === latestListRequest) {
      publish({ reports, isLoading: false, error: null })
    }
  } catch (cause) {
    if (requestId === latestListRequest) {
      publish({
        ...snapshot,
        isLoading: false,
        error: toStorageErrorMessage(cause),
      })
    }
  }
}

const save = async (report: NewStoredReport) => {
  const stored = await saveReportToDatabase(report)

  await list()

  return stored
}

const remove = async (id: string) => {
  await deleteReportFromDatabase(id)
  await list()
}

export const reportStorageStore: StoredReportsStore = {
  getServerSnapshot: () => SERVER_SNAPSHOT,
  getSnapshot: () => snapshot,
  subscribe: (listener) => {
    listeners.add(listener)

    return () => listeners.delete(listener)
  },
  list,
  save,
  delete: remove,
}
