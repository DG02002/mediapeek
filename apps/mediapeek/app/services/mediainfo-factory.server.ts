import type { MediaInfo } from 'mediainfo.js';

import mediaInfoFactory from '~/lib/mediainfo-bundle.js';

// @ts-expect-error - Import collocated WASM module for bundling
import wasmModule from './MediaInfoModule.wasm';

export { type MediaInfo };

type MediaInfoFactory = (options: {
  format: 'object';
  wasmModule: unknown;
}) => Promise<MediaInfo>;

const typedMediaInfoFactory = mediaInfoFactory as unknown as MediaInfoFactory;

/**
 * Creates a configured instance of MediaInfo.
 * Uses the esm-bundle which is environment-agnostic (web/worker compatible).
 * Imports WASM as a module to be bundled by Vite/Cloudflare (avoiding runtime compilation).
 */
export const createMediaInfo = async (): Promise<MediaInfo> => {
  return typedMediaInfoFactory({
    format: 'object',
    // Explicitly pass the module (handled by our patched bundle)
    wasmModule: wasmModule as unknown,
  });
};
