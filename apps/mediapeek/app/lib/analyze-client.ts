import { Result, Schema } from "effect"

const AnalyzeResponseErrorSchema = Schema.Struct({
  code: Schema.optionalKey(Schema.String),
  message: Schema.optionalKey(Schema.String),
  retryable: Schema.optionalKey(Schema.Boolean),
})

const AnalyzeResponseSchema = Schema.Struct({
  success: Schema.optionalKey(Schema.Boolean),
  requestId: Schema.optionalKey(Schema.String),
  results: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  error: Schema.optionalKey(
    Schema.Union([Schema.String, AnalyzeResponseErrorSchema])
  ),
})

type AnalyzeResponseWire = typeof AnalyzeResponseSchema.Type

export type AnalyzeResponse = Omit<AnalyzeResponseWire, "error"> & {
  error?: { code?: string; message?: string; retryable?: boolean }
}

const normalizeAnalyzeResponse = (
  response: AnalyzeResponseWire
): AnalyzeResponse => {
  const { error, ...fields } = response

  if (error === undefined) {
    return fields
  }

  const stringError = Schema.decodeUnknownResult(Schema.String)(error)

  if (Result.isFailure(stringError)) {
    const objectError = Schema.decodeUnknownResult(AnalyzeResponseErrorSchema)(
      error
    )

    if (Result.isFailure(objectError)) {
      return fields
    }

    return { ...fields, error: objectError.success }
  }

  return { ...fields, error: { message: stringError.success } }
}

export type AnalyzeClientResult =
  | {
      ok: true
      content: string
      requestId?: string
      retriedWithTurnstile: boolean
    }
  | {
      ok: false
      message: string
      status?: number
      code?: string
      retriedWithTurnstile: boolean
    }

type AnalyzeRequestArgs = {
  url: string
  format: string
  requestTurnstileToken?: () => Promise<string | null>
}

const getErrorMessage = (response: AnalyzeResponse) =>
  response.error?.message ??
  "Unable to analyze URL. Verify the link is correct."

const getErrorCode = (response: AnalyzeResponse) => response.error?.code

const shouldRetryWithTurnstile = (
  status: number,
  response: AnalyzeResponse
) => {
  if (status !== 403) {
    return false
  }

  const code = getErrorCode(response)

  return code === "AUTH_REQUIRED" || code === "AUTH_INVALID"
}

const requestAnalyzeFormat = async ({
  url,
  format,
  turnstileToken,
}: {
  url: string
  format: string
  turnstileToken?: string
}) => {
  const headers = new Headers({ "Content-Type": "application/json" })

  if (turnstileToken) {
    headers.set("CF-Turnstile-Response", turnstileToken)
  }

  const response = await fetch("/resource/analyze", {
    method: "POST",
    headers,
    body: JSON.stringify({
      url,
      format: [format],
    }),
  })

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""

  if (!contentType.includes("application/json")) {
    const body = await response.text()

    return {
      status: response.status,
      data: {
        success: false,
        error: {
          message:
            body?.trim() ||
            `Analyzer service returned an unexpected response (${String(response.status)}).`,
        },
      } satisfies AnalyzeResponse,
    }
  }

  const parsed = Schema.decodeUnknownResult(AnalyzeResponseSchema)(
    await response.json()
  )

  if (Result.isFailure(parsed)) {
    return {
      status: response.status,
      data: {
        success: false,
        error: { message: "Analyzer service returned malformed data." },
      } satisfies AnalyzeResponse,
    }
  }

  return {
    status: response.status,
    data: normalizeAnalyzeResponse(parsed.success),
  }
}

export const fetchAnalyzeFormat = async ({
  url,
  format,
  requestTurnstileToken,
}: AnalyzeRequestArgs): Promise<AnalyzeClientResult> => {
  try {
    const initial = await requestAnalyzeFormat({ url, format })

    if (initial.status < 400 && initial.data.success !== false) {
      const content = initial.data.results?.[format]

      if (content) {
        return {
          ok: true,
          content,
          requestId: initial.data.requestId,
          retriedWithTurnstile: false,
        }
      }

      return {
        ok: false,
        message: `No ${format.toUpperCase()} content returned.`,
        status: initial.status,
        retriedWithTurnstile: false,
      }
    }

    if (
      shouldRetryWithTurnstile(initial.status, initial.data) &&
      requestTurnstileToken
    ) {
      const token = await requestTurnstileToken()

      if (!token) {
        return {
          ok: false,
          message: "Verification was cancelled.",
          status: 403,
          code: "AUTH_REQUIRED",
          retriedWithTurnstile: true,
        }
      }

      const retry = await requestAnalyzeFormat({
        url,
        format,
        turnstileToken: token,
      })

      if (retry.status < 400 && retry.data.success !== false) {
        const content = retry.data.results?.[format]

        if (content) {
          return {
            ok: true,
            content,
            requestId: retry.data.requestId,
            retriedWithTurnstile: true,
          }
        }

        return {
          ok: false,
          message: `No ${format.toUpperCase()} content returned.`,
          status: retry.status,
          retriedWithTurnstile: true,
        }
      }

      return {
        ok: false,
        message: getErrorMessage(retry.data),
        status: retry.status,
        code: getErrorCode(retry.data),
        retriedWithTurnstile: true,
      }
    }

    return {
      ok: false,
      message: getErrorMessage(initial.data),
      status: initial.status,
      code: getErrorCode(initial.data),
      retriedWithTurnstile: false,
    }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Network error while requesting analysis.",
      retriedWithTurnstile: false,
    }
  }
}
