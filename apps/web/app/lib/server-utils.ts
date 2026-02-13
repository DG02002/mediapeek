import path from 'node:path';

const LOCALHOST_IPS = new Set(['::1', '127.0.0.1']);
const META_DATA_HOSTS = new Set([
  'metadata.google.internal',
  '169.254.169.254',
]);

const GOOGLE_DRIVE_REGEX =
  /https:\/\/drive\.google\.com\/file\/d\/([-a-zA-Z0-9_]+)\/view/;

// Headers are static, so we can reuse the same object or recreate from a static init.
// However, Headers API is mutable, so returning a fresh instance is safer if callers modify it.
// But we can define the static values once.
const EMULATION_HEADERS_INIT = {
  accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'accept-language': 'en-US,en;q=0.9',
  priority: 'u=0, i',
  'sec-ch-ua':
    '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'none',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
};

export const validateUrl = (url: string) => {
  const parsedUrl = new URL(url);
  const host = parsedUrl.hostname;

  if (
    host === 'localhost' ||
    host.startsWith('127.') ||
    LOCALHOST_IPS.has(host)
  ) {
    throw new Error('Invalid URL: Access to local resources is denied.');
  }

  if (META_DATA_HOSTS.has(host)) {
    throw new Error('Invalid URL: Access to metadata services is denied.');
  }

  // Private IP ranges
  if (host.startsWith('10.') || host.startsWith('192.168.')) {
    throw new Error('Invalid URL: Access to private resources is denied.');
  }

  // 172.16.0.0/12
  if (host.startsWith('172.')) {
    const secondOctet = parseInt(host.split('.')[1], 10);
    if (!isNaN(secondOctet) && secondOctet >= 16 && secondOctet <= 31) {
      throw new Error('Invalid URL: Access to private resources is denied.');
    }
  }
};

export const resolveGoogleDriveUrl = (url: string) => {
  const match = GOOGLE_DRIVE_REGEX.exec(url);
  if (match?.[1]) {
    const fileId = match[1];
    return {
      url: `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
      isGoogleDrive: true,
    };
  } else if (url.includes('drive.usercontent.google.com')) {
    return { url, isGoogleDrive: true };
  }
  return { url, isGoogleDrive: false };
};

export const getEmulationHeaders = (range?: string): Headers => {
  const headers = new Headers(EMULATION_HEADERS_INIT);
  if (range) headers.set('Range', range);
  return headers;
};

export const extractFilenameFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    // Use Node.js path module for robust filename extraction
    // We use POSIX because URLs are always forward-slash separated
    const basename = path.posix.basename(pathname);

    // Decode URI component to handle encoded characters (e.g. %20)
    // and check if it's not empty or just a slash
    if (basename && basename !== '/' && basename !== '.') {
      return decodeURIComponent(basename);
    }
  } catch {
    // Fallback if parsing fails or URL is invalid
  }
  return url;
};

/**
 * Checks if the filename has an archive extension.
 */
export const isArchiveExtension = (filename: string): boolean => {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return ['zip', 'tar', 'rar', '7z', 'gz', 'bz2', 'xz'].includes(ext);
};
