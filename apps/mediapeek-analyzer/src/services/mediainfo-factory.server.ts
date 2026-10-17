import { Schema } from "effect"

import type { JsonMediaInfo } from "../lib/media-utils"
import { mediaInfoFactory } from "../lib/mediainfo-bundle.js"

type MediaInfoOptions = Awaited<ReturnType<typeof mediaInfoFactory>>["options"]

export interface MediaInfoInstance {
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
  const { default: wasmModule } = await import("./MediaInfoModule.wasm")

  const mediaInfo = await mediaInfoFactory({
    format: "object",
    wasmModule,
  })

  return {
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
