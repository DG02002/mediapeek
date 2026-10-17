import type { RuntimeConfig } from "@mediapeek/shared/runtime-config"
import { Context, Layer } from "effect"

export interface RequestContextValue {
  readonly requestId: string
  readonly method: string
  readonly pathname: string
  readonly url: URL
  readonly headers: Headers
  readonly signal: AbortSignal
  readonly clientIp?: string
  readonly userAgent?: string
  readonly runtimeConfig: RuntimeConfig
}

export interface RequestContextInput {
  readonly request: Request
  readonly requestId: string
  readonly runtimeConfig: RuntimeConfig
  readonly signal?: AbortSignal
}

export const createRequestContext = (
  input: RequestContextInput
): RequestContextValue => {
  const url = new URL(input.request.url)

  return {
    requestId: input.requestId,
    method: input.request.method,
    pathname: url.pathname,
    url,
    headers: new Headers(input.request.headers),
    signal: input.signal ?? input.request.signal,
    clientIp: input.request.headers.get("CF-Connecting-IP") ?? undefined,
    userAgent: input.request.headers.get("User-Agent") ?? undefined,
    runtimeConfig: input.runtimeConfig,
  }
}

export class RequestContext extends Context.Service<
  RequestContext,
  RequestContextValue
>()("mediapeek/RequestContext") {
  static readonly layer = (requestContext: RequestContextValue) =>
    Layer.succeed(RequestContext, RequestContext.of(requestContext))
}
