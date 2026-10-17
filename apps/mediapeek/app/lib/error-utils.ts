export class DiagnosticsError<T> extends Error {
  public diagnostics: T;

  constructor(message: string, diagnostics: T, cause?: unknown) {
    super(message);
    this.name = 'DiagnosticsError';
    this.diagnostics = diagnostics;
    if (cause) {
      this.cause = cause;
    }
  }
}
