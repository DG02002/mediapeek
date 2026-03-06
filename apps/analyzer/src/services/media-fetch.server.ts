import { Buffer } from 'node:buffer';

import {
  type FilenameSource,
  parseContentDispositionFilename,
} from '@mediapeek/shared/filename-resolution';

import { DiagnosticsError } from '../lib/error-utils';
import {
  extractFilenameFromUrl,
  getEmulationHeaders,
  isArchiveExtension,
  resolveGoogleDriveUrl,
  validateUrl,
} from '../lib/server-utils';
import { mediaPeekEmitter } from './event-bus.server';

export interface FetchDiagnostics {
  headRequestDurationMs: number;
  fetchRequestDurationMs: number;
  totalDurationMs: number;
  isGoogleDrive: boolean;
  resolvedFilename: string;
  resolvedFilenameSource: FilenameSource;
  responseStatus: number;
  probeMethod: string;
  firstByteReadTimeoutMs?: number;
  firstByteReadRetries?: number;
  firstByteReadStrategy?: 'range' | 'no_range_fallback';
  streamCloseError?: string;
}

const FIRST_BYTE_READ_TIMEOUT_MS = 15_000;
const MAX_FIRST_BYTE_READ_RETRIES = 1;
const NO_RANGE_FALLBACK_TIMEOUT_MS = 25_000;

export interface MediaFetchResult {
  buffer: Uint8Array;
  filename: string;
  filenameSource: FilenameSource;
  fileSize?: number;
  diagnostics: FetchDiagnostics;
  hash?: string;
  innerFilename?: string; // Captured from container header if unzipped on-the-fly
}

export async function fetchMediaChunk(
  initialUrl: string,
  chunkSize: number = 10 * 1024 * 1024,
): Promise<MediaFetchResult> {
  const tStart = performance.now();
  const diagnostics: Partial<FetchDiagnostics> = {};

  const { url: targetUrl, isGoogleDrive } = resolveGoogleDriveUrl(initialUrl);
  diagnostics.isGoogleDrive = isGoogleDrive;

  validateUrl(targetUrl);

  const assertByteFetchStatus = (res: Response) => {
    if (res.status === 200 || res.status === 206) return;
    if (res.status === 404) {
      throw new Error('Media file not found. Check the URL.');
    }
    if (res.status === 403) {
      throw new Error(
        'Access denied while fetching media bytes. The link may have expired or blocked server-side fetches.',
      );
    }
    throw new Error(`Unable to retrieve media bytes (HTTP ${String(res.status)}).`);
  };

  const readFirstChunkWithTimeout = async (
    sourceReader: ReadableStreamDefaultReader<Uint8Array>,
    timeoutMs: number,
  ) => {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => {
        reject(new Error('Fetch stream read timed out'));
      }, timeoutMs),
    );

    const { done, value } = await Promise.race([
      sourceReader.read(),
      timeoutPromise,
    ]);
    return done ? null : value;
  };

  // 1. Initial Request (HEAD with fallback to GET)
  const tHead = performance.now();
  let probeMethod = 'HEAD';
  let headRes = await fetch(targetUrl, {
    method: 'HEAD',
    headers: getEmulationHeaders(),
    redirect: 'follow',
  });

  // If HEAD is not allowed (405), fallback to a GET request for the first byte
  if (headRes.status === 405) {
    probeMethod = 'GET';
    headRes = await fetch(targetUrl, {
      method: 'GET',
      headers: getEmulationHeaders('bytes=0-0'),
      redirect: 'follow',
    });
  }

  diagnostics.headRequestDurationMs = Math.round(performance.now() - tHead);
  diagnostics.probeMethod = probeMethod;

  // Check for HTML content (indicates a webpage, not a direct file link)
  const contentType = headRes.headers.get('content-type');
  if (contentType?.includes('text/html')) {
    // If it's Google Drive, it might be the rate-limit page
    if (isGoogleDrive) {
      throw new Error(
        'Google Drive file is rate-limited. Try again in 24 hours.',
      );
    }

    // If we have a 405, it might be theserver returned an HTML error page for HEAD,
    // but code above should have handled the fallback. If we are here, even the fallback/original returned HTML.
    throw new Error(
      'URL links to a webpage, not a media file. Provide a direct link.',
    );
  }

  if (!headRes.ok) {
    if (headRes.status === 404) {
      throw new Error('Media file not found. Check the URL.');
    } else if (headRes.status === 403) {
      throw new Error(
        'Access denied. The link may have expired or requires authentication.',
      );
    } else {
      throw new Error(
        `Unable to access file (HTTP ${String(headRes.status)}).`,
      );
    }
  }

  // Determine file size (support Content-Range for partial content responses)
  let fileSize: number | undefined;
  const contentRange = headRes.headers.get('content-range');
  if (contentRange) {
    const match = /\/(\d+)$/.exec(contentRange);
    if (match) {
      fileSize = parseInt(match[1], 10);
    }
  }

  // Fallback to Content-Length if no Content-Range
  if (!fileSize) {
    const cl = headRes.headers.get('content-length');
    if (cl) {
      fileSize = parseInt(cl, 10);
    }
  }

  // We no longer throw if fileSize is unknown. We proceed with best effort.

  // 2. Determine Filename
  let filename = extractFilenameFromUrl(targetUrl);
  let filenameSource: FilenameSource = 'url';
  const headFilename = parseContentDispositionFilename(
    headRes.headers.get('content-disposition'),
  );
  if (headFilename) {
    filename = headFilename;
    filenameSource = 'content-disposition-head';
  }
  diagnostics.resolvedFilename = filename;
  diagnostics.resolvedFilenameSource = filenameSource;

  // 3. Fetch Content Chunk
  // If fileSize is known, use it to clamp range. If not, just request up to chunkSize.
  const fetchEnd =
    fileSize !== undefined
      ? Math.min(chunkSize - 1, fileSize - 1)
      : chunkSize - 1;

  const tFetch = performance.now();
  let response: Response | null = null;
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let firstChunk: Uint8Array | null = null;
  let firstByteTimeoutRetries = 0;
  let firstByteReadStrategy: FetchDiagnostics['firstByteReadStrategy'] = 'range';
  let rangeReadTimedOut = false;

  for (let attempt = 0; attempt <= MAX_FIRST_BYTE_READ_RETRIES; attempt += 1) {
    const attemptResponse = await fetch(targetUrl, {
      headers: getEmulationHeaders(`bytes=0-${String(fetchEnd)}`),
      redirect: 'follow',
    });
    assertByteFetchStatus(attemptResponse);
    diagnostics.responseStatus = attemptResponse.status;

    const attemptReader = attemptResponse.body?.getReader();
    if (!attemptReader) throw new Error('Failed to retrieve response body stream');

    try {
      response = attemptResponse;
      reader = attemptReader;
      firstChunk = await readFirstChunkWithTimeout(
        attemptReader,
        FIRST_BYTE_READ_TIMEOUT_MS,
      );
      rangeReadTimedOut = false;
      break;
    } catch (err) {
      const isReadTimeout =
        err instanceof Error && err.message === 'Fetch stream read timed out';
      if (isReadTimeout) {
        void attemptReader.cancel();
        firstByteTimeoutRetries += 1;
        rangeReadTimedOut = true;
        response = null;
        reader = null;
        firstChunk = null;
        continue;
      }
      throw err;
    }
  }

  // Some origins stall on Range reads from datacenter egress.
  // Fallback once to a plain GET (no Range) before failing.
  if (!response || !reader) {
    const fallbackResponse = await fetch(targetUrl, {
      headers: getEmulationHeaders(),
      redirect: 'follow',
    });
    assertByteFetchStatus(fallbackResponse);
    diagnostics.responseStatus = fallbackResponse.status;

    const fallbackReader = fallbackResponse.body?.getReader();
    if (!fallbackReader) {
      throw new Error('Failed to retrieve response body stream');
    }

    try {
      response = fallbackResponse;
      reader = fallbackReader;
      firstChunk = await readFirstChunkWithTimeout(
        fallbackReader,
        NO_RANGE_FALLBACK_TIMEOUT_MS,
      );
      firstByteReadStrategy = 'no_range_fallback';
    } catch (err) {
      const isReadTimeout =
        err instanceof Error && err.message === 'Fetch stream read timed out';
      if (isReadTimeout) {
        void fallbackReader.cancel();
        throw new Error(
          rangeReadTimedOut
            ? `Fetch stream read timed out after ${String(firstByteTimeoutRetries)} range attempt(s) and no-range fallback`
            : 'Fetch stream read timed out during no-range fallback',
          { cause: err },
        );
      }
      throw err;
    }
  }

  diagnostics.fetchRequestDurationMs = Math.round(performance.now() - tFetch);
  diagnostics.firstByteReadTimeoutMs = FIRST_BYTE_READ_TIMEOUT_MS;
  diagnostics.firstByteReadRetries = firstByteTimeoutRetries;
  diagnostics.firstByteReadStrategy = firstByteReadStrategy;

  if (!response || !reader) {
    throw new Error('Failed to retrieve response body stream');
  }

  if (filenameSource === 'url') {
    const getFilename = parseContentDispositionFilename(
      response.headers.get('content-disposition'),
    );
    if (getFilename) {
      filename = getFilename;
      filenameSource = 'content-disposition-get';
      diagnostics.resolvedFilename = filename;
      diagnostics.resolvedFilenameSource = filenameSource;
    }
  }

  const SAFE_LIMIT = 10 * 1024 * 1024; // 10MB "Eco Mode" limit
  const tempBuffer = new Uint8Array(SAFE_LIMIT); // Pre-allocate: Zero GC overhead
  let offset = 0;

  // Check for Zip Header to transparently decompress Deflate streams
  // OPTIMIZATION: Only check for zip header if the filename looks like an archive (or if we have no filename).
  // This prevents checking every video file for zip magic if we already know it's .mp4.
  // We allow null filename to proceed to check (safety net).
  let finalReader = reader;
  let isZipCompressed = false;

  // Verify Zip Signature using Buffer - Only if potentially an archive
  const shouldCheckArchive =
    !filename || isArchiveExtension(filename) || isGoogleDrive;

  if (shouldCheckArchive && firstChunk && firstChunk.byteLength > 30) {
    const buffer = Buffer.from(firstChunk); // View as Buffer for easier parsing
    // Check for ZIP Local File Header Signature: 0x04034b50 (LE)
    if (buffer.readUInt32LE(0) === 0x04034b50) {
      // Check compression method at offset 8 (2 bytes)
      const compressionMethod = buffer.readUInt16LE(8);

      // Method 8 is DEFLATE. Method 0 is STORED.
      if (compressionMethod === 8) {
        // Zip Deflate detected: Create a DecompressionStream to unzip on-the-fly.
        isZipCompressed = true;

        // Parse local file header to find where the compressed data starts
        const fileNameLength = buffer.readUInt16LE(26);
        const extraFieldLength = buffer.readUInt16LE(28);
        const dataOffset = 30 + fileNameLength + extraFieldLength;

        // Capture the filename from the header before stripping it
        if (firstChunk.length > 30 + fileNameLength) {
          const nameBytes = firstChunk.subarray(30, 30 + fileNameLength);
          const innerName = new TextDecoder().decode(nameBytes);
          // If we are unzipping effectively a "single file", this name is the real name.
          if (innerName && !innerName.endsWith('/')) {
            diagnostics.resolvedFilename = innerName; // Upstream prefers this name
            diagnostics.resolvedFilenameSource = 'archive-inner';
          }
        }

        // Ensure we have enough data in the first chunk to strip the header
        if (firstChunk.length > dataOffset) {
          const dataInFirstChunk = firstChunk.subarray(dataOffset);

          // 1. Create a stream that emits the rest of the first chunk (minus header) + the original stream
          const rawCompressedStream = new ReadableStream({
            start(controller) {
              if (dataInFirstChunk.byteLength > 0) {
                controller.enqueue(dataInFirstChunk);
              }
            },
            async pull(controller) {
              const { done, value } = await reader.read();
              if (done) {
                controller.close();
              } else {
                controller.enqueue(value);
              }
            },
            cancel() {
              void reader.cancel();
            },
          });

          // 2. Pipe through DecompressionStream to get raw media data
          const decompressor = new DecompressionStream('deflate-raw');
          finalReader = rawCompressedStream
            .pipeThrough(decompressor)
            .getReader();

          // firstChunk is now consumed by the new stream pipeline
          firstChunk = null;
        }
      }
    }
  }

  try {
    // If strict zip decompression was not applied (not zip, or stored zip, or error),
    // process the pending firstChunk manually.
    if (firstChunk) {
      const spaceLeft = SAFE_LIMIT - offset;
      if (firstChunk.byteLength > spaceLeft) {
        tempBuffer.set(firstChunk.subarray(0, spaceLeft), offset);
        offset += spaceLeft;

        // If buffer full from just the first chunk, close the original reader.
        // We only cancel the original reader if we didn't upgrade to a decompression pipeline,
        // because the decompression pipeline manages the original reader's lifecycle.
        if (!isZipCompressed) void reader.cancel();
      } else {
        tempBuffer.set(firstChunk, offset);
        offset += firstChunk.byteLength;
      }
    }

    // Now read the rest
    while (offset < SAFE_LIMIT) {
      const { done, value } = await finalReader.read();
      if (done) break;

      const spaceLeft = SAFE_LIMIT - offset;

      if (value.byteLength > spaceLeft) {
        tempBuffer.set(value.subarray(0, spaceLeft), offset);
        offset += spaceLeft;
        await finalReader.cancel();
        break;
      } else {
        tempBuffer.set(value, offset);
        offset += value.byteLength;
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    diagnostics.streamCloseError = errorMessage;
    // IMPORTANT: Capture total duration even on error
    diagnostics.totalDurationMs = Math.round(performance.now() - tStart);

    // DecompressionStream throws if the stream ends while expecting more data (valid for partial fetches)
    if (
      offset > 0 &&
      (errorMessage.includes('incomplete data') ||
        errorMessage.includes('unexpected end of file'))
    ) {
      // We got some data before the stream ended/failed, which is expected for partial zip chunks.
      // Sallow the error and return what we have.
    } else {
      // Stream failed really, propagate error with diagnostics attached
      throw new DiagnosticsError(
        `Stream reading failed: ${errorMessage}`,
        diagnostics,
        err,
      );
    }
  }

  // Create a view of the actual data we read (no copy)
  const fileBuffer = tempBuffer.subarray(0, offset);

  diagnostics.totalDurationMs = Math.round(performance.now() - tStart);

  const result: MediaFetchResult = {
    buffer: fileBuffer,
    filename,
    filenameSource,
    fileSize,
    diagnostics: diagnostics as FetchDiagnostics,
    innerFilename:
      diagnostics.resolvedFilename === filename
        ? undefined
        : diagnostics.resolvedFilename,
  };

  // Emit Telemetry
  mediaPeekEmitter.emit('fetch:complete', {
    diagnostics: result.diagnostics,
    fileSize: result.fileSize,
    filename: result.filename,
    hash: result.hash,
  });

  return result;
}
