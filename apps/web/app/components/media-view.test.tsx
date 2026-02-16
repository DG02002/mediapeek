import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MediaView } from './media-view';

const fetchAnalyzeFormatMock = vi.fn();

vi.mock('~/lib/analyze-client', () => ({
  fetchAnalyzeFormat: (...args: unknown[]) => fetchAnalyzeFormatMock(...args),
}));

vi.mock('./media-view/general-section', () => ({
  GeneralSection: () => <div />,
}));
vi.mock('./media-view/video-section', () => ({
  VideoSection: () => <div />,
}));
vi.mock('./media-view/audio-section', () => ({
  AudioSection: () => <div />,
}));
vi.mock('./media-view/subtitle-section', () => ({
  SubtitleSection: () => <div />,
}));
vi.mock('./media-view/chapter-section', () => ({
  ChapterSection: () => <div />,
}));
vi.mock('./media-view/accessibility-section', () => ({
  AccessibilitySection: () => <div />,
}));
vi.mock('./media-view/library-section', () => ({
  LibrarySection: () => <div />,
}));

vi.mock('./media-view/media-header', () => ({
  MediaHeader: ({
    setIsTextView,
  }: {
    setIsTextView: (value: boolean) => void;
  }) => (
    <button
      type="button"
      data-testid="toggle-text-view"
      onClick={() => {
        setIsTextView(true);
      }}
    >
      Toggle text view
    </button>
  ),
}));

describe('MediaView', () => {
  it('loads text output once when toggled into text view', async () => {
    fetchAnalyzeFormatMock.mockResolvedValue({
      ok: true,
      content: 'General\nComplete name : file.mp4',
    });
    const requestTurnstileToken = vi.fn().mockResolvedValue('token-123');

    render(
      <MediaView
        data={{
          json: JSON.stringify({
            media: {
              track: [{ '@type': 'General', CompleteName: 'file.mp4' }],
            },
          }),
        }}
        url="https://example.com/file.mp4"
        requestTurnstileToken={requestTurnstileToken}
      />,
    );

    fireEvent.click(screen.getByTestId('toggle-text-view'));

    await waitFor(() => {
      expect(fetchAnalyzeFormatMock).toHaveBeenCalledTimes(1);
      expect(fetchAnalyzeFormatMock).toHaveBeenCalledWith({
        url: 'https://example.com/file.mp4',
        format: 'text',
        requestTurnstileToken,
      });
    });
    await waitFor(() => {
      expect(screen.getByText(/Complete name : file\.mp4/i)).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('toggle-text-view'));
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(fetchAnalyzeFormatMock).toHaveBeenCalledTimes(1);
  });
});
