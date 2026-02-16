import { analyzeSchema } from '@mediapeek/shared/schemas';
import { describe, expect, it } from 'vitest';

describe('analyzeSchema', () => {
  it('validates a correct URL and applies default format', () => {
    const result = analyzeSchema.safeParse({
      url: 'https://example.com/video.mp4',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.url).toBe('https://example.com/video.mp4');
      expect(result.data.format).toEqual(['JSON']);
    }
  });

  it('rejects an invalid URL', () => {
    const result = analyzeSchema.safeParse({ url: 'not-a-url' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Invalid URL provided.');
    }
  });

  it('accepts array-based formats', () => {
    const result = analyzeSchema.safeParse({
      url: 'https://example.com',
      format: ['object', 'text'],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.format).toEqual(['object', 'text']);
    }
  });
});
