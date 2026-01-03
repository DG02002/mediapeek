import {
  getEmulationHeaders,
  resolveGoogleDriveUrl,
  validateUrl,
} from '~/lib/server-utils';

export interface MediaFetchResult {
  buffer: Uint8Array;
  filename: string;
  fileSize: number;
}

export async function fetchMediaChunk(
  initialUrl: string,
  chunkSize: number = 50 * 1024 * 1024,
): Promise<MediaFetchResult> {
  const { url: targetUrl, isGoogleDrive } = resolveGoogleDriveUrl(initialUrl);

  if (isGoogleDrive) {
    console.log(`[Analyze] Converted Google Drive URL to: ${targetUrl}`);
  }

  validateUrl(targetUrl);

  // 1. HEAD Request
  const headRes = await fetch(targetUrl, {
    method: 'HEAD',
    headers: getEmulationHeaders(),
    redirect: 'follow',
  });

  console.log(`[Analyze] isGoogleDrive: ${isGoogleDrive}`);

  // Check for HTML content (indicates a webpage, not a direct file link)
  const contentType = headRes.headers.get('content-type');
  if (contentType?.includes('text/html')) {
    // If it's Google Drive, it might be the rate-limit page
    if (isGoogleDrive) {
      throw new Error(
        'Google Drive file is rate-limited. Please try again in 24 hours.',
      );
    }
    // Generic HTML response
    throw new Error(
      'The URL links to a webpage, not a media file. Please provide a direct link.',
    );
  }

  if (!headRes.ok) {
    if (headRes.status === 404) {
      throw new Error(
        'The media file could not be found. Check the URL for errors.',
      );
    } else if (headRes.status === 403) {
      throw new Error(
        'Access to this file is denied. The link may have expired or requires authentication.',
      );
    } else {
      throw new Error(`Unable to access file (HTTP ${headRes.status}).`);
    }
  }

  const fileSize = parseInt(headRes.headers.get('content-length') || '0', 10);
  console.log(`[Analyze] File size: ${fileSize} bytes`);
  if (!fileSize) throw new Error('Could not determine file size');

  // 2. Determine Filename
  let filename = targetUrl;
  const contentDisposition = headRes.headers.get('content-disposition');
  if (contentDisposition) {
    const starMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (starMatch && starMatch[1]) {
      try {
        filename = decodeURIComponent(starMatch[1]);
      } catch (e) {
        console.warn('Failed to decode filename*:', e);
      }
    } else {
      const normalMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
      if (normalMatch && normalMatch[1]) {
        filename = normalMatch[1];
      }
    }
  }
  console.log(`[Analyze] Resolved filename: ${filename}`);

  // 3. Fetch Content Chunk
  const fetchEnd = Math.min(chunkSize - 1, fileSize - 1);

  console.log(`[Analyze] Pre-fetching bytes 0-${fetchEnd}...`);
  const t0 = performance.now();
  const response = await fetch(targetUrl, {
    headers: getEmulationHeaders(`bytes=0-${fetchEnd}`),
    redirect: 'follow',
  });
  console.log(
    `[Analyze] Fetch response received in ${Math.round(performance.now() - t0)}ms. Status: ${response.status}`,
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch initial chunk: ${response.status} ${response.statusText}`,
    );
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('Failed to retrieve response body stream');

  const chunks: Uint8Array[] = [];
  let receivedLength = 0;
  const maxBytes = fetchEnd + 1;
  let chunkCount = 0;

  try {
    console.log('[Analyze] Starting stream reading loop...');
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log(
          `[Analyze] Stream reading finished. Total chunks: ${chunkCount}`,
        );
        break;
      }

      chunkCount++;
      chunks.push(value);
      receivedLength += value.length;

      // Log every 50 chunks or first/last chunks to debug progress
      if (chunkCount % 50 === 0 || receivedLength >= maxBytes) {
        console.log(
          `[Analyze] Read chunk ${chunkCount}, Total: ${receivedLength} bytes`,
        );
      }

      if (receivedLength >= maxBytes) {
        console.log(
          `[Analyze] Reached chunk limit (${receivedLength}/${maxBytes}). Cancelling stream.`,
        );
        await reader.cancel();
        break;
      }
    }
  } catch (err) {
    console.warn('[Analyze] Stream reading interrupted or failed:', err);
  }

  const fileBuffer = new Uint8Array(receivedLength);
  let position = 0;
  for (const chunk of chunks) {
    fileBuffer.set(chunk, position);
    position += chunk.length;
  }

  console.log(`[Analyze] Loaded ${fileBuffer.byteLength} bytes into memory.`);

  return {
    buffer: fileBuffer,
    filename,
    fileSize,
  };
}
