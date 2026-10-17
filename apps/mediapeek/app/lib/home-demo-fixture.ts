export interface DemoHighlight {
  label: string;
  value: string;
}

export interface HomeDemoFixture {
  sourceUrl: string;
  inspectedAt: string;
  highlights: DemoHighlight[];
  results: {
    object: Record<string, unknown>;
    json: string;
    text: string;
  };
}

const sampleObjectResult = {
  media: {
    track: [
      {
        '@type': 'General',
        CompleteName: 'Demo-Showcase-Clip.mkv',
        Archive_Name: 'MediaPeek-Demo-Pack.zip',
        Format: 'Matroska',
        Duration_String3: '2 min 14 s',
        FileSize_String4: '186 MiB',
        OverallBitRate_String: '11.7 Mb/s',
      },
      {
        '@type': 'Video',
        Format: 'HEVC',
        Format_Profile: 'Main 10@L5@Main',
        HDR_Format: 'Dolby Vision, HDR10',
        Width: '3840',
        Height: '2160',
        FrameRate_String: '23.976 FPS',
        BitRate_String: '9 500 kb/s',
      },
      {
        '@type': 'Audio',
        Format: 'E-AC-3 JOC',
        CommercialName: 'Dolby Digital Plus with Dolby Atmos',
        ChannelLayout: 'L R C LFE Ls Rs',
        SamplingRate_String: '48.0 kHz',
        BitRate_String: '768 kb/s',
        Language: 'English',
      },
      {
        '@type': 'Text',
        Format: 'UTF-8',
        Language: 'English',
        Title: 'CC',
      },
    ],
  },
  creatingLibrary: {
    name: 'MediaInfoLib',
    version: '24.12',
    url: 'https://mediaarea.net/MediaInfo',
  },
};

const sampleTextResult = [
  'General',
  'Complete name                            : MediaPeek-Demo-Pack.zip / Demo-Showcase-Clip.mkv',
  'Format                                   : Matroska',
  'Duration                                 : 2 min 14 s',
  'Overall bit rate                         : 11.7 Mb/s',
  '',
  'Video',
  'Format                                   : HEVC',
  'HDR format                               : Dolby Vision, HDR10',
  'Width                                    : 3 840 pixels',
  'Height                                   : 2 160 pixels',
  'Frame rate                               : 23.976 FPS',
  '',
  'Audio',
  'Commercial name                          : Dolby Digital Plus with Dolby Atmos',
  'Channels                                 : 6 channels',
  'Sampling rate                            : 48.0 kHz',
].join('\n');

export const homeDemoFixture: HomeDemoFixture = {
  sourceUrl:
    'https://cdn.example.com/public/media/MediaPeek-Demo-Pack.zip#Demo-Showcase-Clip.mkv',
  inspectedAt: '2026-02-15T13:30:00Z',
  highlights: [
    { label: 'Container', value: 'Matroska' },
    { label: 'Resolution', value: '3840 x 2160 (4K)' },
    { label: 'HDR', value: 'Dolby Vision + HDR10' },
    { label: 'Audio', value: 'Dolby Atmos (E-AC-3 JOC)' },
    { label: 'Duration', value: '2 min 14 s' },
  ],
  results: {
    object: sampleObjectResult,
    json: JSON.stringify(sampleObjectResult, null, 2),
    text: sampleTextResult,
  },
};
