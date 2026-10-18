import {
  AnalyzeResponseSchema,
  type AnalyzeResponse as SharedAnalyzeResponse,
} from "@mediapeek/shared/analyze-contract"
import { Result, Schema } from "effect"

export type AnalyzeResponse = SharedAnalyzeResponse

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
  response.success
    ? "Unable to analyze URL. Verify the link is correct."
    : response.error.message

const getErrorCode = (response: AnalyzeResponse) =>
  response.success ? undefined : response.error.code

const createFallbackErrorResponse = (
  response: Response,
  message: string
): AnalyzeResponse => ({
  success: false,
  requestId: response.headers.get("x-request-id") ?? "unknown",
  error: {
    code: "INTERNAL_ERROR",
    message,
    retryable: false,
  },
})

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
      data: createFallbackErrorResponse(
        response,
        body?.trim() ||
          `Analyzer service returned an unexpected response (${String(response.status)}).`
      ),
    }
  }

  const parsed = Schema.decodeUnknownResult(AnalyzeResponseSchema)(
    await response.json()
  )

  if (Result.isFailure(parsed)) {
    return {
      status: response.status,
      data: createFallbackErrorResponse(
        response,
        "Analyzer service returned malformed data."
      ),
    }
  }

  return {
    status: response.status,
    data: parsed.success,
  }
}

export const fetchAnalyzeFormat = async ({
  url,
  format,
  requestTurnstileToken,
}: AnalyzeRequestArgs): Promise<AnalyzeClientResult> => {
  try {
    const initial = await requestAnalyzeFormat({ url, format })

    if (initial.status < 400 && initial.data.success) {
      const content = initial.data.results[format]

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

      if (retry.status < 400 && retry.data.success) {
        const content = retry.data.results[format]

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
