import {
  extractFilenameFromUrl,
  getMediaInfoMetadataFilename,
  isValidFilename,
  parseContentDispositionFilename,
} from './filename-resolution';

import { describe, expect, it } from 'vitest';

describe('filename-resolution', () => {
  it('parses UTF-8 filename* values', () => {
    const header =
      "attachment; filename*=UTF-8''sample-placeholder-video.mkv";

    expect(parseContentDispositionFilename(header)).toBe(
      'sample-placeholder-video.mkv',
    );
  });

  it('parses plain filename values', () => {
    const header = 'attachment; filename="Movie Name.mp4"';

    expect(parseContentDispositionFilename(header)).toBe('Movie Name.mp4');
  });

  it('ignores missing or invalid content-disposition filenames', () => {
    expect(parseContentDispositionFilename(undefined)).toBeUndefined();
    expect(parseContentDispositionFilename('attachment')).toBeUndefined();
    expect(
      parseContentDispositionFilename(
        'attachment; filename="E\u001a\u0000garbage"',
      ),
    ).toBeUndefined();
  });

  it('extracts the basename from a URL path', () => {
    expect(
      extractFilenameFromUrl(
        'https://example.com/path/to/My%20Movie%20(2025).mkv?download=1',
      ),
    ).toBe('My Movie (2025).mkv');
  });

  it('prefers Title over Movie from MediaInfo metadata', () => {
    expect(
      getMediaInfoMetadataFilename({
        Title: 'placeholder-title-token',
        Movie: 'placeholder-movie-token',
      }),
    ).toEqual({
      filename: 'placeholder-title-token',
      source: 'mediainfo-title',
    });
  });

  it('falls back to Movie when Title is not usable', () => {
    expect(
      getMediaInfoMetadataFilename({
        Title: '   ',
        Movie: 'placeholder-movie-token',
      }),
    ).toEqual({
      filename: 'placeholder-movie-token',
      source: 'mediainfo-movie',
    });
  });

  it('rejects blank or binary-garbage filenames', () => {
    expect(isValidFilename('')).toBe(false);
    expect(isValidFilename(null)).toBe(false);
    expect(isValidFilename('E\u001a\u0000garbage')).toBe(false);
  });
});
