import { DiagnosticsError } from '../lib/error-utils';
import {
  extractFirstFileFromArchive,
  isArchiveExtension,
  isValidFilename,
  normalizeMediaInfo,
} from '../lib/media-utils';
import { createMediaInfo, type MediaInfo } from './mediainfo-factory.server';

export class CpuBudgetExceededError extends Error {
  constructor(message = 'CPU budget exceeded') {
    super(message);
    this.name = 'CpuBudgetExceededError';
  }
}

const checkCpuBudget = (start: number, limitMs = 300000) => {
  if (performance.now() - start > limitMs) {
    throw new CpuBudgetExceededError();
  }
};

// Strict typing for MediaInfo results, removing 'any' usage
export interface MediaInfoResult extends Record<string, unknown> {
  media?: {
    track?: {
      '@type': string;
      CompleteName?: string;
      Complete_name?: string;
      File_Name?: string;
      [key: string]: unknown;
    }[];
  };
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

/**
 * Wrapper to make MediaInfo compatible with 'using' keyword (Explicit Resource Management)
 */
class DisposableMediaInfo implements Disposable {
  public instance: MediaInfo;

  constructor(instance: MediaInfo) {
    this.instance = instance;
  }

  [Symbol.dispose]() {
    this.instance.close();
  }

  dispose() {
    this.instance.close();
  }
}

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

  // Attempt to detect inner file from archive (Container Peeking)
  // OPTIMIZATION: Only scan for inner files if the filename extension suggests an archive.
  // This prevents wasting CPU scanning every MKV/MP4 file for zip headers.
  let archiveInnerName: string | null = null;
  if (isArchiveExtension(filename)) {
    archiveInnerName = extractFirstFileFromArchive(fileBuffer);
  }

  // Prefer the archive inner name if detected (Prong B)
  // Otherwise, use the filename passed to us (Prong A might have set this to the inner name already, or it's just the URL filename)
  const displayFilename = archiveInnerName ?? filename;

  const readChunk = (chunkSize: number, offset: number) => {
    if (offset >= fileBuffer.byteLength) {
      return new Uint8Array(0);
    }
    const end = Math.min(offset + chunkSize, fileBuffer.byteLength);
    return fileBuffer.subarray(offset, end);
  };

  const shouldGenerateAll = requestedFormats.includes('all');

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

  // Default to JSON if no format specified effectively
  if (formatsToGenerate.length === 0) {
    formatsToGenerate.push({ type: 'object', key: 'json' });
  }

  try {
    const tFactory = performance.now();

    // Explicit Resource Management: Manually close 'info' in finally block
    // 'using' requires ESNext target and polyfills which may not be present in CF Workers environment
    const rawInstance = await createMediaInfo();
    const disposableInfo = new DisposableMediaInfo(rawInstance);
    const infoInstance = disposableInfo.instance;

    try {
      // Set initial options
      infoInstance.options.chunkSize = 5 * 1024 * 1024;
      infoInstance.options.coverData = false;

      diagnostics.factoryCreateTimeMs = Math.round(
        performance.now() - tFactory,
      );

      for (const { type, key } of formatsToGenerate) {
        const tFormat = performance.now();
        try {
          const formatStr = type === 'Text' ? 'text' : type;

          infoInstance.options.format = formatStr as 'object';
          infoInstance.options.full = type === 'object' || type === 'Text';

          infoInstance.reset();

          const resultData = await infoInstance.analyzeData(
            () => effectiveFileSize,
            (size: number, offset: number) => {
              checkCpuBudget(tStart);
              return readChunk(size, offset);
            },
          );
          let resultStr = '';

          if (type !== 'object') {
            resultStr = infoInstance.inform();
          }

          if (type === 'object') {
            try {
              // Normalize the data (unwrap { #value } objects)
              const json = normalizeMediaInfo(resultData) as MediaInfoResult;

              if (json.media?.track) {
                const generalTrack = json.media.track.find(
                  (t) => t['@type'] === 'General',
                );

                if (generalTrack) {
                  // Get the first valid filename from MediaInfo, or undefined
                  const getValidFilename = (): string | undefined => {
                    if (isValidFilename(generalTrack.CompleteName))
                      return generalTrack.CompleteName;
                    if (isValidFilename(generalTrack.Complete_name))
                      return generalTrack.Complete_name;
                    if (isValidFilename(generalTrack.File_Name))
                      return generalTrack.File_Name;
                    return undefined;
                  };

                  const mediaInfoFilename = getValidFilename();

                  if (!mediaInfoFilename) {
                    // No valid filename from MediaInfo (likely binary garbage), use our resolved filename
                    generalTrack.CompleteName = displayFilename;
                  } else if (archiveInnerName) {
                    // If we specifically found an inner name from archive peeking, force use it
                    // because MediaInfo likely returned the OUTER zip name or nothing useful.
                    generalTrack.CompleteName = displayFilename;
                  }

                  // If detected name differs from URL name, preserve URL name as Archive Name
                  // This typically happens for archives: `displayFilename` (inner) != `filename` (outer zip)
                  // For direct links: `displayFilename` == `filename`, so Archive_Name is NOT set.
                  if (displayFilename !== filename) {
                    generalTrack.Archive_Name = filename;
                  }
                }
              }
              results[key] = JSON.stringify(json);
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
                  `Complete name${padding}: ${displayFilename}`,
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
      // Clean up MediaInfo instance
      infoInstance.close();
      disposableInfo.dispose();
    }
  } catch (err) {
    // Catch factory errors or other failures not caught in loop
    diagnostics.wasmLoadError =
      err instanceof Error ? err.message : String(err);

    // Propagate up with partial diagnostics
    throw new DiagnosticsError(diagnostics.wasmLoadError, diagnostics, err);
  }

  diagnostics.totalAnalysisTimeMs = Math.round(performance.now() - tStart);
  return { results, diagnostics };
}
