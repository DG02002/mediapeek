import type { RuntimeConfig } from "@mediapeek/shared/runtime-config"

export interface MediaPeekRequestContext {
  readonly env: Env
  readonly runtimeConfig: RuntimeConfig
}

declare module "@tanstack/react-router" {
  interface Register {
    server: { requestContext: MediaPeekRequestContext }
  }
}
