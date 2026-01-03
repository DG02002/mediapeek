import MediaInfoFactory from '~/lib/mediaInfoFactory';

// @ts-expect-error - Missing types for WASM import
import mediaInfoWasm from '../wasm/MediaInfoModule.wasm';

export interface MediaInfoResult {
  [key: string]: string;
}

export type MediaInfoFormat = 'JSON' | 'Text' | 'XML' | 'HTML';

export async function analyzeMediaBuffer(
  fileBuffer: Uint8Array,
  fileSize: number,
  filename: string,
  requestedFormats: string[] = [],
): Promise<MediaInfoResult> {
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
    { type: 'JSON', key: 'json' },
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
    formatsToGenerate.push({ type: 'JSON', key: 'json' });
  }

  let infoInstance;
  try {
    // Initialize MediaInfo once
    // Use the first requested format as initial, or fallback to JSON
    const initialFormat = formatsToGenerate[0]?.type || 'JSON';

    infoInstance = await MediaInfoFactory({
      format:
        initialFormat === 'Text'
          ? 'text'
          : (initialFormat as 'object' | 'JSON' | 'XML' | 'HTML' | 'text'),
      coverData: false,
      full: false,
      chunkSize: 5 * 1024 * 1024,
      wasmModule: mediaInfoWasm,
      locateFile: () => 'ignored',
    });

    for (const { type, key } of formatsToGenerate) {
      try {
        // Use 'text' (lowercase) for Text view to match MediaInfo expectation
        const formatStr = type === 'Text' ? 'text' : type;
        infoInstance.options.format = formatStr as
          | 'object'
          | 'JSON'
          | 'XML'
          | 'HTML'
          | 'text';

        infoInstance.reset();

        await infoInstance.analyzeData(() => fileSize, readChunk);

        let resultStr = infoInstance.inform();

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
            results[key] = JSON.stringify(json, null, 2);
          } catch (e) {
            console.warn('Failed to parse/inject JSON result:', e);
            results[key] = resultStr; // Fallback
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
      } catch (err) {
        console.error(`Failed to generate ${type}:`, err);
        results[key] = `Error generating ${type} view.`;
      }
    }
  } catch (error) {
    console.error('MediaInfo Analysis execution failed:', error);
    throw error;
  } finally {
    if (infoInstance) {
      infoInstance.close();
    }
  }

  return results;
}
