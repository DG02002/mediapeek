import { describe, expect, it } from 'vitest';

import {
  redactSensitiveLogData,
  redactSensitiveUrl,
  summarizeSensitiveToken,
} from './log-redaction';

describe('redactSensitiveUrl', () => {
  it('redacts known sensitive query params', () => {
    const redacted = redactSensitiveUrl(
      'https://example.com/video.mkv?token=abc123&x-amz-signature=xyz&foo=bar',
    );
    expect(redacted).toContain('token=%5BREDACTED%5D');
    expect(redacted).toContain('x-amz-signature=%5BREDACTED%5D');
    expect(redacted).toContain('foo=bar');
  });
});

describe('redactSensitiveLogData', () => {
  it('redacts sensitive object fields and nested urls', () => {
    const payload = {
      token: 'abcdef',
      url: 'https://cdn.example.com/a.mkv?sig=abc&expires=10',
      nested: {
        authorization: 'Bearer token',
      },
    };
    const redacted = redactSensitiveLogData(payload);

    expect(redacted.token).toBe('[REDACTED]');
    expect(redacted.nested.authorization).toBe('[REDACTED]');
    expect(redacted.url).toContain('sig=[REDACTED]');
    expect(redacted.url).toContain('expires=[REDACTED]');
  });
});

describe('summarizeSensitiveToken', () => {
  it('returns metadata only', () => {
    expect(summarizeSensitiveToken(' abc ')).toEqual({
      tokenPresent: true,
      tokenLength: 3,
    });
    expect(summarizeSensitiveToken('')).toEqual({
      tokenPresent: false,
      tokenLength: 0,
    });
  });
});
