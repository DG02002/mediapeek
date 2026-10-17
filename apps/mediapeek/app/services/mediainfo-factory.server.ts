import patchedMediaInfoFactory from "~/lib/mediainfo-bundle.js"

import wasmModule from "./MediaInfoModule.wasm"

type MediaInfoFormat = "object" | "Text" | "XML" | "HTML"

const createPatchedMediaInfo = (format: MediaInfoFormat) =>
  patchedMediaInfoFactory({ format, wasmModule })

/**
 * Creates a configured instance of MediaInfo.
 * Uses the esm-bundle which is environment-agnostic (web/worker compatible).
 * Imports WASM as a module to be bundled by Vite/Cloudflare (avoiding runtime compilation).
 */
export const createMediaInfo = (format: MediaInfoFormat = "object") =>
  createPatchedMediaInfo(format)
