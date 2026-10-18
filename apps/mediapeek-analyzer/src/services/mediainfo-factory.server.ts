import { Schema } from "effect"

import type { JsonMediaInfo } from "../lib/media-utils"
import { mediaInfoFactory } from "../lib/mediainfo-bundle.js"

type MediaInfoOptions = Awaited<ReturnType<typeof mediaInfoFactory>>["options"]

export interface MediaInfoInstance {
  wasmLoadTimeMs?: number
  factoryCreateTimeMs?: number
  options: MediaInfoOptions
  reset: () => void
  analyzeData: (
    size: () => number,
    readChunk: (size: number, offset: number) => Promise<Uint8Array>
  ) => Promise<JsonMediaInfo>
  inform: () => string
  close: () => void
}

export const createMediaInfo = async (): Promise<MediaInfoInstance> => {
  const wasmLoadStart = performance.now()
  const { default: wasmModule } = await import("./MediaInfoModule.wasm")
  const wasmLoadTimeMs = Math.round(performance.now() - wasmLoadStart)

  const factoryCreateStart = performance.now()

  const mediaInfo = await mediaInfoFactory({
    format: "object",
    wasmModule,
  })

  const factoryCreateTimeMs = Math.round(performance.now() - factoryCreateStart)

  return {
    wasmLoadTimeMs,
    factoryCreateTimeMs,
    options: mediaInfo.options,
    reset: () => mediaInfo.reset(),
    analyzeData: async (size, readChunk) =>
      Schema.decodeUnknownSync(Schema.Json)(
        await mediaInfo.analyzeData(size, readChunk)
      ),
    inform: () => mediaInfo.inform(),
    close: () => mediaInfo.close(),
  }
}
