import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMediaActions } from './use-media-actions';

type FetchAnalyzeFormat = typeof import('../lib/analyze-client').fetchAnalyzeFormat;
type SafeClipboardWrite = typeof import('../lib/clipboard').safeClipboardWrite;
type UploadToPrivateBin = typeof import('../lib/privatebin').uploadToPrivateBin;

const {
  fetchAnalyzeFormatMock,
  safeClipboardWriteMock,
  uploadToPrivateBinMock,
  triggerSuccessMock,
  triggerErrorMock,
  triggerCreativeSuccessMock,
  toastLoadingMock,
  toastDismissMock,
  toastErrorMock,
  toastSuccessMock,
} = vi.hoisted(() => ({
  fetchAnalyzeFormatMock: vi.fn<FetchAnalyzeFormat>(),
  safeClipboardWriteMock: vi.fn<SafeClipboardWrite>(),
  uploadToPrivateBinMock: vi.fn<UploadToPrivateBin>(),
  triggerSuccessMock: vi.fn<() => void>(),
  triggerErrorMock: vi.fn<() => void>(),
  triggerCreativeSuccessMock: vi.fn<() => void>(),
  toastLoadingMock: vi.fn<(message: string) => string>(() => 'toast-id'),
  toastDismissMock: vi.fn<(id?: string | number) => void>(),
  toastErrorMock: vi.fn<
    (message: string, options?: Record<string, unknown>) => void
  >(),
  toastSuccessMock: vi.fn<
    (message: string, options?: Record<string, unknown>) => void
  >(),
}));

vi.mock('../lib/analyze-client', () => ({
  fetchAnalyzeFormat: fetchAnalyzeFormatMock,
}));

vi.mock('../lib/clipboard', () => ({
  safeClipboardWrite: safeClipboardWriteMock,
}));

vi.mock('../lib/privatebin', () => ({
  uploadToPrivateBin: uploadToPrivateBinMock,
}));

vi.mock('./use-haptic', () => ({
  useHapticFeedback: () => ({
    triggerSuccess: triggerSuccessMock,
    triggerError: triggerErrorMock,
    triggerCreativeSuccess: triggerCreativeSuccessMock,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    loading: toastLoadingMock,
    dismiss: toastDismissMock,
    error: toastErrorMock,
    success: toastSuccessMock,
  },
}));

describe('useMediaActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    safeClipboardWriteMock.mockImplementation(
      async (textPromise, onSuccess) => {
        await textPromise;
        onSuccess?.();
      },
    );
  });

  it('caches generated copy payload by format', async () => {
    fetchAnalyzeFormatMock.mockResolvedValue({
      ok: true,
      content: 'text-output',
      retriedWithTurnstile: false,
    });

    const { result } = renderHook(() =>
      useMediaActions({
        data: {},
        url: 'https://example.com/video.mp4',
        requestTurnstileToken: vi.fn<() => Promise<string | null>>(),
      }),
    );

    await act(async () => {
      result.current.handleCopy('text', 'Text');
    });
    await waitFor(() => {
      expect(fetchAnalyzeFormatMock).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      result.current.handleCopy('text', 'Text');
    });

    await waitFor(() => {
      expect(fetchAnalyzeFormatMock).toHaveBeenCalledTimes(1);
      expect(safeClipboardWriteMock).toHaveBeenCalledTimes(2);
    });
  });

  it('caches share urls by format after first upload', async () => {
    fetchAnalyzeFormatMock.mockResolvedValue({
      ok: true,
      content: '<xml />',
      retriedWithTurnstile: false,
    });
    uploadToPrivateBinMock.mockResolvedValue({
      url: 'https://privatebin.net/?abc#key',
      deleteUrl: 'https://privatebin.net/?pasteid=abc&deletetoken=def',
    });

    const { result } = renderHook(() =>
      useMediaActions({
        data: {},
        url: 'https://example.com/video.mp4',
        requestTurnstileToken: vi.fn<() => Promise<string | null>>(),
      }),
    );

    let firstUrl = '';
    await act(async () => {
      firstUrl = (await result.current.getShareUrl('xml', 'XML')) ?? '';
    });

    let secondUrl = '';
    await act(async () => {
      secondUrl = (await result.current.getShareUrl('xml', 'XML')) ?? '';
    });

    expect(firstUrl).toBe('https://privatebin.net/?abc#key');
    expect(secondUrl).toBe('https://privatebin.net/?abc#key');
    expect(fetchAnalyzeFormatMock).toHaveBeenCalledTimes(1);
    expect(uploadToPrivateBinMock).toHaveBeenCalledTimes(1);
  });
});
