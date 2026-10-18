import { resolveRuntimeConfig } from "@mediapeek/shared/runtime-config"
import { evlog, type EvlogHonoOptions, type EvlogVariables } from "evlog/hono"
import type { MiddlewareHandler } from "hono"

interface AnalyzerBindings {
  ANALYZE_API_KEY?: string
  ANALYZE_CPU_BUDGET_MS?: string
  APP_ENV?: string
  LOG_SAMPLE_RATE?: string
  LOG_SLOW_REQUEST_MS?: string
  LOG_FORCE_ALL_REQUESTS?: string
  VERSION_METADATA?: { id: string }
}

export interface AnalyzerRequestLoggingEnvironment extends EvlogVariables {
  Bindings: AnalyzerBindings
}

const VALID_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/

const getIncomingRequestId = (request: Request): string => {
  const requestId = request.headers.get("x-request-id")?.trim()

  if (requestId && VALID_REQUEST_ID.test(requestId)) {
    return requestId
  }

  const propagated = request.headers.get("x-mediapeek-request-id")?.trim()

  if (propagated && VALID_REQUEST_ID.test(propagated)) {
    return propagated
  }

  return request.headers.get("cf-ray") ?? crypto.randomUUID()
}

export const requestLogging = (
  options?: EvlogHonoOptions
): MiddlewareHandler<AnalyzerRequestLoggingEnvironment> => {
  const callerKeep = options?.keep

  const evlogMiddleware = evlog({
    ...options,
    keep: async (context) => {
      if ((context.status ?? 0) >= 400) {
        context.shouldKeep = true
      }

      if (context.context.force_all_requests === true) {
        context.shouldKeep = true
      }

      await callerKeep?.(context)
    },
  })

  return async (context, next) => {
    const request = context.req.raw
    const requestId = getIncomingRequestId(request)
    const cloudflareRay = request.headers.get("cf-ray")
    const runtimeConfig = resolveRuntimeConfig(context.env)

    try {
      request.headers.set("x-request-id", requestId)
    } catch {
      // HACK: Incoming Worker request headers can be immutable; the response still carries the request ID.
    }

    context.header("x-request-id", requestId)

    await evlogMiddleware(context, async () => {
      context.get("log").set({
        request_id: requestId,
        operation: context.req.path.slice(1) || "root",
        app_env: runtimeConfig.appEnv,
        deployment_id: context.env.VERSION_METADATA?.id ?? null,
        force_all_requests: runtimeConfig.logForceAllRequests,
        cloudflare_ray: cloudflareRay,
        client_country: request.headers.get("cf-ipcountry") ?? "unknown",
        user_agent: request.headers.get("user-agent"),
      })

      await next()
    })
  }
}
