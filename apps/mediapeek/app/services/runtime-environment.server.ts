import { Context, Layer } from "effect"

interface RuntimeEnvironmentFetcher {
  readonly fetch: (
    input: RequestInfo | URL,
    init?: RequestInit
  ) => Promise<Response>
}

export interface RuntimeRateLimiter {
  readonly limit: (input: {
    readonly key: string
  }) => Promise<{ readonly success: boolean }>
}

export interface RuntimeEnvironmentValue {
  readonly analyzer?: RuntimeEnvironmentFetcher
  readonly rateLimiter?: RuntimeRateLimiter
  readonly rateLimitPerMinute?: number
}

export class RuntimeEnvironment extends Context.Service<
  RuntimeEnvironment,
  RuntimeEnvironmentValue
>()("mediapeek/RuntimeEnvironment") {
  static readonly layer = (environment: RuntimeEnvironmentValue) =>
    Layer.succeed(RuntimeEnvironment, RuntimeEnvironment.of(environment))
}
