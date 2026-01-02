export const validateUrl = (url: string) => {
  const parsedUrl = new URL(url);
  const host = parsedUrl.hostname;

  if (
    host === 'localhost' ||
    host.startsWith('127.') ||
    host === '[::1]' ||
    host === '::1'
  ) {
    throw new Error('Invalid URL: Access to local resources is denied.');
  }

  if (
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    host.startsWith('169.254.') ||
    (host.startsWith('172.') &&
      parseInt(host.split('.')[1], 10) >= 16 &&
      parseInt(host.split('.')[1], 10) <= 31)
  ) {
    throw new Error('Invalid URL: Access to private resources is denied.');
  }

  if (host === 'metadata.google.internal' || host === '169.254.169.254') {
    throw new Error('Invalid URL: Access to metadata services is denied.');
  }
};

export const resolveGoogleDriveUrl = (url: string) => {
  const googleDriveRegex =
    /https:\/\/drive\.google\.com\/file\/d\/([-a-zA-Z0-9_]+)\/view/;
  const match = url.match(googleDriveRegex);
  if (match && match[1]) {
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

export const getEmulationHeaders = (range?: string) => {
  const headers = new Headers();
  if (range) headers.set('Range', range);
  headers.set(
    'accept',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  );
  headers.set('accept-language', 'en-US,en;q=0.9');
  headers.set('priority', 'u=0, i');
  headers.set(
    'sec-ch-ua',
    '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
  );
  headers.set('sec-ch-ua-mobile', '?0');
  headers.set('sec-ch-ua-platform', '"macOS"');
  headers.set('sec-fetch-dest', 'document');
  headers.set('sec-fetch-mode', 'navigate');
  headers.set('sec-fetch-site', 'none');
  headers.set('sec-fetch-user', '?1');
  headers.set('upgrade-insecure-requests', '1');
  headers.set(
    'user-agent',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  );
  return headers;
};
