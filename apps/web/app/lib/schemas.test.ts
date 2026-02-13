import { describe, expect, it } from 'vitest';

import { analyzeSchema } from '~/lib/schemas';

describe('analyzeSchema', () => {
  it('validates a correct URL', () => {
    const input = { url: 'https://example.com/video.mp4' };
    const result = analyzeSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.url).toBe('https://example.com/video.mp4');
      expect(result.data.format).toEqual([]);
    }
  });

  it('rejects an invalid URL', () => {
    const input = { url: 'not-a-url' };
    const result = analyzeSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        'Please provide a valid URL.',
      );
    }
  });

  it('parses comma-separated formats', () => {
    const input = {
      url: 'https://example.com',
      format: 'JSON, text , object ',
    };
    const result = analyzeSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.format).toEqual(['json', 'text', 'object']);
    }
  });

  it('handles empty format', () => {
    const input = { url: 'https://example.com', format: '' };
    const result = analyzeSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.format).toEqual([]);
    }
  });

  it('rejects invalid format values', () => {
    const input = { url: 'https://example.com', format: 'json,invalid' };
    const result = analyzeSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('Invalid option');
    }
  });
});
