import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MediaHeader } from './media-header';
import { VideoTrackItem } from './video-track-item';

vi.mock('./options-menu', () => ({
  OptionsMenu: () => <div />,
}));

vi.mock('./media-icon', () => ({
  MediaIcon: () => <div />,
}));

describe('archive warning UI', () => {
  it('shows the archive estimate tooltip in the header when file size is estimated', () => {
    render(
      <MediaHeader
        generalTrack={{
          '@type': 'General',
          CompleteName: 'inner-video.mkv',
          FileSize_String: '999 MiB',
          Duration_String: '47 min',
          Archive_Name: 'outer.zip',
          Archive_Sizing_Warning:
            'Archive-backed analysis could not verify the inner file size. File size and bitrate may be inaccurate.',
        }}
        videoTracks={[]}
        audioTracks={[]}
        textTracks={[]}
        isTextView={false}
        setIsTextView={() => {}}
        showOriginalTitles={false}
        setShowOriginalTitles={() => {}}
        rawData={{}}
        url="https://example.com/archive"
      />,
    );

    expect(screen.getByLabelText(/may be inaccurate/i)).toBeTruthy();
  });

  it('shows the archive estimate tooltip in the video bitrate row', () => {
    render(
      <VideoTrackItem
        video={{
          '@type': 'Video',
          Format: 'AVC',
          Width: 1920,
          Height: 800,
          BitRate_String: '9 589 kb/s',
        }}
        archiveSizingWarning="Archive-backed analysis could not verify the inner file size. File size and bitrate may be inaccurate."
      />,
    );

    expect(screen.getByLabelText(/may be inaccurate/i)).toBeTruthy();
  });
});
