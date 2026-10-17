import { describe, expect, it } from 'vitest';

import { extractFilenameFromUrl } from './server-utils';

describe('extractFilenameFromUrl', () => {
  it('should extract and decode filename from URL', () => {
    const url = 'https://example.com/path/to/My%20File%20Name.mkv';
    expect(extractFilenameFromUrl(url)).toBe('My File Name.mkv');
  });

  it('should handle complex URLs from user case', () => {
    const url =
      'https://example.com/path/to/Complex%20Movie%20Name%20(2000)%20[4K].mkv';
    expect(extractFilenameFromUrl(url)).toBe(
      'Complex Movie Name (2000) [4K].mkv',
    );
  });

  it('should handle URLs with trailing slashes', () => {
    const url = 'https://example.com/folder/';
    expect(extractFilenameFromUrl(url)).toBe('folder');
  });

  it('should handle invalid URLs by returning them as is', () => {
    expect(extractFilenameFromUrl('not-a-url')).toBe('not-a-url');
  });
});
