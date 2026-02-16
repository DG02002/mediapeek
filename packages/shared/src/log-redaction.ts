const REDACTED = '[REDACTED]';

const SENSITIVE_QUERY_PREFIXES = ['x-amz-', 'x-goog-'] as const;
const SENSITIVE_QUERY_KEYS: Record<string, true> = {
  token: true,
  sig: true,
  signature: true,
  key: true,
  auth: true,
  authorization: true,
  expires: true,
  api_key: true,
  apikey: true,
  access_token: true,
  id_token: true,
  refresh_token: true,
};

const SENSITIVE_FIELD_PATTERNS = [
  /token/i,
  /secret/i,
  /api[-_]?key/i,
  /authorization/i,
  /cookie/i,
  /password/i,
  /signature/i,
];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date);

const isLikelyAbsoluteUrl = (value: string) =>
  /^https?:\/\//i.test(value.trim());

export const isSensitiveQueryParam = (param: string) => {
  const normalized = param.trim().toLowerCase();
  if (SENSITIVE_QUERY_KEYS[normalized]) return true;
  return SENSITIVE_QUERY_PREFIXES.some((prefix) =>
    normalized.slice(0, prefix.length) === prefix,
  );
};

export const redactSensitiveUrl = (rawUrl: string) => {
  if (!isLikelyAbsoluteUrl(rawUrl)) return rawUrl;

  try {
    const parsed = new URL(rawUrl);
    const keys: string[] = [];
    parsed.searchParams.forEach((_value, key) => {
      if (keys.indexOf(key) === -1) {
        keys.push(key);
      }
    });
    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index];
      if (isSensitiveQueryParam(key)) parsed.searchParams.set(key, REDACTED);
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
};

const isSensitiveFieldName = (key: string) =>
  SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(key));

const redactString = (value: string) =>
  (isLikelyAbsoluteUrl(value) ? redactSensitiveUrl(value) : value).replace(
    /\b(token|sig|signature|key|auth|authorization|expires|api_key|apikey|access_token|id_token|refresh_token|x-amz-[\w-]+|x-goog-[\w-]+)=([^&\s]+)/gi,
    (_, name: string) => `${name}=${REDACTED}`,
  );

const redactInternal = (value: unknown, keyHint?: string): unknown => {
  if (typeof value === 'string') {
    if (keyHint && isSensitiveFieldName(keyHint)) return REDACTED;
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactInternal(entry));
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const key in value) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const nested = value[key];
    result[key] = isSensitiveFieldName(key)
      ? REDACTED
      : redactInternal(nested, key);
  }
  return result;
};

export const redactSensitiveLogData = <T>(value: T): T =>
  redactInternal(value) as T;

export const summarizeSensitiveToken = (token: string | null | undefined) => {
  const normalized = token?.trim() ?? '';
  return {
    tokenPresent: normalized.length > 0,
    tokenLength: normalized.length,
  };
};
