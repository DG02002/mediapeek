export type FilenameSource =
  | 'url'
  | 'content-disposition-head'
  | 'content-disposition-get'
  | 'archive-inner'
  | 'mediainfo-title'
  | 'mediainfo-movie';

export interface ResolvedFilename {
  filename: string;
  source: FilenameSource;
}

export interface MediaInfoFilenameFields {
  CompleteName?: string;
  Complete_name?: string;
  File_Name?: string;
  Title?: string;
  Movie?: string;
}

const trimWrappingQuotes = (value: string) => {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
};

export function normalizeFilenameCandidate(
  value?: string | null,
): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = trimWrappingQuotes(value.trim());
  return trimmed.length > 0 ? trimmed : undefined;
}

export function isValidFilename(str?: string | null): str is string {
  const candidate = normalizeFilenameCandidate(str);
  if (!candidate) return false;

  let suspiciousCount = 0;
  for (let i = 0; i < candidate.length; i += 1) {
    const code = candidate.charCodeAt(i);
    if (
      code < 32 ||
      code === 127 ||
      code === 0xfffd ||
      (code >= 0x80 && code <= 0x9f)
    ) {
      suspiciousCount += 1;
    }
  }

  return suspiciousCount / candidate.length <= 0.05;
}

export function extractFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split('/').filter(Boolean);
    const basename = segments[segments.length - 1];
    if (basename) {
      return decodeURIComponent(basename);
    }
  } catch {
    // Keep the original URL as the last-resort token for diagnostics/debugging.
  }

  return url;
}

export function parseContentDispositionFilename(
  contentDisposition?: string | null,
): string | undefined {
  if (!contentDisposition) return undefined;

  const utf8Match = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(contentDisposition);
  if (utf8Match?.[1]) {
    try {
      const decoded = decodeURIComponent(utf8Match[1]);
      return isValidFilename(decoded) ? normalizeFilenameCandidate(decoded) : undefined;
    } catch {
      // Fall through to plain filename parsing.
    }
  }

  const plainMatch = /filename\s*=\s*("?)([^";]+)\1/i.exec(contentDisposition);
  if (!plainMatch?.[2]) return undefined;

  const candidate = normalizeFilenameCandidate(plainMatch[2]);
  return isValidFilename(candidate) ? candidate : undefined;
}

export function getEmbeddedMediaInfoFilename(
  track?: MediaInfoFilenameFields | null,
): string | undefined {
  if (!track) return undefined;

  const candidates = [track.CompleteName, track.Complete_name, track.File_Name];
  for (const candidate of candidates) {
    if (isValidFilename(candidate)) {
      return normalizeFilenameCandidate(candidate);
    }
  }

  return undefined;
}

export function getMediaInfoMetadataFilename(
  track?: MediaInfoFilenameFields | null,
): ResolvedFilename | undefined {
  if (!track) return undefined;

  if (isValidFilename(track.Title)) {
    return {
      filename: normalizeFilenameCandidate(track.Title)!,
      source: 'mediainfo-title',
    };
  }

  if (isValidFilename(track.Movie)) {
    return {
      filename: normalizeFilenameCandidate(track.Movie)!,
      source: 'mediainfo-movie',
    };
  }

  return undefined;
}
