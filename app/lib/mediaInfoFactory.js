/* eslint-disable */
// @ts-nocheck
import MediaInfo, { DEFAULT_OPTIONS } from './MediaInfo';
import mediaInfoModuleFactory from './mediainfo-module-patched.js';
const noopPrint = () => {};
function defaultLocateFile(path, prefix) {
  try {
    const url = new URL(prefix);
    if (url.pathname === '/') {
      return `${prefix}mediainfo.js/dist/${path}`;
    }
  } catch {}
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

function mediaInfoFactory(
  options = {},
  callback = undefined,
  errCallback = undefined,
) {
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
  const mediaInfoModuleFactoryOpts = {
    print: noopPrint,
    printErr: noopPrint,
    locateFile: locateFile ?? defaultLocateFile,
    wasmModule: options.wasmModule,
    onAbort: (err) => {
      if (errCallback) {
        errCallback(err);
      }
    },
  };

  mediaInfoModuleFactory(mediaInfoModuleFactoryOpts)
    .then((wasmModule) => {
      callback(new MediaInfo(wasmModule, mergedOptions));
    })
    .catch((error) => {
      if (errCallback) {
        errCallback(error);
      }
    });
}
export default mediaInfoFactory;
