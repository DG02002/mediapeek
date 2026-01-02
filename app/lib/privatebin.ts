export interface PrivateBinResponse {
  status: number;
  id: string;
  url: string;
  deletetoken: string;
  message?: string;
}

const privateBinHost = 'https://privatebin.net';

// Helper to encode ArrayBuffer to Base64 (Standard)
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export async function uploadToPrivateBin(
  content: string,
): Promise<{ url: string; deleteUrl: string }> {
  // 1. Generate a random 256-bit key (32 bytes)
  const keyBytes = window.crypto.getRandomValues(new Uint8Array(32));

  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
  const salt = window.crypto.getRandomValues(new Uint8Array(8)); // 64-bit salt
  const iterations = 100000;
  const keySize = 256;
  const tagSize = 128;

  const passphraseKey = await window.crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveKey', 'deriveBits'],
  );

  const cryptoKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256',
    },
    passphraseKey,
    { name: 'AES-GCM', length: keySize },
    false,
    ['encrypt'],
  );

  const cryptoParams = [
    arrayBufferToBase64(iv.buffer),
    arrayBufferToBase64(salt.buffer),
    iterations,
    keySize,
    tagSize,
    'aes',
    'gcm',
    'none',
  ];

  const adata = [
    cryptoParams,
    'plaintext', // format
    0, // open_discussion
    0, // burn_after_reading
  ];

  const adataJson = JSON.stringify(adata);
  const adataBytes = new TextEncoder().encode(adataJson);

  // 3. Encrypt
  // 3. Encrypt
  const encodedContent = new TextEncoder().encode(
    JSON.stringify({ paste: content }),
  );

  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
      additionalData: adataBytes,
      tagLength: 128,
    },
    cryptoKey,
    encodedContent,
  );

  // 4. Construct payload
  const ct = arrayBufferToBase64(encrypted);

  const payload = {
    v: 2,
    adata: adata,
    ct: ct,
    meta: {
      expire: '1week', // Default to 1 week
    },
  };

  // 5. Upload
  const response = await fetch(`${privateBinHost}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'JSONHttpRequest', // Trigger JSON API response
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('PrivateBin HTTP Error:', response.status, text);
    throw new Error(
      `PrivateBin upload failed: ${response.statusText} (${response.status})`,
    );
  }

  const result = (await response.json()) as PrivateBinResponse;

  if (result.status !== 0) {
    console.error(
      'PrivateBin API Error Status:',
      result.status,
      'Message:',
      result.message,
    );
    throw new Error(`PrivateBin error: Status ${result.status}`);
  }

  // 6. Construct URL
  const keyBase58 = toBase58(keyBytes);

  return {
    url: `${privateBinHost}/?${result.id}#${keyBase58}`,
    deleteUrl: `${privateBinHost}/?pasteid=${result.id}&deletetoken=${result.deletetoken}`,
  };
}

// Simple Base58 encoder map
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function toBase58(bytes: Uint8Array): string {
  let z = 0;
  while (z < bytes.length && bytes[z] === 0) {
    z++;
  }

  const b58bytes: number[] = [];
  for (let i = z; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < b58bytes.length; j++) {
      const x = b58bytes[j] * 256 + carry;
      b58bytes[j] = x % 58;
      carry = Math.floor(x / 58);
    }
    while (carry > 0) {
      b58bytes.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  let str = '';
  for (let i = 0; i < z; i++) {
    str += ALPHABET[0];
  }
  for (let i = b58bytes.length - 1; i >= 0; i--) {
    str += ALPHABET[b58bytes[i]];
  }

  return str;
}
