import { isProductionEnvironment } from '@mediapeek/shared/runtime-config';

const encoder = new TextEncoder();

export const TURNSTILE_GRANT_COOKIE_NAME = 'mp_turnstile_grant';
export const TURNSTILE_GRANT_TTL_SECONDS = 10 * 60;
const TURNSTILE_GRANT_PATH = '/resource/analyze';

type GrantPayload = {
  e: number;
  u: string;
};

export type TurnstileGrantVerifyReason =
  | 'GRANT_VALID'
  | 'GRANT_MISSING'
  | 'GRANT_MALFORMED'
  | 'GRANT_INVALID_SIGNATURE'
  | 'GRANT_EXPIRED'
  | 'GRANT_URL_MISMATCH';

export type TurnstileGrantVerifyResult =
  | {
      valid: true;
      reason: 'GRANT_VALID';
      expiresAt: number;
    }
  | {
      valid: false;
      reason: Exclude<TurnstileGrantVerifyReason, 'GRANT_VALID'>;
    };

const encodeBase64 = (bytes: Uint8Array) => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
};

const decodeBase64 = (input: string) => {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(input, 'base64'));
  }

  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const toBase64Url = (bytes: Uint8Array) =>
  encodeBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const fromBase64Url = (input: string) => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const remainder = normalized.length % 4;
  const padded =
    remainder === 0
      ? normalized
      : `${normalized}${'='.repeat(4 - remainder)}`;
  return decodeBase64(padded);
};

const isSafeEqual = (left: string, right: string) => {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
};

const importHmacKey = (secret: string) =>
  crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

const signHmacSha256 = async (secret: string, payload: string) => {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload),
  );
  return toBase64Url(new Uint8Array(signature));
};

const createGrantPayload = async (url: string, expiresAt: number) => {
  const urlHash = await hashAnalyzeUrl(url);
  return {
    e: expiresAt,
    u: urlHash,
  } satisfies GrantPayload;
};

export const canonicalizeAnalyzeUrl = (rawUrl: string) => {
  const parsed = new URL(rawUrl);
  parsed.username = '';
  parsed.password = '';
  parsed.hash = '';
  parsed.protocol = parsed.protocol.toLowerCase();
  parsed.hostname = parsed.hostname.toLowerCase();

  if (
    (parsed.protocol === 'http:' && parsed.port === '80') ||
    (parsed.protocol === 'https:' && parsed.port === '443')
  ) {
    parsed.port = '';
  }

  const sortedEntries = [...parsed.searchParams.entries()].sort((left, right) =>
    left[0] === right[0]
      ? left[1].localeCompare(right[1])
      : left[0].localeCompare(right[0]),
  );

  parsed.search = '';
  for (const [key, value] of sortedEntries) {
    parsed.searchParams.append(key, value);
  }

  return parsed.toString();
};

export const hashAnalyzeUrl = async (rawUrl: string) => {
  const canonical = canonicalizeAnalyzeUrl(rawUrl);
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(canonical));
  return toBase64Url(new Uint8Array(digest));
};

export const createTurnstileGrantToken = async ({
  secret,
  url,
  nowMs = Date.now(),
  ttlSeconds = TURNSTILE_GRANT_TTL_SECONDS,
}: {
  secret: string;
  url: string;
  nowMs?: number;
  ttlSeconds?: number;
}) => {
  const expiresAt = Math.floor(nowMs / 1000) + ttlSeconds;
  const payload = await createGrantPayload(url, expiresAt);
  const encodedPayload = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await signHmacSha256(secret, encodedPayload);
  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt,
  };
};

export const verifyTurnstileGrantToken = async ({
  secret,
  url,
  token,
  nowMs = Date.now(),
}: {
  secret: string;
  url: string;
  token?: string | null;
  nowMs?: number;
}): Promise<TurnstileGrantVerifyResult> => {
  if (!token) {
    return { valid: false, reason: 'GRANT_MISSING' };
  }

  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature || token.split('.').length !== 2) {
    return { valid: false, reason: 'GRANT_MALFORMED' };
  }

  let payload: GrantPayload;
  try {
    payload = JSON.parse(
      new TextDecoder().decode(fromBase64Url(encodedPayload)),
    ) as GrantPayload;
  } catch {
    return { valid: false, reason: 'GRANT_MALFORMED' };
  }

  if (!payload || typeof payload.e !== 'number' || typeof payload.u !== 'string') {
    return { valid: false, reason: 'GRANT_MALFORMED' };
  }

  const expectedSignature = await signHmacSha256(secret, encodedPayload);
  if (!isSafeEqual(expectedSignature, signature)) {
    return { valid: false, reason: 'GRANT_INVALID_SIGNATURE' };
  }

  const nowSeconds = Math.floor(nowMs / 1000);
  if (payload.e <= nowSeconds) {
    return { valid: false, reason: 'GRANT_EXPIRED' };
  }

  const expectedUrlHash = await hashAnalyzeUrl(url);
  if (!isSafeEqual(payload.u, expectedUrlHash)) {
    return { valid: false, reason: 'GRANT_URL_MISMATCH' };
  }

  return {
    valid: true,
    reason: 'GRANT_VALID',
    expiresAt: payload.e,
  };
};

export const readTurnstileGrantCookie = (
  cookieHeader: string | null | undefined,
) => {
  if (!cookieHeader) return null;

  const entries = cookieHeader.split(';');
  for (const entry of entries) {
    const trimmed = entry.trim();
    if (!trimmed.startsWith(`${TURNSTILE_GRANT_COOKIE_NAME}=`)) {
      continue;
    }

    const value = trimmed.slice(TURNSTILE_GRANT_COOKIE_NAME.length + 1);
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
};

export const serializeTurnstileGrantCookie = ({
  token,
  appEnv,
  ttlSeconds = TURNSTILE_GRANT_TTL_SECONDS,
}: {
  token: string;
  appEnv: 'development' | 'staging' | 'production';
  ttlSeconds?: number;
}) => {
  const attributes = [
    `${TURNSTILE_GRANT_COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Max-Age=${ttlSeconds}`,
    `Path=${TURNSTILE_GRANT_PATH}`,
    'HttpOnly',
    'SameSite=Lax',
  ];

  if (isProductionEnvironment(appEnv)) {
    attributes.push('Secure');
  }

  return attributes.join('; ');
};
