export type RequestLogSeverity = "INFO" | "WARNING" | "ERROR"

export interface RequestLogStateSnapshot<
  TContext extends Record<string, unknown>,
> {
  readonly requestId: string
  readonly status: number
  readonly severity: RequestLogSeverity
  readonly context: TContext
}

export interface RequestLogState<
  TContext extends Record<string, unknown>,
> extends RequestLogStateSnapshot<TContext> {
  annotate: (values: Partial<TContext>) => void
  setStatus: (status: number) => void
  setSeverity: (severity: RequestLogSeverity) => void
  finalize: (
    onFinalize: (state: RequestLogStateSnapshot<TContext>) => void
  ) => void
}

export const createRequestLogState = <
  TContext extends Record<string, unknown>,
>({
  requestId,
  initialContext,
}: {
  readonly requestId: string
  readonly initialContext: TContext
}): RequestLogState<TContext> => {
  let status = 200
  let severity: RequestLogSeverity = "INFO"
  let finalized = false

  const annotate = (values: Partial<TContext>) => {
    Object.assign(initialContext, values)
  }

  const setStatus = (nextStatus: number) => {
    status = nextStatus
  }

  const setSeverity = (nextSeverity: RequestLogSeverity) => {
    severity = nextSeverity
  }

  const finalize = (
    onFinalize: (state: RequestLogStateSnapshot<TContext>) => void
  ) => {
    if (finalized) {
      return
    }

    finalized = true
    onFinalize({ requestId, status, severity, context: initialContext })
  }

  return {
    requestId,
    get status() {
      return status
    },
    get severity() {
      return severity
    },
    context: initialContext,
    annotate,
    setStatus,
    setSeverity,
    finalize,
  }
}
