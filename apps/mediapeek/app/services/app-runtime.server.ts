import { Layer, ManagedRuntime } from "effect"
import type { ManagedRuntime as ManagedRuntimeType } from "effect/ManagedRuntime"

import { AnalysisGateway } from "./analysis-gateway.server"
import { AnalysisPolicy } from "./analysis-policy.server"
import {
  RuntimeEnvironment,
  type RuntimeEnvironmentValue,
} from "./runtime-environment.server"

export interface AppRuntime extends ManagedRuntimeType<
  RuntimeEnvironment | AnalysisGateway | AnalysisPolicy,
  never
> {}

const workerRuntimeCache = new WeakMap<object, AppRuntime>()

export const getAppRuntime = (
  environment: RuntimeEnvironmentValue
): AppRuntime =>
  ManagedRuntime.make(
    Layer.mergeAll(AnalysisGateway.layer, AnalysisPolicy.layer).pipe(
      Layer.provideMerge(RuntimeEnvironment.layer(environment))
    )
  )

export const getWorkerAppRuntime = (environment: Env): AppRuntime => {
  const cachedRuntime = workerRuntimeCache.get(environment)

  if (cachedRuntime) {
    return cachedRuntime
  }

  const runtime = getAppRuntime({
    analyzer: environment.ANALYZER,
    rateLimiter: environment.ANALYZE_RATE_LIMITER,
    rateLimitPerMinute: Number.parseInt(
      environment.ANALYZE_RATE_LIMIT_PER_MINUTE ?? "",
      10
    ),
  })

  workerRuntimeCache.set(environment, runtime)

  return runtime
}
