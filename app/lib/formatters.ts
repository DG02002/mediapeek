export const formatSize = (sizeStr?: string | number) => {
  if (!sizeStr) return 'Unknown Size';
  const size = typeof sizeStr === 'string' ? parseInt(sizeStr, 10) : sizeStr;
  if (isNaN(size)) return sizeStr.toString();
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024)
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export const formatDuration = (durationStr?: string | number) => {
  if (!durationStr) return '';
  const durationMs =
    typeof durationStr === 'string'
      ? parseFloat(durationStr) * 1000
      : durationStr;
  if (isNaN(durationMs)) return durationStr.toString();

  const seconds = Math.floor((durationMs / 1000) % 60);
  const minutes = Math.floor((durationMs / (1000 * 60)) % 60);
  const hours = Math.floor(durationMs / (1000 * 60 * 60));

  const parts = [];
  if (hours > 0) parts.push(`${hours} h`);
  if (minutes > 0) parts.push(`${minutes} min`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds} s`);

  return parts.join(' ');
};

export const formatBitrate = (bitrateStr?: string) => {
  if (!bitrateStr) return '';
  const bitrate = parseInt(bitrateStr, 10);
  if (isNaN(bitrate)) return bitrateStr;

  if (bitrate > 1000000) {
    return `${(bitrate / 1000000).toFixed(1)} Mb/s`;
  }
  if (bitrate > 1000) {
    return `${(bitrate / 1000).toFixed(0)} kb/s`;
  }
  return `${bitrate} b/s`;
};

export const getLanguageName = (code?: string) => {
  if (!code) return 'Unknown Language';
  try {
    // MediaInfo often returns 'en', 'hi', etc.
    return new Intl.DisplayNames(['en'], { type: 'language' }).of(code) || code;
  } catch {
    return code;
  }
};

export const mapDolbyProfile = (profile?: string) => {
  if (!profile) return '';
  if (profile.includes('dvhe.08')) return 'Profile 8.1';
  if (profile.includes('dvhe.05')) return 'Profile 5';
  if (profile.includes('dvhe.07')) return 'Profile 7';
  return profile;
};

export const formatChannels = (channelsStr?: string) => {
  if (!channelsStr) return '';
  const c = parseInt(channelsStr.replace(/\D/g, ''), 10);
  if (isNaN(c)) return channelsStr;

  if (c === 2) return 'Stereo';
  if (c === 6) return '5.1 Channels';
  if (c === 8) return '7.1 Channels';

  return `${c} Channels`;
};
