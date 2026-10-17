import type { RuntimeConfig } from "@mediapeek/shared/runtime-config"
import { createContext } from "react-router"

export interface MediaPeekCloudflareContext {
  readonly env: Env
  readonly ctx: ExecutionContext
  readonly runtimeConfig: RuntimeConfig
}

export const cloudflareContext = createContext<MediaPeekCloudflareContext>()
