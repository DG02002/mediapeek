import { describe, expect, it } from 'vitest';

import {
  canonicalizeAnalyzeUrl,
  createTurnstileGrantToken,
  readTurnstileGrantCookie,
  serializeTurnstileGrantCookie,
  verifyTurnstileGrantToken,
} from './turnstile-grant.server';

describe('turnstile grant token', () => {
  const secret = 'test-turnstile-grant-secret';
  const url = 'https://example.com/video.mp4?b=2&a=1';
  const nowMs = Date.UTC(2026, 1, 16, 12, 0, 0);

  it('accepts a valid token for a matching url', async () => {
    const { token } = await createTurnstileGrantToken({
      secret,
      url,
      nowMs,
    });

    const result = await verifyTurnstileGrantToken({
      secret,
      url,
      token,
      nowMs: nowMs + 30_000,
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.reason).toBe('GRANT_VALID');
      expect(result.expiresAt).toBeGreaterThan(Math.floor(nowMs / 1000));
    }
  });

  it('rejects a token for a different url', async () => {
    const { token } = await createTurnstileGrantToken({
      secret,
      url,
      nowMs,
    });

    const result = await verifyTurnstileGrantToken({
      secret,
      url: 'https://example.com/other.mp4?a=1&b=2',
      token,
      nowMs: nowMs + 30_000,
    });

    expect(result).toEqual({
      valid: false,
      reason: 'GRANT_URL_MISMATCH',
    });
  });

  it('rejects an expired token', async () => {
    const { token } = await createTurnstileGrantToken({
      secret,
      url,
      nowMs,
      ttlSeconds: 2,
    });

    const result = await verifyTurnstileGrantToken({
      secret,
      url,
      token,
      nowMs: nowMs + 5_000,
    });

    expect(result).toEqual({
      valid: false,
      reason: 'GRANT_EXPIRED',
    });
  });

  it('rejects a tampered token signature', async () => {
    const { token } = await createTurnstileGrantToken({
      secret,
      url,
      nowMs,
    });
    const tampered = `${token}x`;

    const result = await verifyTurnstileGrantToken({
      secret,
      url,
      token: tampered,
      nowMs: nowMs + 30_000,
    });

    expect(result).toEqual({
      valid: false,
      reason: 'GRANT_INVALID_SIGNATURE',
    });
  });
});

describe('turnstile grant cookie helpers', () => {
  it('serializes and reads cookie values', () => {
    const header = serializeTurnstileGrantCookie({
      token: 'abc.def',
      appEnv: 'production',
    });

    expect(header).toContain('mp_turnstile_grant=abc.def');
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Path=/resource/analyze');
    expect(header).toContain('Secure');

    const cookieHeader = `foo=bar; ${header.split(';')[0]}; theme=dark`;
    expect(readTurnstileGrantCookie(cookieHeader)).toBe('abc.def');
  });

  it('normalizes urls consistently before hashing/signing', () => {
    const left = canonicalizeAnalyzeUrl(
      'HTTPS://EXAMPLE.COM:443/video.mp4?z=3&a=1#fragment',
    );
    const right = canonicalizeAnalyzeUrl('https://example.com/video.mp4?a=1&z=3');
    expect(left).toBe(right);
  });
});
