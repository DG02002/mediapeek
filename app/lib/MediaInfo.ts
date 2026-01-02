import { unknownToError } from './error';
import { FLOAT_FIELDS, INT_FIELDS } from './MediaInfoResult.js';

const MAX_UINT32_PLUS_ONE = 2 ** 32;

/** Format of the result type */
const FORMAT_CHOICES = ['JSON', 'XML', 'HTML', 'text'];

interface MediaInfoOptions {
  coverData?: boolean;
  chunkSize: number;
  format?: 'object' | 'JSON' | 'XML' | 'HTML' | 'text';
  full?: boolean;
}

const DEFAULT_OPTIONS: MediaInfoOptions = {
  coverData: false,
  chunkSize: 256 * 1024,
  format: 'object',
  full: false,
};

type ReadChunkCallback = (
  size: number,
  offset: number,
) => Uint8Array | Promise<Uint8Array>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnalyzeCallback = (result: any, error?: Error) => void;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mediainfoModule: any;
  options: MediaInfoOptions;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mediainfoModuleInstance: any;

  /** @group General Use */

  /**
   * The constructor should not be called directly, instead use {@link mediaInfoFactory}.
   *
   * @hidden
   * @param mediainfoModule WASM module
   * @param options User options
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(mediainfoModule: any, options: MediaInfoOptions) {
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
    callback?: AnalyzeCallback,
  ) {
    if (callback === undefined) {
      return new Promise((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resultCb = (result: any, error?: Error) => {
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
        let dataValue;
        try {
          const safeSize = Math.min(this.options.chunkSize, fileSize - offset);
          dataValue = readChunk(safeSize, offset);
        } catch (error) {
          this.isAnalyzing = false;
          callback('', unknownToError(error));
          return;
        }
        if (dataValue instanceof Promise) {
          dataValue.then(readNextChunk).catch((error) => {
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
      fileSizeValue.then(runReadDataLoop).catch((error) => {
        callback(null, unknownToError(error));
      });
    } else {
      runReadDataLoop(fileSizeValue as number);
    }
  }

  /**
   * Close the MediaInfoLib WASM instance.
   *
   * @group General Use
   */
  close() {
    if (typeof this.mediainfoModuleInstance.close === 'function') {
      this.mediainfoModuleInstance.close();
    }
  }

  /**
   * Reset the MediaInfoLib WASM instance to its initial state.
   *
   * This method ensures that the instance is ready for a new parse.
   * @group General Use
   */
  reset() {
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
  inform() {
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
  openBufferContinue(data: Uint8Array, size: number) {
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
  openBufferContinueGotoGet() {
    // JS bindings don't support 64 bit int
    // https://github.com/buzz/mediainfo.js/issues/11
    let seekTo = -1;
    const seekToLow =
      this.mediainfoModuleInstance.open_buffer_continue_goto_get_lower();
    const seekToHigh =
      this.mediainfoModuleInstance.open_buffer_continue_goto_get_upper();
    if (seekToLow == -1 && seekToHigh == -1) {
      seekTo = -1;
    } else if (seekToLow < 0) {
      seekTo =
        seekToLow + MAX_UINT32_PLUS_ONE + seekToHigh * MAX_UINT32_PLUS_ONE;
    } else {
      seekTo = seekToLow + seekToHigh * MAX_UINT32_PLUS_ONE;
    }
    return seekTo;
  }

  /**
   * Inform MediaInfoLib that no more data is being read.
   *
   * (This is a low-level MediaInfoLib function.)
   *
   * @group Low-level
   */
  openBufferFinalize() {
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
  openBufferInit(size: number, offset: number) {
    this.mediainfoModuleInstance.open_buffer_init(size, offset);
  }

  /**
   * Parse result JSON. Convert integer/float fields.
   *
   * @param result Serialized JSON from MediaInfo
   * @returns Parsed JSON object
   */
  parseResultJson(resultString: string) {
    const intFields = INT_FIELDS;
    const floatFields = FLOAT_FIELDS;

    const result = JSON.parse(resultString);
    if (result.media) {
      const newMedia = {
        ...result.media,
        track: [],
      };
      if (Array.isArray(result.media.track)) {
        for (const track of result.media.track) {
          let newTrack = {
            '@type': track['@type'],
          };
          for (const [key, val] of Object.entries(track)) {
            if (key === '@type') {
              continue;
            }
            if (typeof val === 'string' && intFields.includes(key)) {
              newTrack = {
                ...newTrack,
                [key]: Number.parseInt(val, 10),
              };
            } else if (typeof val === 'string' && floatFields.includes(key)) {
              newTrack = {
                ...newTrack,
                [key]: Number.parseFloat(val),
              };
            } else {
              newTrack = {
                ...newTrack,
                [key]: val,
              };
            }
          }
          newMedia.track.push(newTrack);
        }
      }
      return {
        ...result,
        media: newMedia,
      };
    }
    return result;
  }

  /**
   * Instantiate a new WASM module instance.
   *
   * @returns MediaInfo module instance
   */
  instantiateModuleInstance() {
    return new this.mediainfoModule.MediaInfo(
      this.options.format === 'object' ? 'JSON' : this.options.format,
      this.options.coverData,
      this.options.full,
    );
  }
}
export { DEFAULT_OPTIONS, FORMAT_CHOICES };
export default MediaInfo;
