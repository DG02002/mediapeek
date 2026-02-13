export interface MediaTrackJSON {
  '@type': string;
  // Common fields (Video, Audio, Text, Menu, General)
  ID?: string;
  Format?: string;
  Format_Commercial_IfAny?: string;
  Format_Version?: string;
  Format_Profile?: string;
  Format_Level?: string;
  Format_Tier?: string;
  Format_Settings_Cabac?: string;
  Format_Settings_RefFrames?: string;
  CodecID?: string;
  Duration?: string;
  BitRate?: string;
  Width?: string;
  Height?: string;
  Stored_Width?: string;
  Stored_Height?: string;
  Sampled_Width?: string;
  Sampled_Height?: string;
  PixelAspectRatio?: string;
  DisplayAspectRatio?: string;
  FrameRate_Mode?: string;
  FrameRate?: string;
  ColorSpace?: string;
  ChromaSubsampling?: string;
  BitDepth?: string | number;
  ScanType?: string;
  Compression_Mode?: string;
  HDR_Format?: string;
  HDR_Format_Compatibility?: string;
  Title?: string;
  Encoded_Library?: string;
  Encoded_Library_Name?: string;
  Encoded_Library_Version?: string;
  Language?: string;
  Default?: string;
  Forced?: string;
  // Audio specific
  SamplingRate?: string | number;
  Channels?: string;
  ChannelPositions?: string;
  ChannelLayout?: string;
  SamplesPerFrame?: string;
  ServiceKind?: string;
  Format_AdditionalFeatures?: string; // e.g. "XLL X"
  // Text specific
  MuxingMode?: string;
  // General specific
  CompleteName?: string;
  File_Name?: string;
  File_Extension?: string;
  FileSize?: string;
  OverallBitRate_Mode?: string;
  OverallBitRate?: string;
  Encoded_Application?: string;
  Encoded_date?: string;
  // Menu/Chapters
  extra?: Record<string, string>;
  // Catch-all
  [key: string]: unknown;
}

export const MEDIA_CONSTANTS = {
  BADGES: {
    RESOLUTION_4K: '4k',
    RESOLUTION_HD: 'hd',
    RESOLUTION_SD: 'sd',
    IMAX: 'imax',
    HDR10_PLUS: 'hdr10-plus',
    HDR: 'hdr',
    DOLBY_VISION: 'dolby-vision',
    AV1: 'av1',
    DOLBY_ATMOS: 'dolby-atmos',
    DOLBY_AUDIO: 'dolby-audio',
    DTS_X: 'dts-x',
    DTS: 'dts',
    HI_RES_LOSSLESS: 'hi-res-lossless',
    LOSSLESS: 'lossless',
    CC: 'cc',
    SDH: 'sdh',
    AD: 'ad',
  },
  TOKENS: {
    IMAX: 'IMAX',
    HDR10_PLUS: 'HDR10+',
    ATMOS: 'atmos',
    XLL: 'XLL',
    DTS: 'dts',
    DOLBY: 'dolby',
    AC3: 'ac-3',
    EAC3: 'e-ac-3',
  },
} as const;
