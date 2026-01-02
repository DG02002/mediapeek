import MediaInfoFactory from '../lib/mediaInfoFactory';
import {
  getEmulationHeaders,
  resolveGoogleDriveUrl,
  validateUrl,
} from '../lib/server-utils';
// @ts-expect-error - Missing types for WASM import
import mediaInfoWasm from '../wasm/MediaInfoModule.wasm';
import type { Route } from './+types/resource.analyze';

export async function loader({ request }: Route.LoaderArgs) {
  const urlParams = new URL(request.url).searchParams;
  const initialUrl = urlParams.get('url');

  if (!initialUrl) {
    return Response.json(
      { error: 'Please provide a valid URL.' },
      { status: 400 },
    );
  }

  // 1. Resolve & Validate URL
  const { url: targetUrl, isGoogleDrive } = resolveGoogleDriveUrl(initialUrl);
  if (isGoogleDrive) {
    console.log(`[Analyze] Converted Google Drive URL to: ${targetUrl}`);
  }

  try {
    validateUrl(targetUrl);
  } catch (e) {
    if (e instanceof Error) {
      return Response.json({ error: e.message }, { status: 403 });
    }
  }

  try {
    // 2. Fetch Metadata (HEAD)
    const headRes = await fetch(targetUrl, {
      method: 'HEAD',
      headers: getEmulationHeaders(),
      redirect: 'follow',
    });

    console.log(`[Analyze] isGoogleDrive: ${isGoogleDrive}`);
    if (isGoogleDrive) {
      const contentType = headRes.headers.get('content-type');
      if (contentType && contentType.includes('text/html')) {
        throw new Error(
          'Google Drive file is rate-limited. Please try again in 24 hours.',
        );
      }
    }

    if (!headRes.ok) throw new Error(`Failed to HEAD: ${headRes.status}`);

    const fileSize = parseInt(headRes.headers.get('content-length') || '0', 10);
    console.log(`[Analyze] File size: ${fileSize} bytes`);
    if (!fileSize) throw new Error('Could not determine file size');

    // 3. Determine Filename
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

    // 4. Fetch Content Chunk
    const CHUNK_SIZE = 50 * 1024 * 1024; // 50MB
    const fetchEnd = Math.min(CHUNK_SIZE - 1, fileSize - 1);

    console.log(`[Analyze] Pre-fetching bytes 0-${fetchEnd}...`);
    const response = await fetch(targetUrl, {
      headers: getEmulationHeaders(`bytes=0-${fetchEnd}`),
      redirect: 'follow',
    });

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

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

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

    // 5. Run MediaInfo Analysis
    const readChunk = async (size: number, offset: number) => {
      if (offset >= fileBuffer.byteLength) {
        return new Uint8Array(0);
      }
      const end = Math.min(offset + size, fileBuffer.byteLength);
      return fileBuffer.subarray(offset, end);
    };

    const formatsToGenerate = [
      { type: 'JSON', key: 'json' },
      { type: 'text', key: 'text' },
      { type: 'XML', key: 'xml' },
      { type: 'HTML', key: 'html' },
    ];

    const results: Record<string, string> = {};

    await Promise.all(
      formatsToGenerate.map(async ({ type, key }) => {
        try {
          const infoInstance = await MediaInfoFactory({
            format: type,
            coverData: false,
            full: false,
            chunkSize: 5 * 1024 * 1024,
            wasmModule: mediaInfoWasm,
            locateFile: () => 'ignored',
          });

          let resultStr = (await infoInstance.analyzeData(
            () => fileSize,
            readChunk,
          )) as string;
          infoInstance.close();

          // Post-processing
          if (type === 'JSON') {
            try {
              const json = JSON.parse(resultStr);
              if (json && json.media && json.media.track) {
                const generalTrack = json.media.track.find(
                  (t: Record<string, unknown>) => t['@type'] === 'General',
                );
                if (generalTrack) {
                  if (
                    !generalTrack['CompleteName'] &&
                    !generalTrack['Complete_name'] &&
                    !generalTrack['File_Name']
                  ) {
                    generalTrack['CompleteName'] = filename;
                  }
                }
              }
              // Pretty print JSON
              results[key] = JSON.stringify(json, null, 2);
            } catch (e) {
              console.warn('Failed to parse/inject JSON result:', e);
              results[key] = resultStr; // Fallback
            }
          } else if (type === 'text') {
            if (!resultStr.includes('Complete name')) {
              // Injection logic for text
              const lines = resultStr.split('\n');
              const generalIndex = lines.findIndex((l) =>
                l.trim().startsWith('General'),
              );
              if (generalIndex !== -1) {
                let insertIndex = generalIndex + 1;
                for (let i = generalIndex + 1; i < lines.length; i++) {
                  if (lines[i].trim().startsWith('Unique ID')) {
                    insertIndex = i + 1;
                    break;
                  }
                  if (lines[i].trim() === '') break;
                }
                const padding = ' '.repeat(41 - 'Complete name'.length);
                lines.splice(
                  insertIndex,
                  0,
                  `Complete name${padding}: ${filename}`,
                );
                resultStr = lines.join('\n');
              }
            }
            results[key] = resultStr;
          } else {
            results[key] = resultStr;
          }
        } catch (err) {
          console.error(`Failed to generate ${type}:`, err);
          results[key] = `Error generating ${type} view.`;
        }
      }),
    );

    return Response.json({ results });
  } catch (error) {
    console.error('Server-side Analysis Error:', error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'An unexpected error occurred.',
      },
      { status: 500 },
    );
  }
}
