import { normalizeMediaInfo } from '~/lib/media-utils';
import {
  createMediaInfo,
  type MediaInfo,
} from '~/services/mediainfo-factory.server';

export interface MediaInfoResult {
  [key: string]: string;
}

export interface MediaInfoDiagnostics {
  wasmLoadTimeMs: number;
  factoryCreateTimeMs: number;
  formatGenerationTimes: Record<string, number>;
  totalAnalysisTimeMs: number;
  wasmLoadError?: string;
  objectProcessError?: string;
  formatErrors: Record<string, string>;
}

export interface MediaInfoAnalysis {
  results: Record<string, string>;
  diagnostics: MediaInfoDiagnostics;
}

export type MediaInfoFormat = 'object' | 'Text' | 'XML' | 'HTML';

export async function analyzeMediaBuffer(
  fileBuffer: Uint8Array,
  fileSize: number | undefined,
  filename: string,
  requestedFormats: string[] = [],
): Promise<MediaInfoAnalysis> {
  const tStart = performance.now();

  const effectiveFileSize = fileSize ?? fileBuffer.byteLength;

  const diagnostics: MediaInfoDiagnostics = {
    wasmLoadTimeMs: 0,
    factoryCreateTimeMs: 0,
    formatGenerationTimes: {},
    totalAnalysisTimeMs: 0,
    formatErrors: {},
  };

  const readChunk = async (size: number, offset: number) => {
    if (offset >= fileBuffer.byteLength) {
      return new Uint8Array(0);
    }
    const end = Math.min(offset + size, fileBuffer.byteLength);
    return fileBuffer.subarray(offset, end);
  };

  const shouldGenerateAll =
    requestedFormats.includes('all') || requestedFormats.length === 0;

  const allFormats: { type: MediaInfoFormat; key: string }[] = [
    { type: 'object', key: 'json' },
    { type: 'Text', key: 'text' },
    { type: 'XML', key: 'xml' },
    { type: 'HTML', key: 'html' },
  ];

  const formatsToGenerate = allFormats.filter(
    (f) =>
      shouldGenerateAll ||
      requestedFormats.includes(f.key) ||
      requestedFormats.includes(f.type.toLowerCase()),
  );

  const results: Record<string, string> = {};

  // Generate formats sequentially to save memory/CPU
  // Default to JSON if no format specified effectively
  if (formatsToGenerate.length === 0) {
    formatsToGenerate.push({ type: 'object', key: 'json' });
  }

  let infoInstance: MediaInfo | undefined;
  try {
    const tFactory = performance.now();
    infoInstance = await createMediaInfo();

    // Set initial options (defaults for subsequent loops)
    infoInstance.options.chunkSize = 5 * 1024 * 1024;
    infoInstance.options.coverData = false;

    diagnostics.factoryCreateTimeMs = Math.round(performance.now() - tFactory);

    for (const { type, key } of formatsToGenerate) {
      const tFormat = performance.now();
      try {
        // Use 'text' (lowercase) for Text view to match MediaInfo expectation
        const formatStr = type === 'Text' ? 'text' : type;

        infoInstance.options.format = formatStr as 'object';
        // Enable full output (internal tags) for object/JSON view AND Text view
        infoInstance.options.full = Boolean(
          type === 'object' || type === 'Text',
        );

        infoInstance.reset();

        // For 'object' format, analyzeData returns the result directly.
        // For others, we need to call inform().
        const resultData = await infoInstance.analyzeData(
          () => effectiveFileSize,
          readChunk,
        );
        let resultStr = '';

        if (type !== 'object') {
          resultStr = infoInstance.inform();
        }

        if (type === 'object') {
          try {
            // Normalize the data (unwrap { #value } objects) before returning
            const json = normalizeMediaInfo(resultData);

            if (json && json.media && json.media.track) {
              /* eslint-disable @typescript-eslint/no-explicit-any */
              const generalTrack = json.media.track.find(
                (t: any) => t['@type'] === 'General',
              ) as any;
              /* eslint-enable @typescript-eslint/no-explicit-any */
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
            results[key] = JSON.stringify(json, null, 2);
          } catch (e) {
            diagnostics.objectProcessError =
              e instanceof Error ? e.message : String(e);
            results[key] = '{}';
          }
        } else if (type === 'Text') {
          if (!resultStr.includes('Complete name')) {
            // Injection logic for text
            const lines = resultStr.split('\n');
            const generalIndex = lines.findIndex((l: string) =>
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

        diagnostics.formatGenerationTimes[key] = Math.round(
          performance.now() - tFormat,
        );
      } catch (err) {
        diagnostics.formatErrors[key] =
          err instanceof Error ? err.message : String(err);
        results[key] = `Error generating ${type} view.`;
      }
    }
  } finally {
    if (infoInstance) {
      infoInstance.close();
    }
  }

  diagnostics.totalAnalysisTimeMs = Math.round(performance.now() - tStart);
  return { results, diagnostics };
}
