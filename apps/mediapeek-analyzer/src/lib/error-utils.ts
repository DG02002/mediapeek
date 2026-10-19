import { Schema } from "effect"

interface AnalyzerTaggedError<Tag extends string> extends Error {
  readonly _tag: Tag
}

type AnalyzerErrorConstructor<Tag extends string> = new (
  message: string,
  cause?: unknown
) => AnalyzerTaggedError<Tag>

const defineAnalyzerError = <Tag extends string>(
  tag: Tag
): AnalyzerErrorConstructor<Tag> => {
  class AnalyzerError extends Schema.TaggedError<AnalyzerError>()(tag, {
    message: Schema.String,
    cause: Schema.optionalKey(Schema.Defect()),
  }) {
    constructor(message: string, cause?: unknown) {
      super(cause === undefined ? { message } : { message, cause })
    }
  }

  return AnalyzerError
}

export class UpstreamFetchError extends defineAnalyzerError(
  "UpstreamFetchError"
) {}

export class AnalyzerReadTimeoutError extends UpstreamFetchError {
  constructor(message = "Fetch stream read timed out") {
    super(message)
    this.name = "AnalyzerReadTimeoutError"
  }
}

export class ValidationFailureError extends defineAnalyzerError(
  "ValidationFailureError"
) {}

export class CpuBudgetExceededError extends defineAnalyzerError(
  "CpuBudgetExceededError"
) {
  constructor(message = "CPU budget exceeded", cause?: unknown) {
    super(message, cause)
  }
}

export class RateLimitedError extends defineAnalyzerError("RateLimitedError") {}

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
