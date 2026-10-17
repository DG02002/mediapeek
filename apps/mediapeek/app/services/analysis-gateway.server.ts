import type { AnalysisOutputId } from "@mediapeek/shared/analysis-output-formats"
import {
  AnalyzerRpcResponseSchema,
  type AnalyzerRpcResponse,
} from "@mediapeek/shared/analyze-contract"
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

export interface AnalysisGatewayRequest {
  readonly url: string
  readonly format: ReadonlyArray<AnalysisOutputId>
  readonly apiKey?: string
}

export interface AnalysisGatewayResponse {
  readonly status: number
  readonly contentType: string
  readonly data: AnalyzerRpcResponse
}

export const AnalysisGatewayErrorReasonSchema = Schema.Literals([
  "aborted",
  "binding-missing",
  "network",
  "invalid-response",
  "invalid-json",
  "invalid-contract",
])

export type AnalysisGatewayErrorReason =
  typeof AnalysisGatewayErrorReasonSchema.Type

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
    [INTERNAL_REQUEST_ID_HEADER]: requestContext.requestId,
  })

  if (input.apiKey) {
    headers.set("x-api-key", input.apiKey)
  }

  return headers
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

            return yield* Effect.fail(
              makeTransportError({
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
            )
          }

          let responseJson: unknown

          try {
            responseJson = JSON.parse(responseBody)
          } catch (cause) {
            return yield* Effect.fail(
              makeTransportError({
                requestContext,
                reason: "invalid-json",
                message: ANALYZER_MALFORMED_RESPONSE_MESSAGE,
                cause,
                responsePreview: responseBody.slice(
                  0,
                  ANALYZER_RESPONSE_PREVIEW_MAX_CHARS
                ),
              })
            )
          }

          const decodedResponse = Schema.decodeUnknownResult(
            AnalyzerRpcResponseSchema
          )(responseJson)

          if (Result.isFailure(decodedResponse)) {
            return yield* Effect.fail(
              makeTransportError({
                requestContext,
                reason: "invalid-contract",
                message: ANALYZER_MALFORMED_RESPONSE_MESSAGE,
                cause: decodedResponse.failure,
                responsePreview: responseBody.slice(
                  0,
                  ANALYZER_RESPONSE_PREVIEW_MAX_CHARS
                ),
              })
            )
          }

          return {
            status: response.status,
            contentType,
            data: decodedResponse.success,
          }
        })
      )

      return AnalysisGateway.of({ analyze })
    })
  )
}
