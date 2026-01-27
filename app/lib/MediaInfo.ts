import type {
  AnalyzeCallback,
  MediaInfoInstance,
  MediaInfoModule,
  MediaInfoOptions,
  MediaInfoResult,
  ReadChunkCallback,
} from '~/types/mediainfo-wasm';

import { unknownToError } from './error';
import { FLOAT_FIELDS, INT_FIELDS } from './MediaInfoResult.js';

const MAX_UINT32_PLUS_ONE = 2 ** 32;

/** Format of the result type */
const FORMAT_CHOICES = ['JSON', 'XML', 'HTML', 'text'] as const;

const DEFAULT_OPTIONS: MediaInfoOptions = {
  coverData: false,
  chunkSize: 256 * 1024,
  format: 'object',
  full: false,
};

/**
 * Wrapper for the MediaInfoLib WASM module.
 *
 * This class should not be instantiated directly. Use the {@link mediaInfoFactory} function
 * to create instances of `MediaInfo`.
 *
 * @typeParam TFormat - The format type, defaults to `object`.
 */
class MediaInfo {
  isAnalyzing = false;
  private readonly mediainfoModule: MediaInfoModule;
  readonly options: MediaInfoOptions;
  private mediainfoModuleInstance: MediaInfoInstance;

  /** @group General Use */

  /**
   * The constructor should not be called directly, instead use {@link mediaInfoFactory}.
   *
   * @hidden
   * @param mediainfoModule WASM module
   * @param options User options
   */
  constructor(mediainfoModule: MediaInfoModule, options: MediaInfoOptions) {
    this.mediainfoModule = mediainfoModule;
    this.options = options;
    this.mediainfoModuleInstance = this.instantiateModuleInstance();
  }

  /**
   * Convenience method for analyzing a buffer chunk by chunk.
   *
   * @param size Return total buffer size in bytes.
   * @param readChunk Read chunk of data and return an {@link Uint8Array}.
   * @param callback Function that is called once the processing is done
   * @group General Use
   */
  analyzeData(
    size: number | (() => number | Promise<number>),
    readChunk: ReadChunkCallback,
  ): Promise<MediaInfoResult | string>;
  analyzeData(
    size: number | (() => number | Promise<number>),
    readChunk: ReadChunkCallback,
    callback: AnalyzeCallback,
  ): void;
  analyzeData(
    size: number | (() => number | Promise<number>),
    readChunk: ReadChunkCallback,
    callback?: AnalyzeCallback,
  ): Promise<MediaInfoResult | string> | void {
    if (callback === undefined) {
      return new Promise<MediaInfoResult | string>((resolve, reject) => {
        const resultCb: AnalyzeCallback = (result, error) => {
          this.isAnalyzing = false;
          if (error || !result) {
            reject(unknownToError(error));
          } else {
            resolve(result);
          }
        };
        this.analyzeData(size, readChunk, resultCb);
      });
    }

    if (this.isAnalyzing) {
      callback(
        '',
        new Error('cannot start a new analysis while another is in progress'),
      );
      return;
    }
    this.reset();
    this.isAnalyzing = true;

    const finalize = () => {
      try {
        this.openBufferFinalize();
        const result = this.inform();
        if (this.options.format === 'object') {
          callback(this.parseResultJson(result));
        } else {
          callback(result);
        }
      } finally {
        this.isAnalyzing = false;
      }
    };

    let offset = 0;
    const runReadDataLoop = (fileSize: number) => {
      const readNextChunk = (data: Uint8Array) => {
        if (continueBuffer(data)) {
          getChunk();
        } else {
          finalize();
        }
      };

      const getChunk = () => {
        let dataValue: Uint8Array | Promise<Uint8Array>;
        try {
          const safeSize = Math.min(this.options.chunkSize, fileSize - offset);
          dataValue = readChunk(safeSize, offset);
        } catch (error: unknown) {
          this.isAnalyzing = false;
          callback('', unknownToError(error));
          return;
        }
        if (dataValue instanceof Promise) {
          dataValue.then(readNextChunk).catch((error: unknown) => {
            this.isAnalyzing = false;
            callback('', unknownToError(error));
          });
        } else {
          readNextChunk(dataValue);
        }
      };

      const continueBuffer = (data: Uint8Array) => {
        if (data.length === 0 || this.openBufferContinue(data, data.length)) {
          return false;
        }
        const seekTo = this.openBufferContinueGotoGet();
        if (seekTo === -1) {
          offset += data.length;
        } else {
          offset = seekTo;
          this.openBufferInit(fileSize, seekTo);
        }
        return true;
      };

      this.openBufferInit(fileSize, offset);
      getChunk();
    };

    const fileSizeValue = typeof size === 'function' ? size() : size;
    if (fileSizeValue instanceof Promise) {
      fileSizeValue.then(runReadDataLoop).catch((error: unknown) => {
        callback('', unknownToError(error));
      });
    } else {
      runReadDataLoop(fileSizeValue);
    }
  }

  /**
   * Set a MediaInfo option.
   *
   * @param option The option name.
   * @param value The option value.
   * @returns The result of setting the option.
   * @group General Use
   */
  setOption(option: string, value: string): string {
    return this.mediainfoModuleInstance.Option(option, value);
  }

  /**
   * Close the MediaInfoLib WASM instance.
   *
   * @group General Use
   */
  close(): void {
    this.mediainfoModuleInstance.close();
  }

  /**
   * Reset the MediaInfoLib WASM instance to its initial state.
   *
   * This method ensures that the instance is ready for a new parse.
   * @group General Use
   */
  reset(): void {
    this.mediainfoModuleInstance.delete();
    this.mediainfoModuleInstance = this.instantiateModuleInstance();
  }

  /**
   * Receive result data from the WASM instance.
   *
   * (This is a low-level MediaInfoLib function.)
   *
   * @returns Result data (format can be configured in options)
   * @group Low-level
   */
  inform(): string {
    return this.mediainfoModuleInstance.inform();
  }

  /**
   * Send more data to the WASM instance.
   *
   * (This is a low-level MediaInfoLib function.)
   *
   * @param data Data buffer
   * @param size Buffer size
   * @returns Processing state: `0` (no bits set) = not finished, Bit `0` set = enough data read for providing information
   * @group Low-level
   */
  openBufferContinue(data: Uint8Array, size: number): boolean {
    // bit 3 set -> done
    return !!(
      this.mediainfoModuleInstance.open_buffer_continue(data, size) & 0x08
    );
  }

  /**
   * Retrieve seek position from WASM instance.
   * The MediaInfoLib function `Open_Buffer_GoTo` returns an integer with 64 bit precision.
   * It would be cut at 32 bit due to the JavaScript bindings. Here we transport the low and high
   * parts separately and put them together.
   *
   * (This is a low-level MediaInfoLib function.)
   *
   * @returns Seek position (where MediaInfoLib wants go in the data buffer)
   * @group Low-level
   */
  openBufferContinueGotoGet(): number {
    // JS bindings don't support 64 bit int
    // https://github.com/buzz/mediainfo.js/issues/11
    const seekToLow: number =
      this.mediainfoModuleInstance.open_buffer_continue_goto_get_lower();
    const seekToHigh: number =
      this.mediainfoModuleInstance.open_buffer_continue_goto_get_upper();

    if (seekToLow === -1 && seekToHigh === -1) {
      return -1;
    }

    if (seekToLow < 0) {
      return seekToLow + MAX_UINT32_PLUS_ONE + seekToHigh * MAX_UINT32_PLUS_ONE;
    }

    return seekToLow + seekToHigh * MAX_UINT32_PLUS_ONE;
  }

  /**
   * Inform MediaInfoLib that no more data is being read.
   *
   * (This is a low-level MediaInfoLib function.)
   *
   * @group Low-level
   */
  openBufferFinalize(): void {
    this.mediainfoModuleInstance.open_buffer_finalize();
  }

  /**
   * Prepare MediaInfoLib to process a data buffer.
   *
   * (This is a low-level MediaInfoLib function.)
   *
   * @param size Expected buffer size
   * @param offset Buffer offset
   * @group Low-level
   */
  openBufferInit(size: number, offset: number): void {
    this.mediainfoModuleInstance.open_buffer_init(size, offset);
  }

  /**
   * Parse result JSON. Convert integer/float fields.
   *
   * @param result Serialized JSON from MediaInfo
   * @returns Parsed JSON object
   */
  parseResultJson(resultString: string): MediaInfoResult {
    const intFields = INT_FIELDS;
    const floatFields = FLOAT_FIELDS;

    const result = JSON.parse(resultString) as MediaInfoResult;

    if (!result.media?.track) {
      return result;
    }

    const newTracks: Record<string, unknown>[] = [];

    for (const track of result.media.track) {
      const newTrack: Record<string, unknown> = {
        '@type': track['@type'],
      };

      for (const [key, val] of Object.entries(track)) {
        if (key === '@type') {
          continue;
        }
        if (typeof val === 'string' && intFields.includes(key)) {
          newTrack[key] = Number.parseInt(val, 10);
        } else if (typeof val === 'string' && floatFields.includes(key)) {
          newTrack[key] = Number.parseFloat(val);
        } else {
          newTrack[key] = val;
        }
      }

      newTracks.push(newTrack);
    }

    return {
      ...result,
      media: {
        ...result.media,
        track: newTracks as MediaInfoResult['media'] extends { track: infer T }
          ? T
          : never,
      },
    };
  }

  /**
   * Instantiate a new WASM module instance.
   *
   * @returns MediaInfo module instance
   */
  private instantiateModuleInstance(): MediaInfoInstance {
    const format =
      this.options.format === 'object' ? 'JSON' : this.options.format;
    return new this.mediainfoModule.MediaInfo(
      format ?? 'JSON',
      this.options.coverData ?? false,
      this.options.full ?? false,
    );
  }
}

export { DEFAULT_OPTIONS, FORMAT_CHOICES };
export type { MediaInfoOptions };
export default MediaInfo;
