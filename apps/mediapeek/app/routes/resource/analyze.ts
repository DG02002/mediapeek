import { ANALYZE_PROGRESS_STREAM_CONTENT_TYPE } from "@mediapeek/shared/analyze-progress"
import { redactSensitiveUrl } from "@mediapeek/shared/log-redaction"
import type { RuntimeConfig } from "@mediapeek/shared/runtime-config"
import { type AnalyzeInput } from "@mediapeek/shared/schemas"
import { createFileRoute } from "@tanstack/react-router"
import { Effect } from "effect"

import {
  DEFAULT_ANALYZER_REQUEST_TIMEOUT_MS,
  MAX_ANALYZER_REQUEST_TIMEOUT_MS,
} from "~/constants"
import {
  createExecution,
  finalizeAnalyzeRequest,
  type AnalyzeExecution,
} from "~/lib/analyze-request-log.server"
import { requestStorage } from "~/lib/logger.server"
import {
  AnalysisGateway,
  AnalysisGatewayError,
  type AnalysisGatewayRequestBase,
} from "~/services/analysis-gateway.server"
import {
  AnalysisPolicy,
  AnalysisPolicyError,
} from "~/services/analysis-policy.server"
import { parseAnalyzeInput } from "~/services/analyze-input.server"
import {
  createPolicyErrorResponse,
  failRequest,
  getCompatibilityHeaders,
  handleAnalysisGatewayError,
  handleAnalysisGatewayResponse,
  handleUnexpectedError,
  mergeHeaders,
} from "~/services/analyze-response.server"
import { getWorkerAppRuntime } from "~/services/app-runtime.server"
import {
  createRequestContext,
  RequestContext,
} from "~/services/request-context.server"
import { authorizeTurnstile } from "~/services/turnstile-authorization.server"

export interface AnalyzeRouteArgs {
  readonly request: Request
  readonly context: { readonly env: Env; readonly runtimeConfig: RuntimeConfig }
}

interface AnalyzeRequestState {
  readonly request: Request
  readonly url: URL
  readonly env: Env
  readonly runtimeConfig: RuntimeConfig
  readonly requestLog: AnalyzeExecution["state"]
  compatibilityHeaders?: HeadersInit
  requestError?: Error
}

const wantsProgressStream = (request: Request) =>
  request.headers
    .get("accept")
    ?.toLowerCase()
    .includes(ANALYZE_PROGRESS_STREAM_CONTENT_TYPE) ?? false

const getAnalyzerTimeoutMs = (env: Env) => {
  const configured = Number.parseInt(env.ANALYZER_REQUEST_TIMEOUT_MS ?? "", 10)

  if (Number.isNaN(configured) || configured <= 0) {
    return DEFAULT_ANALYZER_REQUEST_TIMEOUT_MS
  }

  return Math.min(MAX_ANALYZER_REQUEST_TIMEOUT_MS, configured)
}

const validateAnalyzeRequest = async (
  state: AnalyzeRequestState
): Promise<
  { success: true; data: AnalyzeInput } | { success: false; response: Response }
> => {
  const parsed = await parseAnalyzeInput(state.request, state.url)
  state.compatibilityHeaders = getCompatibilityHeaders(parsed.legacyGet)
  state.requestLog.context.apiContract = parsed.legacyGet
    ? "legacy_get_query"
    : "post_json"

  const runtime = getWorkerAppRuntime(state.env)

  const requestContext = createRequestContext({
    request: state.request,
    requestId: state.requestLog.requestId,
    runtimeConfig: state.runtimeConfig,
  })

  try {
    const decision = await runtime.runPromise(
      Effect.gen(function* () {
        const analysisPolicy = yield* AnalysisPolicy

        return yield* analysisPolicy.authorize(parsed.policyInput)
      }).pipe(Effect.provideService(RequestContext, requestContext))
    )

    if (decision.rateLimitBindingError) {
      state.requestLog.context.rateLimitBindingError =
        decision.rateLimitBindingError
    }

    return { success: true, data: decision.input }
  } catch (caughtError) {
    if (!(caughtError instanceof AnalysisPolicyError)) {
      throw caughtError
    }

    return {
      success: false,
      response: createPolicyErrorResponse(state, caughtError),
    }
  }
}

const createAnalyzerSignal = (state: AnalyzeRequestState) =>
  AbortSignal.any([
    state.request.signal,
    AbortSignal.timeout(getAnalyzerTimeoutMs(state.env)),
  ])

const createAnalysisGatewayRequest = (
  state: AnalyzeRequestState,
  input: { data: AnalyzeInput; grantCookieHeader?: string },
  stream: boolean
) => {
  const apiKey = state.env.ANALYZE_API_KEY?.trim()

  const request: AnalysisGatewayRequestBase = apiKey
    ? { ...input.data, apiKey }
    : { ...input.data }

  if (stream) {
    return {
      ...request,
      mode: "stream" as const,
      responseHeaders: mergeHeaders(
        state.compatibilityHeaders,
        input.grantCookieHeader
          ? { "Set-Cookie": input.grantCookieHeader }
          : undefined
      ),
    }
  }

  return { ...request, mode: "json" as const }
}

const callAnalyzer = async (
  state: AnalyzeRequestState,
  input: {
    data: AnalyzeInput
    grantCookieHeader?: string
  }
) => {
  const initialUrl = input.data.url
  const redactedUrl = redactSensitiveUrl(initialUrl)

  state.requestLog.context.targetUrl = redactedUrl

  const stream = wantsProgressStream(state.request)
  const runtime = getWorkerAppRuntime(state.env)

  const requestContext = createRequestContext({
    request: state.request,
    requestId: state.requestLog.requestId,
    runtimeConfig: state.runtimeConfig,
    signal: createAnalyzerSignal(state),
  })

  try {
    const response = await runtime.runPromise(
      Effect.gen(function* () {
        const analysisGateway = yield* AnalysisGateway

        const gatewayRequest = createAnalysisGatewayRequest(
          state,
          input,
          stream
        )

        return yield* analysisGateway.analyze(gatewayRequest)
      }).pipe(Effect.provideService(RequestContext, requestContext))
    )

    return handleAnalysisGatewayResponse(
      state,
      response,
      input.grantCookieHeader
    )
  } catch (caughtError) {
    if (caughtError instanceof AnalysisGatewayError) {
      return handleAnalysisGatewayError(state, caughtError)
    }

    throw caughtError
  }
}

const executeAnalyzeRequest = async (
  state: AnalyzeRequestState
): Promise<Response> => {
  const validation = await validateAnalyzeRequest(state)

  if (!validation.success) {
    return validation.response
  }

  const turnstile = await authorizeTurnstile({
    request: state.request,
    requestId: state.requestLog.requestId,
    url: validation.data.url,
    env: state.env,
    runtimeConfig: state.runtimeConfig,
    createFailureResponse: (failure) => failRequest(state, failure),
  })

  if (turnstile.grantOutcome) {
    state.requestLog.context.turnstileGrantOutcome = turnstile.grantOutcome
  }

  if (turnstile.verification) {
    state.requestLog.context.turnstileVerification = {
      success: turnstile.verification.success,
      tokenPresent: turnstile.verification.tokenPresent,
      tokenLength: turnstile.verification.tokenLength,
      result: turnstile.verification.result,
      errorCodes: turnstile.verification.errorCodes,
    }
  }

  if (!turnstile.authorized) {
    if (turnstile.requestError) {
      state.requestError = turnstile.requestError
    }

    return turnstile.response
  }

  return callAnalyzer(state, {
    data: validation.data,
    grantCookieHeader: turnstile.grantCookieHeader,
  })
}

export const handleAnalyzeRequest = async (args: AnalyzeRouteArgs) => {
  const execution = createExecution({
    request: args.request,
    runtimeConfig: args.context.runtimeConfig,
  })

  const state: AnalyzeRequestState = {
    request: args.request,
    url: new URL(args.request.url),
    env: args.context.env,
    runtimeConfig: args.context.runtimeConfig,
    requestLog: execution.state,
    compatibilityHeaders: getCompatibilityHeaders(
      args.request.method !== "POST"
    ),
  }

  return requestStorage.run(execution.logContext, async () => {
    try {
      return await executeAnalyzeRequest(state)
    } catch (caughtError) {
      const error =
        caughtError instanceof Error
          ? caughtError
          : new Error(String(caughtError))

      return handleUnexpectedError(state, error)
    } finally {
      finalizeAnalyzeRequest(execution, state.requestError)
    }
  })
}

export const Route = createFileRoute("/resource/analyze")({
  server: {
    handlers: {
      GET: handleAnalyzeRequest,
      POST: handleAnalyzeRequest,
    },
  },
})
