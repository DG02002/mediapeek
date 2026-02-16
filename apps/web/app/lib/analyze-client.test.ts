import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchAnalyzeFormat } from './analyze-client';

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('fetchAnalyzeFormat', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns format content on first successful request', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse({ success: true, results: { text: 'hello' } }),
      );

    const result = await fetchAnalyzeFormat({
      url: 'https://example.com/video.mp4',
      format: 'text',
    });

    expect(result).toEqual({
      ok: true,
      content: 'hello',
      requestId: undefined,
      retriedWithTurnstile: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once with a turnstile token when first request is auth blocked', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        jsonResponse(
          {
            success: false,
            error: {
              code: 'AUTH_REQUIRED',
              message: 'Security verification is required.',
            },
          },
          403,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({ success: true, results: { xml: '<xml />' } }),
      );

    const requestTurnstileToken = vi.fn().mockResolvedValue('token-123');
    const result = await fetchAnalyzeFormat({
      url: 'https://example.com/video.mp4',
      format: 'xml',
      requestTurnstileToken,
    });

    expect(result).toEqual({
      ok: true,
      content: '<xml />',
      requestId: undefined,
      retriedWithTurnstile: true,
    });
    expect(requestTurnstileToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({
      headers: expect.objectContaining({
        'CF-Turnstile-Response': 'token-123',
      }),
    });
  });

  it('returns a cancellation error when re-challenge is cancelled', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(
        {
          success: false,
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Security verification is required.',
          },
        },
        403,
      ),
    );

    const requestTurnstileToken = vi.fn().mockResolvedValue(null);
    const result = await fetchAnalyzeFormat({
      url: 'https://example.com/video.mp4',
      format: 'text',
      requestTurnstileToken,
    });

    expect(result).toEqual({
      ok: false,
      message: 'Verification was cancelled.',
      status: 403,
      code: 'AUTH_REQUIRED',
      retriedWithTurnstile: true,
    });
    expect(requestTurnstileToken).toHaveBeenCalledTimes(1);
  });

  it('does not trigger challenge flow for non-auth server errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Analyzer unavailable',
          },
        },
        503,
      ),
    );

    const requestTurnstileToken = vi.fn().mockResolvedValue('unused');
    const result = await fetchAnalyzeFormat({
      url: 'https://example.com/video.mp4',
      format: 'html',
      requestTurnstileToken,
    });

    expect(result).toEqual({
      ok: false,
      message: 'Analyzer unavailable',
      status: 503,
      code: 'INTERNAL_ERROR',
      retriedWithTurnstile: false,
    });
    expect(requestTurnstileToken).not.toHaveBeenCalled();
  });
});
