import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMediaActions } from './use-media-actions';

const fetchAnalyzeFormatMock = vi.fn();
const safeClipboardWriteMock = vi.fn();
const uploadToPrivateBinMock = vi.fn();

vi.mock('../lib/analyze-client', () => ({
  fetchAnalyzeFormat: (...args: unknown[]) => fetchAnalyzeFormatMock(...args),
}));

vi.mock('../lib/clipboard', () => ({
  safeClipboardWrite: (...args: unknown[]) => safeClipboardWriteMock(...args),
}));

vi.mock('../lib/privatebin', () => ({
  uploadToPrivateBin: (...args: unknown[]) => uploadToPrivateBinMock(...args),
}));

vi.mock('./use-haptic', () => ({
  useHapticFeedback: () => ({
    triggerSuccess: vi.fn(),
    triggerError: vi.fn(),
    triggerCreativeSuccess: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    loading: vi.fn(() => 'toast-id'),
    dismiss: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('useMediaActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    safeClipboardWriteMock.mockImplementation(async (textPromise, onSuccess) => {
      await textPromise;
      onSuccess?.();
    });
  });

  it('caches generated copy payload by format', async () => {
    fetchAnalyzeFormatMock.mockResolvedValue({ ok: true, content: 'text-output' });

    const { result } = renderHook(() =>
      useMediaActions({
        data: {},
        url: 'https://example.com/video.mp4',
        requestTurnstileToken: vi.fn(),
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
    fetchAnalyzeFormatMock.mockResolvedValue({ ok: true, content: '<xml />' });
    uploadToPrivateBinMock.mockResolvedValue({
      url: 'https://privatebin.net/?abc#key',
      deleteUrl: 'https://privatebin.net/?pasteid=abc&deletetoken=def',
    });

    const { result } = renderHook(() =>
      useMediaActions({
        data: {},
        url: 'https://example.com/video.mp4',
        requestTurnstileToken: vi.fn(),
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
