import { Schema } from "effect"

interface AnalyzerTaggedErrorFields {
  message: string
  cause?: unknown
}

const createErrorFields = (message: string, cause?: unknown) => {
  const fields: AnalyzerTaggedErrorFields = { message }

  if (cause !== undefined) {
    fields.cause = cause
  }

  return fields
}

export class UpstreamFetchError extends Schema.TaggedError<UpstreamFetchError>()(
  "UpstreamFetchError",
  {
    message: Schema.String,
    cause: Schema.optionalKey(Schema.Defect()),
  }
) {
  constructor(message: string, cause?: unknown) {
    super(createErrorFields(message, cause))
  }
}

export class AnalyzerReadTimeoutError extends UpstreamFetchError {
  constructor(message = "Fetch stream read timed out") {
    super(message)
    this.name = "AnalyzerReadTimeoutError"
  }
}

export class ValidationFailureError extends Schema.TaggedError<ValidationFailureError>()(
  "ValidationFailureError",
  {
    message: Schema.String,
    cause: Schema.optionalKey(Schema.Defect()),
  }
) {
  constructor(message: string, cause?: unknown) {
    super(createErrorFields(message, cause))
  }
}

export class CpuBudgetExceededError extends Schema.TaggedError<CpuBudgetExceededError>()(
  "CpuBudgetExceededError",
  {
    message: Schema.String,
    cause: Schema.optionalKey(Schema.Defect()),
  }
) {
  constructor(message = "CPU budget exceeded", cause?: unknown) {
    super(createErrorFields(message, cause))
  }
}

export class RateLimitedError extends Schema.TaggedError<RateLimitedError>()(
  "RateLimitedError",
  {
    message: Schema.String,
    cause: Schema.optionalKey(Schema.Defect()),
  }
) {
  constructor(message: string, cause?: unknown) {
    super(createErrorFields(message, cause))
  }
}

export type AnalyzerFailure =
  | UpstreamFetchError
  | ValidationFailureError
  | CpuBudgetExceededError
  | RateLimitedError

export const isAnalyzerFailure = (error: unknown): error is AnalyzerFailure =>
  error instanceof UpstreamFetchError ||
  error instanceof ValidationFailureError ||
  error instanceof CpuBudgetExceededError ||
  error instanceof RateLimitedError

export class DiagnosticsError<T> extends Error {
  public diagnostics: T

  constructor(message: string, diagnostics: T, cause?: unknown) {
    super(message)
    this.name = "DiagnosticsError"
    this.diagnostics = diagnostics

    if (cause !== undefined) {
      this.cause = cause
    }
  }
}
