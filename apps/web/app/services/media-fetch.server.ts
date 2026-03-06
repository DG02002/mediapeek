import {
  inspectArchiveEntry,
  type ArchiveEntryInspection,
} from '@mediapeek/shared/archive-inspection';
import {
  type FilenameSource,
  parseContentDispositionFilename,
} from '@mediapeek/shared/filename-resolution';

import { DiagnosticsError } from '~/lib/error-utils';
import {
  extractFilenameFromUrl,
  getEmulationHeaders,
  isArchiveExtension,
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
const SAFE_LIMIT = 10 * 1024 * 1024;
const ZIP_TAIL_INSPECTION_BYTES = 128 * 1024;

export interface MediaFetchResult {
  buffer: Uint8Array;
  filename: string;
  filenameSource: FilenameSource;
  fileSize?: number;
  diagnostics: FetchDiagnostics;
  hash?: string;
  innerFilename?: string;
  archiveEntry?: ArchiveEntryInspection;
}

const resolveResponseFileSize = (response: Response): number | undefined => {
  const contentRange = response.headers.get('content-range');
  if (contentRange) {
    const match = /\/(\d+)$/.exec(contentRange);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  if (response.status === 206) {
    return undefined;
  }

  const contentLength = response.headers.get('content-length');
  if (!contentLength) {
    return undefined;
  }

  return parseInt(contentLength, 10);
};

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
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) =>
    (timeoutId = setTimeout(() => {
      reject(new Error('Fetch stream read timed out'));
    }, timeoutMs)),
  );

  try {
    const { done, value } = await Promise.race([
      sourceReader.read(),
      timeoutPromise,
    ]);
    return done ? null : value;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
};

const readStreamIntoBuffer = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  firstChunk: Uint8Array | null,
  limit: number,
): Promise<Uint8Array> => {
  const tempBuffer = new Uint8Array(limit);
  let offset = 0;

  if (firstChunk) {
    const initialSize = Math.min(firstChunk.byteLength, limit);
    tempBuffer.set(firstChunk.subarray(0, initialSize), offset);
    offset += initialSize;
    if (offset >= limit) {
      await reader.cancel();
      return tempBuffer.subarray(0, offset);
    }
  }

  while (offset < limit) {
    const { done, value } = await reader.read();
    if (done) break;

    const bytesToCopy = Math.min(value.byteLength, limit - offset);
    tempBuffer.set(value.subarray(0, bytesToCopy), offset);
    offset += bytesToCopy;

    if (bytesToCopy < value.byteLength) {
      await reader.cancel();
      break;
    }
  }

  return tempBuffer.subarray(0, offset);
};

const readCompressedPrefix = async (
  compressedData: Uint8Array,
  limit: number,
): Promise<Uint8Array> => {
  const inputStream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(compressedData);
      controller.close();
    },
  });
  const decompressor =
    new DecompressionStream('deflate-raw') as unknown as ReadableWritablePair<
      Uint8Array,
      Uint8Array
    >;
  const reader = inputStream.pipeThrough(decompressor).getReader();

  const tempBuffer = new Uint8Array(limit);
  let offset = 0;

  try {
    while (offset < limit) {
      const { done, value } = await reader.read();
      if (done) break;

      const bytesToCopy = Math.min(value.byteLength, limit - offset);
      tempBuffer.set(value.subarray(0, bytesToCopy), offset);
      offset += bytesToCopy;

      if (bytesToCopy < value.byteLength) {
        await reader.cancel();
        break;
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      offset === 0 ||
      (!message.includes('incomplete data') &&
        !message.includes('unexpected end of file'))
    ) {
      throw error;
    }
  }

  return tempBuffer.subarray(0, offset);
};

const extractArchivePrefix = async (
  rawBuffer: Uint8Array,
  archiveEntry: ArchiveEntryInspection,
): Promise<Uint8Array | null> => {
  if (
    archiveEntry.dataOffset === undefined ||
    archiveEntry.dataOffset >= rawBuffer.byteLength
  ) {
    return null;
  }

  if (
    archiveEntry.archiveKind === 'tar' ||
    archiveEntry.compression === 'stored'
  ) {
    const availableEnd =
      archiveEntry.compressedSize !== undefined
        ? Math.min(
            rawBuffer.byteLength,
            archiveEntry.dataOffset + archiveEntry.compressedSize,
          )
        : rawBuffer.byteLength;

    return rawBuffer.subarray(archiveEntry.dataOffset, availableEnd);
  }

  if (archiveEntry.compression === 'deflate') {
    const compressedEnd =
      archiveEntry.compressedSize !== undefined
        ? Math.min(
            rawBuffer.byteLength,
            archiveEntry.dataOffset + archiveEntry.compressedSize,
          )
        : rawBuffer.byteLength;

    const compressedPrefix = rawBuffer.subarray(
      archiveEntry.dataOffset,
      compressedEnd,
    );
    if (compressedPrefix.byteLength === 0) {
      return null;
    }

    return readCompressedPrefix(compressedPrefix, SAFE_LIMIT);
  }

  return null;
};

const fetchZipTailBuffer = async (
  url: string,
  totalSize: number,
): Promise<Uint8Array | null> => {
  if (!Number.isFinite(totalSize) || totalSize <= 0) {
    return null;
  }

  const start = Math.max(0, totalSize - ZIP_TAIL_INSPECTION_BYTES);
  const response = await fetch(url, {
    headers: getEmulationHeaders(`bytes=${String(start)}-${String(totalSize - 1)}`),
    redirect: 'follow',
  });
  if (response.status !== 200 && response.status !== 206) {
    return null;
  }

  return new Uint8Array(await response.arrayBuffer());
};

export async function fetchMediaChunk(
  initialUrl: string,
  chunkSize: number = SAFE_LIMIT,
): Promise<MediaFetchResult> {
  const tStart = performance.now();
  const diagnostics: Partial<FetchDiagnostics> = {};

  const { url: targetUrl, isGoogleDrive } = resolveGoogleDriveUrl(initialUrl);
  diagnostics.isGoogleDrive = isGoogleDrive;

  validateUrl(targetUrl);

  const tHead = performance.now();
  let probeMethod = 'HEAD';
  let headRes = await fetch(targetUrl, {
    method: 'HEAD',
    headers: getEmulationHeaders(),
    redirect: 'follow',
  });

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

  const contentType = headRes.headers.get('content-type');
  if (contentType?.includes('text/html')) {
    if (isGoogleDrive) {
      throw new Error('Google Drive file is rate-limited. Try again in 24 hours.');
    }

    throw new Error(
      'URL links to a webpage, not a media file. Provide a direct link.',
    );
  }

  if (!headRes.ok) {
    if (headRes.status === 404) {
      throw new Error('Media file not found. Check the URL.');
    }
    if (headRes.status === 403) {
      throw new Error(
        'Access denied. The link may have expired or requires authentication.',
      );
    }
    throw new Error(`Unable to access file (HTTP ${String(headRes.status)}).`);
  }

  let fileSize = resolveResponseFileSize(headRes);

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
    if (!attemptReader) {
      throw new Error('Failed to retrieve response body stream');
    }

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
      if (!isReadTimeout) {
        throw err;
      }

      void attemptReader.cancel();
      firstByteTimeoutRetries += 1;
      rangeReadTimedOut = true;
      response = null;
      reader = null;
      firstChunk = null;
    }
  }

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

  if (!fileSize) {
    fileSize = resolveResponseFileSize(response);
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

  let rawBuffer: Uint8Array;
  try {
    rawBuffer = await readStreamIntoBuffer(reader, firstChunk, SAFE_LIMIT);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    diagnostics.streamCloseError = errorMessage;
    diagnostics.totalDurationMs = Math.round(performance.now() - tStart);
    throw new DiagnosticsError(
      `Stream reading failed: ${errorMessage}`,
      diagnostics,
      err,
    );
  }

  let archiveEntry: ArchiveEntryInspection | undefined;
  const shouldCheckArchive =
    rawBuffer.byteLength > 0 &&
    (!filename || isArchiveExtension(filename) || isGoogleDrive);

  if (shouldCheckArchive) {
    const initialArchiveEntry = inspectArchiveEntry(rawBuffer);
    if (initialArchiveEntry) {
      archiveEntry = initialArchiveEntry;
      if (
        archiveEntry.archiveKind === 'zip' &&
        archiveEntry.sizeStatus === 'estimated' &&
        fileSize !== undefined
      ) {
        const tailBuffer = await fetchZipTailBuffer(targetUrl, fileSize);
        const tailResolvedEntry = tailBuffer
          ? inspectArchiveEntry(rawBuffer, { tailBuffer })
          : null;
        if (tailResolvedEntry) {
          archiveEntry = tailResolvedEntry;
        }
      }
    }
  }

  let analysisBuffer = rawBuffer;
  if (archiveEntry) {
    diagnostics.resolvedFilename = archiveEntry.name;
    diagnostics.resolvedFilenameSource = 'archive-inner';

    const extractedPrefix = await extractArchivePrefix(rawBuffer, archiveEntry);
    if (extractedPrefix && extractedPrefix.byteLength > 0) {
      analysisBuffer = extractedPrefix;
    }

    if (
      archiveEntry.sizeStatus === 'verified' &&
      archiveEntry.uncompressedSize !== undefined
    ) {
      fileSize = archiveEntry.uncompressedSize;
    }
  }

  diagnostics.totalDurationMs = Math.round(performance.now() - tStart);

  const result: MediaFetchResult = {
    buffer: analysisBuffer,
    filename,
    filenameSource,
    fileSize,
    diagnostics: diagnostics as FetchDiagnostics,
    innerFilename:
      diagnostics.resolvedFilename === filename
        ? undefined
        : diagnostics.resolvedFilename,
    archiveEntry,
  };

  mediaPeekEmitter.emit('fetch:complete', {
    diagnostics: result.diagnostics,
    fileSize: result.fileSize,
    filename: result.filename,
    hash: result.hash,
  });

  return result;
}
