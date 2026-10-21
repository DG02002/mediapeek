import type { RuntimeConfig } from "@mediapeek/shared/runtime-config"

export interface MediaPeekRequestContext {
  readonly env: Env
  readonly runtimeConfig: RuntimeConfig
  readonly nonce: string
}

declare module "@tanstack/react-router" {
  interface Register {
    server: { requestContext: MediaPeekRequestContext }
  }
}
