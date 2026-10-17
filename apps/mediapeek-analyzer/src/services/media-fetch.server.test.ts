import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchMediaChunk } from './media-fetch.server';

const makeResponse = (
  body: Uint8Array | null,
  init: { status: number; headers?: Record<string, string> },
) => new Response(body ? new Uint8Array(body).buffer : null, init);

const createMockZipWithDirectory = (): Uint8Array => {
  const dirName = new TextEncoder().encode('Folder/');
  const dirHeader = new Uint8Array(30 + dirName.length);
  const dirView = new DataView(dirHeader.buffer);
  dirView.setUint32(0, 0x04034b50, true);
  dirView.setUint16(4, 20, true);
  dirView.setUint16(8, 0, true);
  dirView.setUint32(18, 0, true);
  dirView.setUint32(22, 0, true);
  dirView.setUint16(26, dirName.length, true);
  dirView.setUint16(28, 0, true);
  dirHeader.set(dirName, 30);

  const fileName = new TextEncoder().encode('Folder/inner-video.mkv');
  const fileHeader = new Uint8Array(30 + fileName.length + 4);
  const fileView = new DataView(fileHeader.buffer);
  fileView.setUint32(0, 0x04034b50, true);
  fileView.setUint16(4, 20, true);
  fileView.setUint16(8, 0, true);
  fileView.setUint32(18, 4, true);
  fileView.setUint32(22, 4, true);
  fileView.setUint16(26, fileName.length, true);
  fileView.setUint16(28, 0, true);
  fileHeader.set(fileName, 30);
  fileHeader.set(
    new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]),
    30 + fileName.length,
  );

  const buffer = new Uint8Array(dirHeader.length + fileHeader.length);
  buffer.set(dirHeader, 0);
  buffer.set(fileHeader, dirHeader.length);
  return buffer;
};

describe('fetchMediaChunk', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses Content-Range from the ranged GET when HEAD hides the real file size', async () => {
    const proxiedFilename = 'proxy-media-sample.mkv';
    const proxiedUrl = 'https://proxy.example.test/r/opaque-token';

    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        makeResponse(null, {
          status: 200,
          headers: {
            'content-type': 'text/plain;charset=UTF-8',
          },
        }),
      )
      .mockResolvedValueOnce(
        makeResponse(new Uint8Array([0, 1, 2, 3]), {
          status: 206,
          headers: {
            'content-type': 'application/octet-stream',
            'content-range': 'bytes 0-3/4373212360',
            'content-disposition': `attachment; filename="${proxiedFilename}"`,
          },
        }),
      );

    const result = await fetchMediaChunk(proxiedUrl);

    expect(result.fileSize).toBe(4_373_212_360);
    expect(result.filename).toBe(proxiedFilename);
    expect(result.filenameSource).toBe('content-disposition-get');
  });

  it('does not reject a direct media URL just because the HEAD probe returns HTML', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        makeResponse(null, {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=UTF-8',
          },
        }),
      )
      .mockResolvedValueOnce(
        makeResponse(new Uint8Array([0, 1, 2, 3]), {
          status: 206,
          headers: {
            'content-type': 'application/octet-stream',
            'content-range': 'bytes 0-3/4',
            'content-disposition': 'attachment; filename="from-get.mp4"',
          },
        }),
      );

    const result = await fetchMediaChunk('https://example.com/tokenized-media');

    expect(result.fileSize).toBe(4);
    expect(result.filename).toBe('from-get.mp4');
    expect(result.filenameSource).toBe('content-disposition-get');
  });

  it('uses verified inner archive size for stored zip entries', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        makeResponse(null, {
          status: 200,
          headers: {
            'content-type': 'application/octet-stream',
            'content-length': '999',
            'content-disposition': 'attachment; filename="outer.zip"',
          },
        }),
      )
      .mockResolvedValueOnce(
        makeResponse(createMockZipWithDirectory(), {
          status: 206,
          headers: {
            'content-type': 'application/octet-stream',
            'content-range': 'bytes 0-255/999',
          },
        }),
      );

    const result = await fetchMediaChunk('https://example.com/archive');

    expect(result.fileSize).toBe(4);
    expect(Array.from(result.buffer)).toEqual([0xaa, 0xbb, 0xcc, 0xdd]);
    expect(result.archiveEntry).toMatchObject({
      name: 'Folder/inner-video.mkv',
      sizeStatus: 'verified',
      sizeSource: 'zip-local-header',
    });
  });

  it('fetches additional byte ranges when reads seek past the initial prefix', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    fetchSpy
      .mockResolvedValueOnce(
        makeResponse(null, {
          status: 200,
          headers: {
            'content-type': 'application/octet-stream',
            'content-length': '30',
            'accept-ranges': 'bytes',
            'content-disposition': 'attachment; filename="sample.m4a"',
          },
        }),
      )
      .mockResolvedValueOnce(
        makeResponse(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), {
          status: 206,
          headers: {
            'content-type': 'application/octet-stream',
            'content-range': 'bytes 0-9/30',
          },
        }),
      )
      .mockResolvedValueOnce(
        makeResponse(
          new Uint8Array([
            10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26,
            27, 28, 29,
          ]),
          {
            status: 206,
            headers: {
              'content-type': 'application/octet-stream',
              'content-range': 'bytes 10-29/30',
            },
          },
        ),
      );

    const result = await fetchMediaChunk('https://example.com/audio');

    expect(result.byteSource).toBeDefined();
    await expect(result.byteSource?.readChunk(4, 2)).resolves.toEqual(
      new Uint8Array([2, 3, 4, 5]),
    );
    await expect(result.byteSource?.readChunk(4, 20)).resolves.toEqual(
      new Uint8Array([20, 21, 22, 23]),
    );
    await expect(result.byteSource?.readChunk(4, 24)).resolves.toEqual(
      new Uint8Array([24, 25, 26, 27]),
    );

    expect(fetchSpy).toHaveBeenCalledTimes(3);
    expect(result.diagnostics.seekFetchCount).toBe(1);
    expect(result.diagnostics.seekBytesFetched).toBe(20);
  });

  it('does not expose a remote seek reader when the origin ignores the range request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    fetchSpy
      .mockResolvedValueOnce(
        makeResponse(null, {
          status: 200,
          headers: {
            'content-type': 'application/octet-stream',
            'content-length': '30',
            'content-disposition': 'attachment; filename="sample.mkv"',
          },
        }),
      )
      .mockResolvedValueOnce(
        makeResponse(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), {
          status: 200,
          headers: {
            'content-type': 'application/octet-stream',
            'content-length': '30',
          },
        }),
      );

    const result = await fetchMediaChunk('https://example.com/non-range');

    expect(result.byteSource).toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
