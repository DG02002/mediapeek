import type { AnalysisOutputId } from "@mediapeek/shared/analysis-output-formats"
import {
  AnalyzerRpcResponseSchema,
  type AnalyzerRpcResponse,
} from "@mediapeek/shared/analyze-contract"
import { ANALYZE_PROGRESS_STREAM_CONTENT_TYPE } from "@mediapeek/shared/analyze-progress"
import { Context, Effect, Layer, Result, Schema } from "effect"

import {
  RequestContext,
  type RequestContextValue,
} from "./request-context.server"
import { RuntimeEnvironment } from "./runtime-environment.server"

const ANALYZER_REQUEST_URL = "https://analyzer/analyze"
const INTERNAL_REQUEST_ID_HEADER = "x-mediapeek-request-id"

const ANALYZER_MALFORMED_RESPONSE_MESSAGE =
  "Analyzer service returned malformed data. Try again."

const ANALYZER_UNEXPECTED_RESPONSE_MESSAGE =
  "Analyzer service returned an unexpected response. Try again."

const ANALYZER_TIMEOUT_MESSAGE =
  "Analysis request timed out upstream. Retry with a smaller or simpler source URL."

const ANALYZER_UNAVAILABLE_MESSAGE =
  "Analyzer service is unavailable. Try again in a moment."

const ANALYZER_RESPONSE_PREVIEW_MAX_CHARS = 240

export type AnalysisStreamOutcome = "completed" | "failed" | "cancelled"

export interface AnalysisGatewayRequestBase {
  readonly url: string
  readonly format: ReadonlyArray<AnalysisOutputId>
  readonly apiKey?: string
}

export type AnalysisGatewayRequest =
  | (AnalysisGatewayRequestBase & { readonly mode?: "json" })
  | (AnalysisGatewayRequestBase & {
      readonly mode: "stream"
      readonly responseHeaders?: HeadersInit
      readonly onStreamSettled: (outcome: AnalysisStreamOutcome) => void
    })

interface AnalysisGatewayJsonResponse {
  readonly mode: "json"
  readonly status: number
  readonly contentType: string
  readonly data: AnalyzerRpcResponse
}

interface AnalysisGatewayStreamResponse {
  readonly mode: "stream"
  readonly status: number
  readonly contentType: string
  readonly response: Response
}

export type AnalysisGatewayResponse =
  | AnalysisGatewayJsonResponse
  | AnalysisGatewayStreamResponse

const AnalysisGatewayErrorReasonSchema = Schema.Literals([
  "aborted",
  "binding-missing",
  "network",
  "invalid-response",
  "invalid-json",
  "invalid-contract",
])

type AnalysisGatewayErrorReason = typeof AnalysisGatewayErrorReasonSchema.Type

export class AnalysisGatewayError extends Schema.TaggedError<AnalysisGatewayError>()(
  "AnalysisGatewayError",
  {
    reason: AnalysisGatewayErrorReasonSchema,
    message: Schema.String,
    retryable: Schema.Boolean,
    cause: Schema.Defect(),
    responsePreview: Schema.optionalKey(Schema.String),
  }
) {}

const makeTransportError = (input: {
  readonly requestContext: RequestContextValue
  readonly reason: Exclude<
    AnalysisGatewayErrorReason,
    "aborted" | "binding-missing"
  >
  readonly message: string
  readonly cause: unknown
  readonly responsePreview?: string
}) => {
  const { requestContext, reason, cause, responsePreview } = input
  let errorReason: AnalysisGatewayErrorReason = reason
  let errorMessage = input.message

  if (requestContext.signal.aborted) {
    errorReason = "aborted"
    errorMessage = ANALYZER_TIMEOUT_MESSAGE
  }

  if (responsePreview) {
    return new AnalysisGatewayError({
      reason: errorReason,
      message: errorMessage,
      retryable: true,
      cause,
      responsePreview,
    })
  }

  return new AnalysisGatewayError({
    reason: errorReason,
    message: errorMessage,
    retryable: true,
    cause,
  })
}

const makeRequestHeaders = (
  input: AnalysisGatewayRequest,
  requestContext: RequestContextValue
) => {
  const headers = new Headers({
    "content-type": "application/json",
    "x-request-id": requestContext.requestId,
    [INTERNAL_REQUEST_ID_HEADER]: requestContext.requestId,
  })

  const userAgent = requestContext.headers.get("user-agent")
  const clientIp = requestContext.headers.get("cf-connecting-ip")
  const clientCountry = requestContext.headers.get("cf-ipcountry")

  if (userAgent !== null) {
    headers.set("user-agent", userAgent)
  }

  if (clientIp !== null) {
    headers.set("cf-connecting-ip", clientIp)
  }

  if (clientCountry !== null) {
    headers.set("cf-ipcountry", clientCountry)
  }

  if (input.apiKey) {
    headers.set("x-api-key", input.apiKey)
  }

  if (input.mode === "stream") {
    headers.set("accept", ANALYZE_PROGRESS_STREAM_CONTENT_TYPE)
  }

  return headers
}

const wrapStreamForSettlement = (
  body: ReadableStream<Uint8Array> | null,
  onSettled: (outcome: AnalysisStreamOutcome) => void
): ReadableStream<Uint8Array> | null => {
  if (!body) {
    onSettled("completed")

    return null
  }

  const reader = body.getReader()
  let settled = false

  const settle = (outcome: AnalysisStreamOutcome) => {
    if (settled) {
      return
    }

    settled = true
    onSettled(outcome)
  }

  const pump = (
    controller: ReadableStreamDefaultController<Uint8Array>
  ): Promise<void> =>
    reader.read().then(
      ({ done, value }) => {
        if (settled) {
          return
        }

        if (done) {
          controller.close()
          settle("completed")

          return
        }

        try {
          controller.enqueue(value)
        } catch (error) {
          controller.error(error)
          settle("failed")

          return
        }

        void pump(controller)
      },
      (error) => {
        if (!settled) {
          controller.error(error)
          settle("failed")
        }
      }
    )

  return new ReadableStream<Uint8Array>({
    start: pump,
    cancel(reason) {
      settle("cancelled")

      return reader.cancel(reason)
    },
  })
}

const makeStreamResponse = (
  response: Response,
  responseHeaders: HeadersInit | undefined,
  onStreamSettled: (outcome: AnalysisStreamOutcome) => void
) => {
  const headers = new Headers(response.headers)

  if (responseHeaders) {
    new Headers(responseHeaders).forEach((value, key) => {
      headers.append(key, value)
    })
  }

  headers.set("cache-control", "no-store")

  return new Response(wrapStreamForSettlement(response.body, onStreamSettled), {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

export class AnalysisGateway extends Context.Service<
  AnalysisGateway,
  {
    analyze(
      input: AnalysisGatewayRequest
    ): Effect.Effect<
      AnalysisGatewayResponse,
      AnalysisGatewayError,
      RequestContext
    >
  }
>()("mediapeek/AnalysisGateway") {
  static readonly layer: Layer.Layer<
    AnalysisGateway,
    never,
    RuntimeEnvironment
  > = Layer.effect(
    AnalysisGateway,
    Effect.gen(function* () {
      const runtimeEnvironment = yield* RuntimeEnvironment

      const analyze = Effect.fn("AnalysisGateway.analyze")((input) =>
        Effect.gen(function* () {
          const requestContext = yield* RequestContext
          const analyzerBinding = runtimeEnvironment.analyzer

          if (analyzerBinding === undefined) {
            return yield* new AnalysisGatewayError({
              reason: "binding-missing",
              message: ANALYZER_UNAVAILABLE_MESSAGE,
              retryable: true,
              cause: "ANALYZER",
            })
          }

          const response = yield* Effect.tryPromise({
            try: () =>
              analyzerBinding.fetch(ANALYZER_REQUEST_URL, {
                method: "POST",
                headers: makeRequestHeaders(input, requestContext),
                body: JSON.stringify({
                  url: input.url,
                  format: input.format,
                }),
                signal: requestContext.signal,
              }),
            catch: (cause) =>
              makeTransportError({
                requestContext,
                reason: "network",
                message: ANALYZER_UNAVAILABLE_MESSAGE,
                cause,
              }),
          })

          const contentType =
            response.headers.get("content-type")?.toLowerCase() ?? ""

          if (input.mode === "stream") {
            return {
              mode: "stream",
              status: response.status,
              contentType,
              response: makeStreamResponse(
                response,
                input.responseHeaders,
                input.onStreamSettled
              ),
            } satisfies AnalysisGatewayStreamResponse
          }

          const responseBody = yield* Effect.tryPromise({
            try: () => response.text(),
            catch: (cause) =>
              makeTransportError({
                requestContext,
                reason: "invalid-response",
                message: ANALYZER_UNEXPECTED_RESPONSE_MESSAGE,
                cause,
              }),
          })

          if (!contentType.includes("application/json")) {
            const isMissingLocalDevSession =
              /couldn't find a local dev session/i.test(responseBody)

            return yield* makeTransportError({
              requestContext,
              reason: "invalid-response",
              message: isMissingLocalDevSession
                ? "Analyzer local dev worker is unavailable. Restart `pnpm dev` and retry."
                : ANALYZER_UNEXPECTED_RESPONSE_MESSAGE,
              cause: responseBody,
              responsePreview: responseBody.slice(
                0,
                ANALYZER_RESPONSE_PREVIEW_MAX_CHARS
              ),
            })
          }

          let responseJson: unknown

          try {
            responseJson = JSON.parse(responseBody)
          } catch (cause) {
            return yield* makeTransportError({
              requestContext,
              reason: "invalid-json",
              message: ANALYZER_MALFORMED_RESPONSE_MESSAGE,
              cause,
              responsePreview: responseBody.slice(
                0,
                ANALYZER_RESPONSE_PREVIEW_MAX_CHARS
              ),
            })
          }

          const decodedResponse = Schema.decodeUnknownResult(
            AnalyzerRpcResponseSchema
          )(responseJson)

          if (Result.isFailure(decodedResponse)) {
            return yield* makeTransportError({
              requestContext,
              reason: "invalid-contract",
              message: ANALYZER_MALFORMED_RESPONSE_MESSAGE,
              cause: decodedResponse.failure,
              responsePreview: responseBody.slice(
                0,
                ANALYZER_RESPONSE_PREVIEW_MAX_CHARS
              ),
            })
          }

          return {
            mode: "json",
            status: response.status,
            contentType,
            data: decodedResponse.success,
          } satisfies AnalysisGatewayJsonResponse
        })
      )

      return AnalysisGateway.of({ analyze })
    })
  )
}
