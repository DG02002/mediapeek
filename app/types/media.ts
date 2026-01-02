export interface MediaTrackJSON {
  '@type': string;
  // Common
  Title?: string;
  Language?: string;
  Default?: string;
  Forced?: string;
  Format?: string;
  Format_Info?: string;
  ID?: string;

  // General
  CompleteName?: string;
  File_Name?: string;
  FileSize?: string;
  Duration?: string;
  OverallBitRate?: string;

  // Video
  Width?: string;
  Height?: string;
  FrameRate?: string;
  BitRate?: string;
  BitRate_Measured?: string;
  BitRate_Maximum?: string;
  BitRate_Nominal?: string;
  HDR_Format?: string;
  HDR_Format_Profile?: string;
  HDR_Format_Compatibility?: string;
  Format_Profile?: string;
  Format_Level?: string;
  Format_Tier?: string;
  FrameRate_Mode?: string;
  ChromaSubsampling?: string;
  BitDepth?: string;
  colour_primaries?: string;
  transfer_characteristics?: string;
  matrix_coefficients?: string;
  MasteringDisplay_ColorPrimaries?: string;
  MasteringDisplay_Luminance?: string;

  // Audio
  Channels?: string;
  'Channel(s)'?: string;
  Format_Commercial_IfAny?: string;
  BitRate_Mode?: string;
  Delay?: string;
  ServiceKind?: string;
  Compression_Mode?: string;

  // General
  Encoded_Application?: string;

  // Dictionary for Subtitles CodecID
  CodecID?: string;

  // Menu (Chapters)
  extra?: Record<string, string>;
}

export interface MediaInfoJSON {
  media?: {
    track: MediaTrackJSON[];
  };
}
