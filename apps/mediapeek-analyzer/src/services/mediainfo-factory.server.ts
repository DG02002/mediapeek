import type { MediaInfo } from 'mediainfo.js';

import mediaInfoFactory from '../lib/mediainfo-bundle.js';
// @ts-expect-error - Import collocated WASM module for bundling
import wasmModule from './MediaInfoModule.wasm';

export { type MediaInfo };

/**
 * Creates a configured instance of MediaInfo.
 * Uses the esm-bundle which is environment-agnostic (web/worker compatible).
 * Imports WASM as a module to be bundled by Vite/Cloudflare (avoiding runtime compilation).
 */
export const createMediaInfo = async (): Promise<MediaInfo> => {
  return mediaInfoFactory({
    format: 'object',
    // Explicitly pass the module (handled by our patched bundle)
    wasmModule: wasmModule as unknown as WebAssembly.Module,
  });
};
