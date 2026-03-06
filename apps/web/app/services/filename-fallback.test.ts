import type { MediaInfoResult } from '~/services/mediainfo.server';
import { fetchMediaChunk } from '~/services/media-fetch.server';
import { analyzeMediaBuffer } from '~/services/mediainfo.server';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mockAnalyzeDataResult: MediaInfoResult = {
  media: {
    track: [{ '@type': 'General' }],
  },
};

let mockInformResult = 'General\n';

vi.mock('~/services/mediainfo-factory.server', () => ({
  createMediaInfo: async () => ({
    options: {
      chunkSize: 0,
      coverData: false,
      format: 'object',
      full: true,
    },
    reset() {},
    async analyzeData() {
      return mockAnalyzeDataResult;
    },
    inform() {
      return mockInformResult;
    },
    close() {},
  }),
}));

const makeResponse = (
  body: Uint8Array | null,
  init: { status: number; headers?: Record<string, string> },
) => new Response(body ? new Uint8Array(body).buffer : null, init);

const createMockZip = (name: string): Uint8Array => {
  const nameBytes = new TextEncoder().encode(name);
  const header = new Uint8Array(30 + nameBytes.length + 4);
  const view = new DataView(header.buffer);

  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(8, 0, true);
  view.setUint32(18, 4, true);
  view.setUint32(22, 4, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true);
  header.set(nameBytes, 30);
  header.set(new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]), 30 + nameBytes.length);

  return header;
};

describe('fetchMediaChunk filename fallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses Content-Disposition from the ranged GET when HEAD has none', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        makeResponse(null, {
          status: 200,
          headers: {
            'content-type': 'video/mp4',
            'content-length': '4',
          },
        }),
      )
      .mockResolvedValueOnce(
        makeResponse(new Uint8Array([0, 1, 2, 3]), {
          status: 206,
          headers: {
            'content-type': 'video/mp4',
            'content-disposition': 'attachment; filename="from-get.mp4"',
            'content-range': 'bytes 0-3/4',
          },
        }),
      );

    const result = await fetchMediaChunk('https://example.com/token');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.filename).toBe('from-get.mp4');
    expect(result.filenameSource).toBe('content-disposition-get');
    expect(result.diagnostics.resolvedFilename).toBe('from-get.mp4');
    expect(result.diagnostics.resolvedFilenameSource).toBe(
      'content-disposition-get',
    );
  });

  it('keeps the HEAD filename when both HEAD and GET expose Content-Disposition', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        makeResponse(null, {
          status: 200,
          headers: {
            'content-type': 'video/mp4',
            'content-length': '4',
            'content-disposition': 'attachment; filename="from-head.mp4"',
          },
        }),
      )
      .mockResolvedValueOnce(
        makeResponse(new Uint8Array([0, 1, 2, 3]), {
          status: 206,
          headers: {
            'content-type': 'video/mp4',
            'content-disposition': 'attachment; filename="from-get.mp4"',
            'content-range': 'bytes 0-3/4',
          },
        }),
      );

    const result = await fetchMediaChunk('https://example.com/token');

    expect(result.filename).toBe('from-head.mp4');
    expect(result.filenameSource).toBe('content-disposition-head');
    expect(result.diagnostics.resolvedFilenameSource).toBe(
      'content-disposition-head',
    );
  });

  it('falls back to the URL token when neither HEAD nor GET expose a filename', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        makeResponse(null, {
          status: 200,
          headers: {
            'content-type': 'video/mp4',
            'content-length': '4',
          },
        }),
      )
      .mockResolvedValueOnce(
        makeResponse(new Uint8Array([0, 1, 2, 3]), {
          status: 206,
          headers: {
            'content-type': 'video/mp4',
            'content-range': 'bytes 0-3/4',
          },
        }),
      );

    const result = await fetchMediaChunk('https://example.com/url-token');

    expect(result.filename).toBe('url-token');
    expect(result.filenameSource).toBe('url');
    expect(result.diagnostics.resolvedFilenameSource).toBe('url');
  });
});

describe('analyzeMediaBuffer filename fallback', () => {
  it('uses General.Title when the incoming filename only came from the URL', async () => {
    mockAnalyzeDataResult = {
      media: {
        track: [
          {
            '@type': 'General',
            Title: 'placeholder-title-token',
          },
        ],
      },
    };

    const result = await analyzeMediaBuffer(
      new Uint8Array([0, 1, 2, 3]),
      4,
      'url-token',
      'url',
      ['json'],
    );
    const json = JSON.parse(result.results.json) as MediaInfoResult;
    const generalTrack = json.media?.track?.find((t) => t['@type'] === 'General');

    expect(result.resolvedFilename).toBe('placeholder-title-token');
    expect(result.resolvedFilenameSource).toBe('mediainfo-title');
    expect(generalTrack?.CompleteName).toBe('placeholder-title-token');
    expect(generalTrack?.Archive_Name).toBeUndefined();
  });

  it('falls back to General.Movie when Title is not usable', async () => {
    mockAnalyzeDataResult = {
      media: {
        track: [
          {
            '@type': 'General',
            Title: '   ',
            Movie: 'placeholder-movie-token',
          },
        ],
      },
    };

    const result = await analyzeMediaBuffer(
      new Uint8Array([0, 1, 2, 3]),
      4,
      'url-token',
      'url',
      ['json'],
    );

    expect(result.resolvedFilename).toBe('placeholder-movie-token');
    expect(result.resolvedFilenameSource).toBe('mediainfo-movie');
  });

  it('does not let Title override a header-derived filename', async () => {
    mockAnalyzeDataResult = {
      media: {
        track: [
          {
            '@type': 'General',
            Title: 'Should.Not.Win',
          },
        ],
      },
    };

    const result = await analyzeMediaBuffer(
      new Uint8Array([0, 1, 2, 3]),
      4,
      'from-head.mp4',
      'content-disposition-head',
      ['json'],
    );
    const json = JSON.parse(result.results.json) as MediaInfoResult;
    const generalTrack = json.media?.track?.find((t) => t['@type'] === 'General');

    expect(result.resolvedFilename).toBe('from-head.mp4');
    expect(result.resolvedFilenameSource).toBe('content-disposition-head');
    expect(generalTrack?.CompleteName).toBe('from-head.mp4');
  });

  it('keeps archive inner filenames ahead of MediaInfo metadata and sets Archive_Name', async () => {
    mockAnalyzeDataResult = {
      media: {
        track: [
          {
            '@type': 'General',
            Title: 'Wrong.Title',
          },
        ],
      },
    };

    const result = await analyzeMediaBuffer(
      createMockZip('inner-video.mkv'),
      64,
      'outer.zip',
      'content-disposition-get',
      ['json'],
    );
    const json = JSON.parse(result.results.json) as MediaInfoResult;
    const generalTrack = json.media?.track?.find((t) => t['@type'] === 'General');

    expect(result.resolvedFilename).toBe('inner-video.mkv');
    expect(result.resolvedFilenameSource).toBe('archive-inner');
    expect(generalTrack?.CompleteName).toBe('inner-video.mkv');
    expect(generalTrack?.Archive_Name).toBe('outer.zip');
  });
});
