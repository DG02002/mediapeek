export const mapDolbyProfile = (profile?: string) => {
  if (!profile) return '';
  if (profile.includes('dvhe.08')) return 'Profile 8.1';
  if (profile.includes('dvhe.05')) return 'Profile 5';
  if (profile.includes('dvhe.07')) return 'Profile 7';
  return profile;
};

export const cleanMetadataString = (s: string | undefined): string => {
  if (!s) return '';
  return s.trim();
};

export const cleanBitrateString = (s: string | undefined): string => {
  if (!s) return '';
  // Replace space between digits: "5 844" -> "5844"
  return s.replace(/(\d)\s+(?=\d)/g, '$1');
};

export const cleanTrackTitle = (
  title: string | undefined,
  langName: string | undefined,
): string | null => {
  if (!title || !langName) return null;

  let displayTitle = title;

  // Potential language names to remove
  // 1. Full name: "English (US)"
  // 2. Base name: "English"
  const namesToRemove = [langName];
  if (langName.includes('(')) {
    namesToRemove.push(langName.split('(')[0].trim());
  }

  // Sort by length to remove specific first
  namesToRemove.sort((a, b) => b.length - a.length);

  namesToRemove.forEach((name) => {
    if (!name) return;
    const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const langRegex = new RegExp(`\\b${escapedName}\\b`, 'gi');
    displayTitle = displayTitle.replace(langRegex, '');
  });

  // Remove "Forced" labeling (redundant with Badge)
  // Matches: "Forced", "[Forced]", "(Forced)"
  displayTitle = displayTitle.replace(/(\[|\()?\s*\bForced\b\s*(\]|\))?/gi, '');

  displayTitle = displayTitle.trim();

  // Clean up leading/trailing punctuation that might remain (e.g. " (SDH)" -> "(SDH)", ", Title" -> "Title")
  return cleanMetadataString(displayTitle);
};

export const cleanAudioTrackTitle = (
  title: string | undefined | null,
  track: Record<string, unknown>,
  langName?: string,
): string | null => {
  if (!title) return null;

  let processingTitle = title;

  // Remove Language Name
  if (langName) {
    const cleaned = cleanTrackTitle(processingTitle, langName);
    if (cleaned !== null) {
      processingTitle = cleaned;
    }
  }

  // Remove Redundant "Surround/Stereo"
  const stereoRegex = /\b(Surround\s+\d+(\.\d+)?|Stereo)\b/gi;
  processingTitle = processingTitle.replace(stereoRegex, '');

  // Remove Technical Metadata
  // Fields to check against
  const fieldsToCheck = [
    'Format',
    'Format_Info',
    'Format_Commercial',
    'Format_Commercial_IfAny',
    'Format_String',
    'Format_AdditionalFeatures',
    'BitRate_String',
    'SamplingRate_String',
    'Channels_String',
    'ChannelPositions_String2', // e.g. 5.1
    'Channel(s)_String',
    'Channels',
  ];

  const removalTargets: string[] = [];
  fieldsToCheck.forEach((field) => {
    const value = track[field];
    if (typeof value === 'string') {
      removalTargets.push(value);
    } else if (typeof value === 'number') {
      removalTargets.push(String(value));
    }
  });

  // Sort by length (descending)
  removalTargets.sort((a, b) => b.length - a.length);

  removalTargets.forEach((target) => {
    if (!target) return;
    const escapedTarget = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTarget, 'gi');
    processingTitle = processingTitle.replace(regex, '');
  });

  // Generic Tech Specs
  // Channels
  processingTitle = processingTitle.replace(
    /\b\d+(\.\d+)?\s*(ch|channel|channels)\b/gi,
    '',
  );
  processingTitle = processingTitle.replace(/\b\d+\.\d+\b/g, '');

  // Sample Rate
  processingTitle = processingTitle.replace(/\b\d+(\.\d+)?\s*kHz\b/gi, '');

  // Bitrate
  processingTitle = processingTitle.replace(
    /\b\d+(\.\d+)?\s*(kb\/s|kbps|mb\/s|mbps)\b/gi,
    '',
  );

  // Clean up Connectors
  processingTitle = processingTitle
    .replace(/\bwith\b/gi, '')
    .replace(/\bat\b/gi, '')
    .replace(/\s+-\s+/g, ' ');

  // Clean up Empty Brackets/Parentheses
  let prevTitle = '';
  while (prevTitle !== processingTitle) {
    prevTitle = processingTitle;
    processingTitle = processingTitle
      .replace(/\[\s*\]/g, '')
      .replace(/\(\s*\)/g, '')
      .replace(/\{\s*\}/g, '');
    processingTitle = processingTitle.trim();
  }

  // Final Polish
  processingTitle = processingTitle.replace(/\s+/g, ' ').trim();

  // Clean punctuation safely
  processingTitle = processingTitle.replace(/^[\s([{,\-.;]+/, '');
  processingTitle = processingTitle.replace(/[\s)\]},\-.;]+$/, '');

  if (processingTitle.length < 2) {
    return null;
  }
  return processingTitle;
};

export const formatAudioChannels = (
  channels?: number | string,
  positions?: string,
): string => {
  const count = Number(channels);
  if (!channels || isNaN(count)) return '';

  const cleanPositions = (positions || '').toUpperCase();
  const lfeCount = (cleanPositions.match(/\bLFE\d*\b/g) || []).length;

  // Detect height/top channels: Tfl, Tfr, Tbl, Tbr, Tsl, Tsr, Thl, Thr, Tfc, Tbc, Vhl, Vhr, Tc, Tcs
  const heightRegex =
    /\b(TFL|TFR|TBL|TBR|TSL|TSR|THL|THR|TFC|TBC|VHL|VHR|TC|TCS)\b/g;
  const heightCount = (cleanPositions.match(heightRegex) || []).length;

  const mainCount = count - lfeCount - heightCount;

  let layout = `${mainCount}.${lfeCount}`;
  if (heightCount > 0) {
    layout += `.${heightCount}`; // e.g., 5.1.4
  }

  switch (layout) {
    case '1.0':
      return 'Mono';
    case '2.0':
      return 'Stereo';
    default:
      return `${layout} channel`;
  }
};
