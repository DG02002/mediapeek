/**
 * Type definitions for MediaInfo.js WASM module.
 *
 * These types define the interface for the MediaInfo WASM library
 * which provides media file analysis capabilities.
 *
 * @see https://github.com/nicken/mediainfo.js
 * @module mediainfo-wasm
 */

import type { MediaInfoJSON, MediaTrackJSON } from './media';

/**
 * MediaInfo WASM instance methods.
 * This interface represents an instantiated MediaInfo object from the WASM module.
 */
export interface MediaInfoInstance {
  /**
   * Set/get a MediaInfo option.
   * @param name - The option name
   * @param value - Optional value to set
   * @returns The option value
   */
  Option: (name: string, value?: string) => string;

  /**
   * Close the current media file and free resources.
   */
  close: () => void;

  /**
   * Delete the MediaInfo instance.
   * Must be called to prevent memory leaks in WASM.
   */
  delete: () => void;

  /**
   * Get the analysis result as a formatted string.
   * @returns Result in the format specified during construction (JSON, XML, HTML, text)
   */
  inform: () => string;

  /**
   * Continue processing a data buffer.
   * @param data - Chunk of file data
   * @param length - Length of the data chunk
   * @returns Processing state bitfield (bit 3 set = done)
   */
  open_buffer_continue: (data: Uint8Array, length: number) => number;

  /**
   * Get the lower 32 bits of the seek position.
   * Used with open_buffer_continue_goto_get_upper for 64-bit precision.
   * @returns Lower 32 bits of seek position, or -1 if not applicable
   */
  open_buffer_continue_goto_get_lower: () => number;

  /**
   * Get the upper 32 bits of the seek position.
   * Used with open_buffer_continue_goto_get_lower for 64-bit precision.
   * @returns Upper 32 bits of seek position, or -1 if not applicable
   */
  open_buffer_continue_goto_get_upper: () => number;

  /**
   * Initialize buffer processing for a file.
   * @param size - Total file size in bytes
   * @param offset - Starting offset in the file
   */
  open_buffer_init: (size: number, offset: number) => void;

  /**
   * Finalize buffer processing.
   * Call this when all data has been sent via open_buffer_continue.
   */
  open_buffer_finalize: () => void;
}

/**
 * MediaInfo constructor interface.
 * This is the class constructor exposed by the WASM module.
 */
export type MediaInfoConstructor = new (
  format: 'JSON' | 'XML' | 'HTML' | 'text',
  coverData: boolean,
  full: boolean,
) => MediaInfoInstance;

/**
 * The MediaInfo WASM module interface.
 * This represents the loaded WASM module with the MediaInfo class.
 */
export interface MediaInfoModule {
  MediaInfo: MediaInfoConstructor;
}

/**
 * Factory function signature for creating MediaInfo module from WASM.
 * This is the default export of the mediainfo.js package.
 */
export type MediaInfoFactory = (config?: {
  locateFile?: (path: string, prefix: string) => string;
  format?: string;
}) => Promise<MediaInfoModule>;

/**
 * Parsed media result with typed tracks.
 * This extends the base MediaInfoJSON with proper track typing.
 */
export interface MediaInfoResult extends MediaInfoJSON {
  media?: {
    track: MediaTrackJSON[];
    '@ref'?: string;
  };
}

/**
 * Callback signature for analyze operations.
 */
export type AnalyzeCallback<T = MediaInfoResult | string> = (
  result: T,
  error?: Error,
) => void;

/**
 * Options for MediaInfo instance configuration.
 */
export interface MediaInfoOptions {
  /** Whether to include cover/artwork data */
  coverData?: boolean;
  /** Size of chunks to read at a time (default: 256KB) */
  chunkSize: number;
  /** Output format */
  format?: 'object' | 'JSON' | 'XML' | 'HTML' | 'text';
  /** Whether to include full/detailed information */
  full?: boolean;
}

/**
 * Read chunk callback signature.
 * Called by analyzeData to read file data in chunks.
 */
export type ReadChunkCallback = (
  size: number,
  offset: number,
) => Uint8Array | Promise<Uint8Array>;
