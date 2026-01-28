import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

import {
  extractFilenameFromUrl,
  getEmulationHeaders,
  resolveGoogleDriveUrl,
  validateUrl,
} from '~/lib/server-utils';
import { mediaPeekEmitter } from '~/services/event-bus.server';

export interface FetchDiagnostics {
  headRequestDurationMs: number;
  fetchRequestDurationMs: number;
  totalDurationMs: number;
  isGoogleDrive: boolean;
  resolvedFilename: string;
  responseStatus: number;
  probeMethod: string;
  streamCloseError?: string;
}

export interface MediaFetchResult {
  buffer: Uint8Array;
  filename: string;
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
  const contentDisposition = headRes.headers.get('content-disposition');
  if (contentDisposition) {
    const starMatch = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
    if (starMatch?.[1]) {
      try {
        filename = decodeURIComponent(starMatch[1]);
      } catch {
        // failed to decode, keep original
      }
    } else {
      const normalMatch = /filename="?([^";]+)"?/i.exec(contentDisposition);
      if (normalMatch?.[1]) {
        filename = normalMatch[1];
      }
    }
  }
  diagnostics.resolvedFilename = filename;

  // 3. Fetch Content Chunk
  // If fileSize is known, use it to clamp range. If not, just request up to chunkSize.
  const fetchEnd =
    fileSize !== undefined
      ? Math.min(chunkSize - 1, fileSize - 1)
      : chunkSize - 1;

  const tFetch = performance.now();
  const response = await fetch(targetUrl, {
    headers: getEmulationHeaders(`bytes=0-${String(fetchEnd)}`),
    redirect: 'follow',
  });
  diagnostics.fetchRequestDurationMs = Math.round(performance.now() - tFetch);
  diagnostics.responseStatus = response.status;

  const SAFE_LIMIT = 10 * 1024 * 1024; // 10MB "Eco Mode" limit
  const tempBuffer = new Uint8Array(SAFE_LIMIT); // Pre-allocate: Zero GC overhead
  let offset = 0;

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Failed to retrieve response body stream');

  // Check for Zip Header to transparently decompress Deflate streams
  // We need to read the first chunk primarily to check for the Zip signature.
  let firstChunk: Uint8Array | null = null;
  {
    const { done, value } = await reader.read();
    if (!done) {
      firstChunk = value;
    }
  }

  let finalReader = reader;
  let isZipCompressed = false;

  // Verify Zip Signature using Buffer
  if (firstChunk && firstChunk.byteLength > 30) {
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

    // DecompressionStream throws if the stream ends while expecting more data (valid for partial fetches)
    if (
      offset > 0 &&
      (errorMessage.includes('incomplete data') ||
        errorMessage.includes('unexpected end of file'))
    ) {
      // We got some data before the stream ended/failed, which is expected for partial zip chunks.
      // Sallow the error and return what we have.
    } else {
      // Stream failed really, propagate error to be caught by main handler
      throw new Error(`Stream reading failed: ${errorMessage}`);
    }
  }

  // Create a view of the actual data we read (no copy)
  const fileBuffer = tempBuffer.subarray(0, offset);

  // Compute SHA-256 Integrity Hash
  const hash = createHash('sha256').update(fileBuffer).digest('hex');

  diagnostics.totalDurationMs = Math.round(performance.now() - tStart);

  const result: MediaFetchResult = {
    buffer: fileBuffer,
    filename,
    fileSize,
    diagnostics: diagnostics as FetchDiagnostics,
    hash,
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
