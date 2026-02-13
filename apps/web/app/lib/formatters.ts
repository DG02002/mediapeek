import { getString } from '~/lib/type-guards';

const COMMON_AUDIO_TERMS_TO_REMOVE = [
  'Lossless',
  '16-bit',
  '24-bit',
  '32-bit',
  'VBR',
  'CBR',
  'Original Mix',
  'DI', // Digital Intermediate
  'BD', // Blu-Ray Disc
];

const COMMON_SUBTITLE_TERMS_TO_REMOVE = [
  'ASS',
  'SSA',
  'PGS',
  'SRT',
  'SUBRIP',
  'VOBSUB',
  'DVD-SUB',
  'DVB-SUB',
  'HDMV PGS',
  'Sub',
  'Subs',
  'Subtitle',
  'Subtitles',
];

// Fields in the media track object to check for exact redundant matches
const METADATA_FIELDS_TO_CHECK = [
  'Format',
  'Format_Info',
  'Format_Commercial',
  'Format_Commercial_IfAny',
  'Format_String',
  'Format_AdditionalFeatures',
  'BitRate_String',
  'SamplingRate_String',
  'Channels_String',
  'ChannelPositions_String2',
  'Channel(s)_String',
  'Channels',
  'CodecID',
  'CodecID_Info',
];

// Rules for removing specific keywords based on Format/Codec presence
interface FormatRule {
  check: (format: string, commercial: string, codec: string) => boolean;
  remove: string[];
}

const AUDIO_FORMAT_RULES: FormatRule[] = [
  {
    // E-AC-3 / DDP
    check: (f, c, _) =>
      f.includes('E-AC-3') || f.includes('EC-3') || c.includes('DIGITAL PLUS'),
    remove: ['DDP', 'Dolby Digital Plus', 'E-AC-3', 'DD+', 'DD Plus'],
  },
  {
    // TrueHD / Atmos
    check: (f, c, _) =>
      f.includes('MLP FBA') || f.includes('TRUEHD') || c.includes('TRUEHD'),
    remove: ['TrueHD', 'Dolby TrueHD', 'Atmos', 'Dolby Atmos'],
  },
  {
    // DTS-HD MA / HRA / DTS:X
    check: (f, _, codec) => f.includes('DTS') || codec.includes('DTS'),
    remove: [
      'DTS-HD MA',
      'DTS-HD Master Audio',
      'DTS-HD',
      'DTS:X',
      'DTS',
      'Master Audio',
      'MA',
      'HRA',
      'ES',
    ],
  },
  {
    // AC-3
    check: (f, _, codec) => f === 'AC-3' || codec === 'AC-3',
    remove: ['AC-3', 'DD', 'Dolby Digital'],
  },
  {
    // AAC
    check: (f) => f.includes('AAC'),
    remove: ['AAC', 'HE-AAC', 'LC-AAC'],
  },
  {
    // FLAC
    check: (f) => f.includes('FLAC'),
    remove: ['FLAC'],
  },
];

export const cleanMetadataString = (
  s: string | undefined | null,
): string | undefined => {
  if (!s) return undefined;
  const trimmed = s.trim();
  return trimmed === '' ? undefined : trimmed;
};

export const cleanBitrateString = (s: string | undefined): string => {
  if (!s) return '';
  // Replace space between digits: "5 844" -> "5844"
  return s.replace(/(\d)\s+(?=\d)/g, '$1');
};

/**
 * Removes a list of keywords from a string.
 * Handles escaping and regex boundary safety.
 */
const removeKeywords = (text: string, keywords: string[]): string => {
  if (!keywords.length) return text;

  let processed = text;

  // Sort by length longest first to avoid partial replacements
  const sorted = [...keywords].sort((a, b) => b.length - a.length);

  for (const word of sorted) {
    if (!word || word.length < 2) continue;

    // Exact word boundary match with escaping
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    processed = processed.replace(regex, '');
  }

  return processed;
};

/**
 * Recursively removes empty brackets/parentheses and artifacts like "[ - ]".
 */
const cleanWrappers = (text: string): string => {
  let current = text;
  let prev = '';

  while (prev !== current) {
    prev = current;
    current = current
      .replace(/\[\s*\]/g, '')
      .replace(/\(\s*\)/g, '')
      .replace(/\{\s*\}/g, '')
      .replace(/\[\s*[-|]\s*\]/g, '')
      .replace(/\(\s*[-|]\s*\)/g, '')
      .trim();
  }

  return current;
};

/**
 * Cleans audio-specific technical specifications regexes.
 */
const cleanAudioTechSpecs = (
  text: string,
  keywordsRemoved: string[],
): string => {
  let processed = text;

  // 1. Remove "Surround / Stereo"
  processed = processed.replace(/\b(Surround\s+\d+(\.\d+)?|Stereo)\b/gi, '');

  // 2. DTS Residue (DTS:HD -> :HD)
  // Check if we removed DTS to be safe, or just always clean specific patterns
  if (keywordsRemoved.includes('DTS')) {
    processed = processed.replace(/\bDTS:HD\b/gi, '');
    processed = processed.replace(/:HD\b/gi, '');
  }

  // 3. Bitrate: "@ 4337 Kbps", "4337 kbps"
  // Handles optional "@" prefix standard in some metadata
  processed = processed.replace(
    /(@\s*)?\b\d+(\.\d+)?\s*(kb\/s|kbps|mb\/s|mbps)\b/gi,
    '',
  );
  // Cleanup orphan "@"
  processed = processed.replace(/\s+@\s+/g, ' ');
  processed = processed.replace(/\s+@$/g, '');

  // 4. Channels: "5.1ch", "6-channel", "5.1" (isolated)
  processed = processed.replace(
    /\b\d+(\.\d+)?\s*(-)?\s*(ch|channel|channels|track|mix)\b/gi,
    '',
  );
  // Remove standalone generic channel numbers like "5.1"
  processed = processed.replace(/\b\d+\.\d+\b/g, '');

  // 5. Sample Rate: "48kHz"
  processed = processed.replace(/\b\d+(\.\d+)?\s*kHz\b/gi, '');

  return processed;
};

/**
 * Final cleanup: Trimming, connector words, punctuation.
 */
const polishTitle = (text: string): string => {
  let processed = text;

  // Connectors
  processed = processed
    .replace(/\bwith\b/gi, '')
    .replace(/\bat\b/gi, '')
    .replace(/\s+-\s+/g, ' ');

  // Whitespace collapse
  processed = processed.replace(/\s+/g, ' ').trim();

  // Punctuation from ends
  // Only remove separators (, - . ; :) from the end. Keep closing parens/brackets!
  processed = processed.replace(/^[\s,.\-.;:@]+/, '');
  processed = processed.replace(/[\s,.\-.;:@]+$/, '');

  return processed;
};

export const cleanTrackTitle = (
  title: string | undefined,
  langName: string | undefined,
): string | null | undefined => {
  if (!title || !langName) return null;

  let displayTitle = title;
  const namesToRemove = [langName];
  if (langName.includes('(')) {
    namesToRemove.push(langName.split('(')[0].trim());
  }

  // Use our helper to remove language names
  displayTitle = removeKeywords(displayTitle, namesToRemove.filter(Boolean));

  // Remove "Forced" labeling (redundant with Badge)
  displayTitle = displayTitle.replace(/(\[|\()?\s*\bForced\b\s*(\]|\))?/gi, '');

  displayTitle = displayTitle.trim();
  return cleanMetadataString(displayTitle);
};

export const cleanAudioTrackTitle = (
  title: string | undefined | null,
  track: Record<string, unknown>,
  langName?: string,
): string | null | undefined => {
  if (!title) return null;

  let processingTitle = title;

  // 1. Language Removal
  if (langName) {
    const cleaned = cleanTrackTitle(processingTitle, langName);
    if (cleaned !== null && cleaned !== undefined) processingTitle = cleaned;
  }

  // 2. Identify Keywords to Remove
  const keywordsToRemove: string[] = [...COMMON_AUDIO_TERMS_TO_REMOVE];

  // A. Metadata Fields
  METADATA_FIELDS_TO_CHECK.forEach((field) => {
    const val = track[field];
    if (typeof val === 'string') keywordsToRemove.push(val);
    if (typeof val === 'number') keywordsToRemove.push(String(val));
  });

  // B. Format Rules
  // B. Format Rules
  const format = (getString(track, 'Format') ?? '').toUpperCase();
  const formatCom = (getString(track, 'Format_Commercial') ?? '').toUpperCase();
  const codecId = (getString(track, 'CodecID') ?? '').toUpperCase();

  AUDIO_FORMAT_RULES.forEach((rule) => {
    if (rule.check(format, formatCom, codecId)) {
      keywordsToRemove.push(...rule.remove);
    }
  });

  // 3. Execute Removal
  processingTitle = removeKeywords(processingTitle, keywordsToRemove);

  // 4. Tech Spec Regex Cleaning
  processingTitle = cleanAudioTechSpecs(processingTitle, keywordsToRemove);

  // 5. Wrapper & Polish
  processingTitle = cleanWrappers(processingTitle);
  processingTitle = polishTitle(processingTitle);

  // Special Check: "Mix" leftover
  if (processingTitle.toLowerCase() === 'mix') return null;

  if (processingTitle.length < 2) return null;
  return processingTitle;
};

export const cleanSubtitleTrackTitle = (
  title: string | undefined | null,
  track: Record<string, unknown>,
  langName?: string,
): string | null | undefined => {
  if (!title) return null;

  let processingTitle = title;

  // 1. Language Removal
  if (langName) {
    const cleaned = cleanTrackTitle(processingTitle, langName);
    if (cleaned !== null && cleaned !== undefined) processingTitle = cleaned;
  }

  // 2. Identify Keywords to Remove
  const keywordsToRemove: string[] = [...COMMON_SUBTITLE_TERMS_TO_REMOVE];

  // Keywords from Metadata
  METADATA_FIELDS_TO_CHECK.forEach((field) => {
    const val = track[field];
    if (typeof val === 'string') keywordsToRemove.push(val);
  });

  // 3. Execute Removal
  processingTitle = removeKeywords(processingTitle, keywordsToRemove);

  // 4. Wrapper & Polish
  processingTitle = cleanWrappers(processingTitle);
  processingTitle = polishTitle(processingTitle);

  if (processingTitle.length < 2) return null;
  return processingTitle;
};

export const mapDolbyProfile = (profile?: string) => {
  if (!profile) return '';
  if (profile.includes('dvhe.08')) return 'Profile 8.1';
  if (profile.includes('dvhe.05')) return 'Profile 5';
  if (profile.includes('dvhe.07')) return 'Profile 7';
  return profile;
};

export const formatAudioChannels = (
  channels?: number | string,
  positions?: string,
): string => {
  const count = Number(channels);
  if (!channels || isNaN(count)) return '';

  const cleanPositions = (positions ?? '').toUpperCase();
  const lfeCount = (cleanPositions.match(/\bLFE\d*\b/g) ?? []).length;

  const heightRegex =
    /\b(TFL|TFR|TBL|TBR|TSL|TSR|THL|THR|TFC|TBC|VHL|VHR|TC|TCS)\b/g;
  const heightCount = (cleanPositions.match(heightRegex) ?? []).length;

  const mainCount = count - lfeCount - heightCount;

  let layout = `${String(mainCount)}.${String(lfeCount)}`;
  if (heightCount > 0) {
    layout += `.${String(heightCount)}`; // e.g., 5.1.4
  }

  switch (layout) {
    case '1.0':
      return 'Mono';
    case '2.0':
      return 'Stereo';
    default:
      return `${layout} Channels`;
  }
};
