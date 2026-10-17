// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/* eslint-disable */
function isError(error) {
  return (
    error !== null &&
    typeof error === 'object' &&
    Object.prototype.hasOwnProperty.call(error, 'message')
  );
}
function unknownToError(error) {
  if (isError(error)) {
    return error;
  }
  return new Error(typeof error === 'string' ? error : 'Unknown error');
}

// DO NOT EDIT! File generated using `generate-types` script.
//
// -----------------------------------------------------------------------------
// PATCHED FOR CLOUDFLARE WORKERS (MEDIA PEEK)
// -----------------------------------------------------------------------------
// This file is a vendored copy of `mediainfo.js` (v0.3.7) esm-bundle.
// It has been patched to support pre-compiled WebAssembly Modules, which is
// required for Cloudflare Workers where 'Wasm code generation' is disallowed.
//
// PATCH DESCRIPTION:
// 1. mediaInfoFactory (Bottom of file): Modified to pass `options.wasmModule`
//    to the inner `Module` constructor. Upstream filters this out.
// 2. instantiateAsync (Middle of file): Modified to check for `Module['wasmModule']`
//    and use `WebAssembly.instantiate(module, imports)` directly.
//
// HOW TO UPDATE:
// If you update `mediainfo.js`, you must copy `dist/esm-bundle/index.js` here
// and Re-Apply the changes described above.
// -----------------------------------------------------------------------------

const INT_FIELDS = [
  'Active_Height',
  'Active_Width',
  'AudioCount',
  'Audio_Channels_Total',
  'BitDepth_Detected',
  'BitDepth',
  'BitDepth_Stored',
  'Channels',
  'Channels_Original',
  'Chapters_Pos_Begin',
  'Chapters_Pos_End',
  'Comic_Position_Total',
  'Count',
  'DataSize',
  'ElementCount',
  'EPG_Positions_Begin',
  'EPG_Positions_End',
  'FirstPacketOrder',
  'FooterSize',
  'Format_Settings_GMC',
  'Format_Settings_RefFrames',
  'Format_Settings_SliceCount',
  'FrameCount',
  'FrameRate_Den',
  'FrameRate_Num',
  'GeneralCount',
  'HeaderSize',
  'Height_CleanAperture',
  'Height',
  'Height_Offset',
  'Height_Original',
  'ImageCount',
  'Lines_MaxCharacterCount',
  'Lines_MaxCountPerEvent',
  'Matrix_Channels',
  'MenuCount',
  'OtherCount',
  'Part_Position',
  'Part_Position_Total',
  'Played_Count',
  'Reel_Position',
  'Reel_Position_Total',
  'Resolution',
  'Sampled_Height',
  'Sampled_Width',
  'SamplingCount',
  'Season_Position',
  'Season_Position_Total',
  'Source_FrameCount',
  'Source_SamplingCount',
  'Source_StreamSize_Encoded',
  'Source_StreamSize',
  'Status',
  'Stored_Height',
  'Stored_Width',
  'StreamCount',
  'StreamKindID',
  'StreamKindPos',
  'StreamSize_Demuxed',
  'StreamSize_Encoded',
  'StreamSize',
  'TextCount',
  'Track_Position',
  'Track_Position_Total',
  'Video0_Delay',
  'VideoCount',
  'Width_CleanAperture',
  'Width',
  'Width_Offset',
  'Width_Original',
];
const FLOAT_FIELDS = [
  'Active_DisplayAspectRatio',
  'BitRate_Encoded',
  'BitRate_Maximum',
  'BitRate_Minimum',
  'BitRate',
  'BitRate_Nominal',
  'Bits-Pixel_Frame',
  'BitsPixel_Frame',
  'Compression_Ratio',
  'Delay',
  'Delay_Original',
  'DisplayAspectRatio_CleanAperture',
  'DisplayAspectRatio',
  'DisplayAspectRatio_Original',
  'Duration_End_Command',
  'Duration_End',
  'Duration_FirstFrame',
  'Duration_LastFrame',
  'Duration',
  'Duration_Start2End',
  'Duration_Start_Command',
  'Duration_Start',
  'Events_MinDuration',
  'FrameRate_Maximum',
  'FrameRate_Minimum',
  'FrameRate',
  'FrameRate_Nominal',
  'FrameRate_Original_Den',
  'FrameRate_Original',
  'FrameRate_Original_Num',
  'FrameRate_Real',
  'Interleave_Duration',
  'Interleave_Preload',
  'Interleave_VideoFrames',
  'MasteringDisplay_Luminance_Max',
  'MasteringDisplay_Luminance_Min',
  'MaxCLL',
  'MaxCLL_Original',
  'MaxFALL',
  'MaxFALL_Original',
  'OverallBitRate_Maximum',
  'OverallBitRate_Minimum',
  'OverallBitRate',
  'OverallBitRate_Nominal',
  'PixelAspectRatio_CleanAperture',
  'PixelAspectRatio',
  'PixelAspectRatio_Original',
  'SamplesPerFrame',
  'SamplingRate',
  'Source_Duration_FirstFrame',
  'Source_Duration_LastFrame',
  'Source_Duration',
  'TimeStamp_FirstFrame',
  'Video_Delay',
];

const DEFAULT_OPTIONS = {
  coverData: false,
  chunkSize: 256 * 1024,
  format: 'object',
  full: true,
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

  /** @group General Use */

  /**
   * The constructor should not be called directly, instead use {@link mediaInfoFactory}.
   *
   * @hidden
   * @param mediainfoModule WASM module
   * @param options User options
   */
  constructor(mediainfoModule, options) {
    this.mediainfoModule = mediainfoModule;
    this.options = options;
    this.ptr = this.instantiateModuleInstance();
  }

  /**
   * Convenience method for analyzing a buffer chunk by chunk.
   *
   * @param size Return total buffer size in bytes.
   * @param readChunk Read chunk of data and return an {@link Uint8Array}.
   * @group General Use
   */

  /**
   * Convenience method for analyzing a buffer chunk by chunk.
   *
   * @param size Return total buffer size in bytes.
   * @param readChunk Read chunk of data and return an {@link Uint8Array}.
   * @param callback Function that is called once the processing is done
   * @group General Use
   */

  analyzeData(size, readChunk, callback) {
    // Support promise signature
    if (callback === undefined) {
      return new Promise((resolve, reject) => {
        const resultCb = (result, error) => {
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
        null,
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
    const runReadDataLoop = (fileSize) => {
      const readNextChunk = (data) => {
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
          callback(null, unknownToError(error));
          return;
        }
        if (dataValue instanceof Promise) {
          dataValue.then(readNextChunk).catch((error) => {
            this.isAnalyzing = false;
            callback(null, unknownToError(error));
          });
        } else {
          readNextChunk(dataValue);
        }
      };
      const continueBuffer = (data) => {
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
      runReadDataLoop(fileSizeValue);
    }
  }

  /**
   * Close the MediaInfoLib WASM instance.
   *
   * @group General Use
   */
  close() {
    if (this.ptr) {
      this.mediainfoModule._mi_close(this.ptr);
    }
  }

  /**
   * Reset the MediaInfoLib WASM instance to its initial state.
   *
   * This method ensures that the instance is ready for a new parse.
   * @group General Use
   */
  reset() {
    if (this.ptr) {
      this.mediainfoModule._mi_delete(this.ptr);
    }
    this.ptr = this.instantiateModuleInstance();
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
    const resPtr = this.mediainfoModule._mi_inform(this.ptr);
    return this.mediainfoModule.UTF8ToString(resPtr);
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
  openBufferContinue(data, size) {
    // Copy data to Wasm heap
    const dataPtr = this.mediainfoModule._malloc(size);
    this.mediainfoModule.HEAPU8.set(data, dataPtr);
    const result = this.mediainfoModule._mi_open_buffer_continue(
      this.ptr,
      dataPtr,
      size,
    );
    this.mediainfoModule._free(dataPtr);
    // Bit 3 set (0x08) means processing is complete
    return !!(result & 0x08);
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
    // BigInt return value converted to standard JS number
    const seekTo = this.mediainfoModule._mi_open_buffer_continue_goto_get(
      this.ptr,
    );
    return Number(seekTo);
  }

  /**
   * Inform MediaInfoLib that no more data is being read.
   *
   * (This is a low-level MediaInfoLib function.)
   *
   * @group Low-level
   */
  openBufferFinalize() {
    this.mediainfoModule._mi_open_buffer_finalize(this.ptr);
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
  openBufferInit(size, offset) {
    // Use BigInt for 64-bit compatibility
    this.mediainfoModule._mi_open_buffer_init(
      this.ptr,
      BigInt(size),
      BigInt(offset),
    );
  }

  /**
   * Parse result JSON. Convert integer/float fields.
   *
   * @param result Serialized JSON from MediaInfo
   * @returns Parsed JSON object
   */
  parseResultJson(resultString) {
    const intFields = INT_FIELDS;
    const floatFields = FLOAT_FIELDS;

    // Parse JSON
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
    const format =
      this.options.format === 'object' ? 'JSON' : this.options.format;
    const bytesNeeded = this.mediainfoModule.lengthBytesUTF8(format) + 1;
    const formatPtr = this.mediainfoModule._malloc(bytesNeeded);
    try {
      this.mediainfoModule.stringToUTF8(format, formatPtr, bytesNeeded);
      return this.mediainfoModule._mi_new(
        formatPtr,
        this.options.coverData ? 1 : 0,
        this.options.full ? 1 : 0,
      );
    } finally {
      this.mediainfoModule._free(formatPtr);
    }
  }
}

async function Module(moduleArg = {}) {
  var moduleRtn;
  var Module = moduleArg;
  var thisProgram = './this.program';
  var quit_ = (status, toThrow) => {
    throw toThrow;
  };
  var _scriptName = import.meta.url;
  var scriptDirectory = '';
  function locateFile(path) {
    if (Module['locateFile']) {
      return Module['locateFile'](path, scriptDirectory);
    }
    return scriptDirectory + path;
  }
  var readAsync;
  {
    try {
      scriptDirectory = new URL('.', _scriptName).href;
    } catch {}
    {
      readAsync = async (url) => {
        var response = await fetch(url, { credentials: 'same-origin' });
        if (response.ok) {
          return response.arrayBuffer();
        }
        throw new Error(response.status + ' : ' + response.url);
      };
    }
  }
  var out = console.log.bind(console);
  var err = console.error.bind(console);
  var wasmBinary;
  var ABORT = false;
  var EXITSTATUS;
  var readyPromiseResolve, readyPromiseReject;
  var HEAPU8, HEAP32, HEAPU32;
  var runtimeInitialized = false;
  function updateMemoryViews() {
    var b = wasmMemory.buffer;
    Module['HEAPU8'] = HEAPU8 = new Uint8Array(b);
    HEAP32 = new Int32Array(b);
    HEAPU32 = new Uint32Array(b);
    new BigInt64Array(b);
    new BigUint64Array(b);
  }
  function initRuntime() {
    runtimeInitialized = true;
    wasmExports['n']();
  }
  function abort(what) {
    Module['onAbort']?.(what);
    what = 'Aborted(' + what + ')';
    err(what);
    ABORT = true;
    what += '. Build with -sASSERTIONS for more info.';
    var e = new WebAssembly.RuntimeError(what);
    readyPromiseReject?.(e);
    throw e;
  }
  var wasmBinaryFile;
  function findWasmBinary() {
    if (Module['locateFile']) {
      return locateFile('MediaInfoModule.wasm');
    }
    return new URL('MediaInfoModule.wasm', import.meta.url).href;
  }
  function getBinarySync(file) {
    throw 'both async and sync fetching of the wasm failed';
  }
  async function getWasmBinary(binaryFile) {
    {
      try {
        var response = await readAsync(binaryFile);
        return new Uint8Array(response);
      } catch {}
    }
    return getBinarySync();
  }
  async function instantiateArrayBuffer(binaryFile, imports) {
    try {
      var binary = await getWasmBinary(binaryFile);
      var instance = await WebAssembly.instantiate(binary, imports);
      return instance;
    } catch (reason) {
      err(`failed to asynchronously prepare wasm: ${reason}`);
      abort(reason);
    }
  }
  async function instantiateAsync(binary, binaryFile, imports) {
    // Use pre-compiled module if provided
    if (Module['wasmModule']) {
      try {
        var instance = await WebAssembly.instantiate(
          Module['wasmModule'],
          imports,
        );
        return { instance: instance, module: Module['wasmModule'] };
      } catch (e) {
        err(`wasm instantiation failed: ${e}`);
        abort(e);
      }
    }
    {
      try {
        var response = fetch(binaryFile, { credentials: 'same-origin' });
        var instantiationResult = await WebAssembly.instantiateStreaming(
          response,
          imports,
        );
        return instantiationResult;
      } catch (reason) {
        err(`wasm streaming compile failed: ${reason}`);
        err('falling back to ArrayBuffer instantiation');
      }
    }
    return instantiateArrayBuffer(binaryFile, imports);
  }
  function getWasmImports() {
    var imports = { a: wasmImports };
    return imports;
  }
  async function createWasm() {
    function receiveInstance(instance, module) {
      wasmExports = instance.exports;
      assignWasmExports(wasmExports);
      updateMemoryViews();
      return wasmExports;
    }
    function receiveInstantiationResult(result) {
      return receiveInstance(result['instance']);
    }
    var info = getWasmImports();
    wasmBinaryFile ??= findWasmBinary();
    var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info);
    var exports$1 = receiveInstantiationResult(result);
    return exports$1;
  }
  class ExitStatus {
    name = 'ExitStatus';
    constructor(status) {
      this.message = `Program terminated with exit(${status})`;
      this.status = status;
    }
  }
  var __abort_js = () => abort('');
  var __emscripten_runtime_keepalive_clear = () => {};
  var INT53_MAX = 9007199254740992;
  var INT53_MIN = -9007199254740992;
  var bigintToI53Checked = (num) =>
    num < INT53_MIN || num > INT53_MAX ? NaN : Number(num);
  function __gmtime_js(time, tmPtr) {
    time = bigintToI53Checked(time);
    var date = new Date(time * 1e3);
    HEAP32[tmPtr >> 2] = date.getUTCSeconds();
    HEAP32[(tmPtr + 4) >> 2] = date.getUTCMinutes();
    HEAP32[(tmPtr + 8) >> 2] = date.getUTCHours();
    HEAP32[(tmPtr + 12) >> 2] = date.getUTCDate();
    HEAP32[(tmPtr + 16) >> 2] = date.getUTCMonth();
    HEAP32[(tmPtr + 20) >> 2] = date.getUTCFullYear() - 1900;
    HEAP32[(tmPtr + 24) >> 2] = date.getUTCDay();
    var start = Date.UTC(date.getUTCFullYear(), 0, 1, 0, 0, 0, 0);
    var yday = ((date.getTime() - start) / (1e3 * 60 * 60 * 24)) | 0;
    HEAP32[(tmPtr + 28) >> 2] = yday;
  }
  var timers = {};
  var handleException = (e) => {
    if (e instanceof ExitStatus || e == 'unwind') {
      return EXITSTATUS;
    }
    quit_(1, e);
  };
  var _proc_exit = (code) => {
    EXITSTATUS = code;
    quit_(code, new ExitStatus(code));
  };
  var maybeExit = () => {};
  var callUserCallback = (func) => {
    if (ABORT) {
      return;
    }
    try {
      func();
      maybeExit();
    } catch (e) {
      handleException(e);
    }
  };
  var _emscripten_get_now = () => performance.now();
  var __setitimer_js = (which, timeout_ms) => {
    if (timers[which]) {
      clearTimeout(timers[which].id);
      delete timers[which];
    }
    if (!timeout_ms) return 0;
    var id = setTimeout(() => {
      delete timers[which];
      callUserCallback(() =>
        __emscripten_timeout(which, _emscripten_get_now()),
      );
    }, timeout_ms);
    timers[which] = { id, timeout_ms };
    return 0;
  };
  var stringToUTF8Array = (str, heap, outIdx, maxBytesToWrite) => {
    if (!(maxBytesToWrite > 0)) return 0;
    var startIdx = outIdx;
    var endIdx = outIdx + maxBytesToWrite - 1;
    for (var i = 0; i < str.length; ++i) {
      var u = str.codePointAt(i);
      if (u <= 127) {
        if (outIdx >= endIdx) break;
        heap[outIdx++] = u;
      } else if (u <= 2047) {
        if (outIdx + 1 >= endIdx) break;
        heap[outIdx++] = 192 | (u >> 6);
        heap[outIdx++] = 128 | (u & 63);
      } else if (u <= 65535) {
        if (outIdx + 2 >= endIdx) break;
        heap[outIdx++] = 224 | (u >> 12);
        heap[outIdx++] = 128 | ((u >> 6) & 63);
        heap[outIdx++] = 128 | (u & 63);
      } else {
        if (outIdx + 3 >= endIdx) break;
        heap[outIdx++] = 240 | (u >> 18);
        heap[outIdx++] = 128 | ((u >> 12) & 63);
        heap[outIdx++] = 128 | ((u >> 6) & 63);
        heap[outIdx++] = 128 | (u & 63);
        i++;
      }
    }
    heap[outIdx] = 0;
    return outIdx - startIdx;
  };
  var stringToUTF8 = (str, outPtr, maxBytesToWrite) =>
    stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite);
  var __tzset_js = (timezone, daylight, std_name, dst_name) => {
    var currentYear = new Date().getFullYear();
    var winter = new Date(currentYear, 0, 1);
    var summer = new Date(currentYear, 6, 1);
    var winterOffset = winter.getTimezoneOffset();
    var summerOffset = summer.getTimezoneOffset();
    var stdTimezoneOffset = Math.max(winterOffset, summerOffset);
    HEAPU32[timezone >> 2] = stdTimezoneOffset * 60;
    HEAP32[daylight >> 2] = Number(winterOffset != summerOffset);
    var extractZone = (timezoneOffset) => {
      var sign = timezoneOffset >= 0 ? '-' : '+';
      var absOffset = Math.abs(timezoneOffset);
      var hours = String(Math.floor(absOffset / 60)).padStart(2, '0');
      var minutes = String(absOffset % 60).padStart(2, '0');
      return `UTC${sign}${hours}${minutes}`;
    };
    var winterName = extractZone(winterOffset);
    var summerName = extractZone(summerOffset);
    if (summerOffset < winterOffset) {
      stringToUTF8(winterName, std_name, 17);
      stringToUTF8(summerName, dst_name, 17);
    } else {
      stringToUTF8(winterName, dst_name, 17);
      stringToUTF8(summerName, std_name, 17);
    }
  };
  var _emscripten_date_now = () => Date.now();
  var getHeapMax = () => 2147483648;
  var alignMemory = (size, alignment) =>
    Math.ceil(size / alignment) * alignment;
  var growMemory = (size) => {
    var oldHeapSize = wasmMemory.buffer.byteLength;
    var pages = ((size - oldHeapSize + 65535) / 65536) | 0;
    try {
      wasmMemory.grow(pages);
      updateMemoryViews();
      return 1;
    } catch (e) {}
  };
  var _emscripten_resize_heap = (requestedSize) => {
    var oldSize = HEAPU8.length;
    requestedSize >>>= 0;
    var maxHeapSize = getHeapMax();
    if (requestedSize > maxHeapSize) {
      return false;
    }
    for (var cutDown = 1; cutDown <= 4; cutDown *= 2) {
      var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
      overGrownHeapSize = Math.min(
        overGrownHeapSize,
        requestedSize + 100663296,
      );
      var newSize = Math.min(
        maxHeapSize,
        alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536),
      );
      var replacement = growMemory(newSize);
      if (replacement) {
        return true;
      }
    }
    return false;
  };
  var ENV = {};
  var getExecutableName = () => thisProgram;
  var getEnvStrings = () => {
    if (!getEnvStrings.strings) {
      var lang =
        (globalThis.navigator?.language ?? 'C').replace('-', '_') + '.UTF-8';
      var env = {
        USER: 'web_user',
        LOGNAME: 'web_user',
        PATH: '/',
        PWD: '/',
        HOME: '/home/web_user',
        LANG: lang,
        _: getExecutableName(),
      };
      for (var x in ENV) {
        if (ENV[x] === undefined) delete env[x];
        else env[x] = ENV[x];
      }
      var strings = [];
      for (var x in env) {
        strings.push(`${x}=${env[x]}`);
      }
      getEnvStrings.strings = strings;
    }
    return getEnvStrings.strings;
  };
  var _environ_get = (__environ, environ_buf) => {
    var bufSize = 0;
    var envp = 0;
    for (var string of getEnvStrings()) {
      var ptr = environ_buf + bufSize;
      HEAPU32[(__environ + envp) >> 2] = ptr;
      bufSize += stringToUTF8(string, ptr, Infinity) + 1;
      envp += 4;
    }
    return 0;
  };
  var lengthBytesUTF8 = (str) => {
    var len = 0;
    for (var i = 0; i < str.length; ++i) {
      var c = str.charCodeAt(i);
      if (c <= 127) {
        len++;
      } else if (c <= 2047) {
        len += 2;
      } else if (c >= 55296 && c <= 57343) {
        len += 4;
        ++i;
      } else {
        len += 3;
      }
    }
    return len;
  };
  var _environ_sizes_get = (penviron_count, penviron_buf_size) => {
    var strings = getEnvStrings();
    HEAPU32[penviron_count >> 2] = strings.length;
    var bufSize = 0;
    for (var string of strings) {
      bufSize += lengthBytesUTF8(string) + 1;
    }
    HEAPU32[penviron_buf_size >> 2] = bufSize;
    return 0;
  };
  var _fd_close = (fd) => 52;
  var printCharBuffers = [null, [], []];
  var UTF8Decoder = new TextDecoder();
  var findStringEnd = (heapOrArray, idx, maxBytesToRead, ignoreNul) => {
    var maxIdx = idx + maxBytesToRead;
    if (ignoreNul) return maxIdx;
    while (heapOrArray[idx] && !(idx >= maxIdx)) ++idx;
    return idx;
  };
  var UTF8ArrayToString = (heapOrArray, idx = 0, maxBytesToRead, ignoreNul) => {
    var endPtr = findStringEnd(heapOrArray, idx, maxBytesToRead, ignoreNul);
    return UTF8Decoder.decode(
      heapOrArray.buffer
        ? heapOrArray.subarray(idx, endPtr)
        : new Uint8Array(heapOrArray.slice(idx, endPtr)),
    );
  };
  var printChar = (stream, curr) => {
    var buffer = printCharBuffers[stream];
    if (curr === 0 || curr === 10) {
      (stream === 1 ? out : err)(UTF8ArrayToString(buffer));
      buffer.length = 0;
    } else {
      buffer.push(curr);
    }
  };
  var UTF8ToString = (ptr, maxBytesToRead, ignoreNul) => {
    if (!ptr) return '';
    var end = findStringEnd(HEAPU8, ptr, maxBytesToRead, ignoreNul);
    return UTF8Decoder.decode(HEAPU8.subarray(ptr, end));
  };
  var _fd_write = (fd, iov, iovcnt, pnum) => {
    var num = 0;
    for (var i = 0; i < iovcnt; i++) {
      var ptr = HEAPU32[iov >> 2];
      var len = HEAPU32[(iov + 4) >> 2];
      iov += 8;
      for (var j = 0; j < len; j++) {
        printChar(fd, HEAPU8[ptr + j]);
      }
      num += len;
    }
    HEAPU32[pnum >> 2] = num;
    return 0;
  };
  {
    if (Module['print']) out = Module['print'];
    if (Module['printErr']) err = Module['printErr'];
  }
  Module['UTF8ToString'] = UTF8ToString;
  Module['stringToUTF8'] = stringToUTF8;
  Module['lengthBytesUTF8'] = lengthBytesUTF8;
  var __emscripten_timeout, wasmMemory;
  function assignWasmExports(wasmExports) {
    Module['_mi_new'] = wasmExports['o'];
    Module['_mi_delete'] = wasmExports['p'];
    Module['_mi_open_buffer_init'] = wasmExports['q'];
    Module['_mi_open_buffer_continue'] = wasmExports['r'];
    Module['_mi_open_buffer_continue_goto_get'] = wasmExports['s'];
    Module['_mi_open_buffer_finalize'] = wasmExports['t'];
    Module['_mi_inform'] = wasmExports['u'];
    Module['_mi_close'] = wasmExports['v'];
    Module['_malloc'] = wasmExports['w'];
    Module['_free'] = wasmExports['x'];
    __emscripten_timeout = wasmExports['y'];
    wasmMemory = wasmExports['m'];
    wasmExports['__indirect_function_table'];
  }
  var wasmImports = {
    l: __abort_js,
    i: __emscripten_runtime_keepalive_clear,
    d: __gmtime_js,
    j: __setitimer_js,
    e: __tzset_js,
    k: _emscripten_date_now,
    a: _emscripten_resize_heap,
    b: _environ_get,
    c: _environ_sizes_get,
    f: _fd_close,
    g: _fd_write,
    h: _proc_exit,
  };
  function run() {
    function doRun() {
      Module['calledRun'] = true;
      if (ABORT) return;
      initRuntime();
      readyPromiseResolve?.(Module);
    }
    {
      doRun();
    }
  }
  var wasmExports;
  wasmExports = await createWasm();
  run();
  if (runtimeInitialized) {
    moduleRtn = Module;
  } else {
    moduleRtn = new Promise((resolve, reject) => {
      readyPromiseResolve = resolve;
      readyPromiseReject = reject;
    });
  }
  return moduleRtn;
}

const noopPrint = () => {
  // No-op
};
function defaultLocateFile(path, prefix) {
  try {
    const url = new URL(prefix);
    if (url.pathname === '/') {
      return `${prefix}mediainfo.js/dist/${path}`;
    }
  } catch {
    // empty
  }
  return `${prefix}../${path}`;
}

/**
 * Creates a {@link MediaInfo} instance with the specified options.
 *
 * @typeParam TFormat - The format type, defaults to `object`.
 * @param options - Configuration options for creating the {@link MediaInfo} instance.
 * @returns A promise that resolves to a {@link MediaInfo} instance when no callback is provided.
 */

/**
 * Creates a {@link MediaInfo} instance with the specified options and executes the callback.
 *
 * @typeParam TFormat - The format type, defaults to `object`.
 * @param options - Configuration options for creating the {@link MediaInfo} instance.
 * @param callback - Function to call with the {@link MediaInfo} instance.
 * @param errCallback - Optional function to call on error.
 */

function mediaInfoFactory() {
  let options =
    arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
  let callback = arguments.length > 1 ? arguments[1] : undefined;
  let errCallback = arguments.length > 2 ? arguments[2] : undefined;
  if (callback === undefined) {
    return new Promise((resolve, reject) => {
      mediaInfoFactory(options, resolve, reject);
    });
  }
  const { locateFile, ...mergedOptions } = {
    ...DEFAULT_OPTIONS,
    ...options,
    format: options.format ?? DEFAULT_OPTIONS.format,
  };

  // Options passed to the Emscripten module loader
  const mediaInfoModuleFactoryOpts = {
    // Silence all print in module
    print: noopPrint,
    printErr: noopPrint,
    locateFile: locateFile ?? defaultLocateFile,
    // Pass custom WASM module if provided
    wasmModule: options.wasmModule,
    onAbort: (err) => {
      if (errCallback) {
        errCallback(err);
      }
    },
  };

  // Fetch and load WASM module
  Module(mediaInfoModuleFactoryOpts)
    .then((wasmModule) => {
      callback(new MediaInfo(wasmModule, mergedOptions));
    })
    .catch((error) => {
      if (errCallback) {
        errCallback(error);
      }
    });
}

/**
 * Checks if a given object is of a specified track type.
 *
 * @template T - The type of track to check for.
 * @param thing - The object to check.
 * @param type - The track type to check against.
 * @returns A boolean indicating whether the object is of the specified track type.
 */
function isTrackType(thing, type) {
  return thing !== null && typeof thing === 'object' && thing['@type'] === type;
}

export { mediaInfoFactory as default, isTrackType, mediaInfoFactory };
