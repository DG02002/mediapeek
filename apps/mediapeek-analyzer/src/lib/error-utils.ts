export type AnalyzerErrorKind =
  | "cpu-budget"
  | "rate-limited"
  | "validation"
  | "upstream-fetch"

export class AnalyzerError extends Error {
  readonly kind: AnalyzerErrorKind

  constructor(kind: AnalyzerErrorKind, message: string, cause?: unknown) {
    super(message)
    this.name = "AnalyzerError"
    this.kind = kind

    if (cause !== undefined) {
      this.cause = cause
    }
  }
}

export class AnalyzerReadTimeoutError extends AnalyzerError {
  constructor(message = "Fetch stream read timed out") {
    super("upstream-fetch", message)
    this.name = "AnalyzerReadTimeoutError"
  }
}

export class DiagnosticsError<T> extends Error {
  public diagnostics: T

  constructor(message: string, diagnostics: T, cause?: unknown) {
    super(message)
    this.name = "DiagnosticsError"
    this.diagnostics = diagnostics

    if (cause) {
      this.cause = cause
    }
  }
}
