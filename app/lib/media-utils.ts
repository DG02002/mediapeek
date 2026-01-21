import { MEDIA_CONSTANTS } from '~/lib/media/constants';
import type { MediaTrackJSON } from '~/types/media';

/**
 * Checks if the filename indicates an Apple TV source.
 */
export const isAppleTvFilename = (filename: string): boolean => {
  const normalized = filename.toLowerCase();
  return (
    normalized.includes('aptv') ||
    normalized.includes('atvp') ||
    normalized.includes('apple tv+') ||
    normalized.includes('apple tv')
  );
};

/**
 * Recursively normalizes MediaInfo output to ensure a flat, friendly JSON structure.
 * It unwraps objects like { "@dt": "...", "#value": "..." } into their raw value.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const normalizeMediaInfo = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map((item) => normalizeMediaInfo(item));
  }

  if (typeof data === 'object' && data !== null) {
    // If we find the specific MediaInfo object wrapper, extract the value
    if ('#value' in data) {
      return data['#value'];
    }

    // Otherwise, normalize all children
    const normalized: any = {};
    for (const key of Object.keys(data)) {
      normalized[key] = normalizeMediaInfo(data[key]);
    }
    return normalized;
  }

  // Primitives pass through unchanged
  return data;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Derived accessibility feature flags.
 */
export interface AccessibilityFeatures {
  hasSDH: boolean;
  hasCC: boolean;
  hasAD: boolean;
}

/**
 * Detects accessibility features present in the tracks.
 */
export const getAccessibilityFeatures = (
  audioTracks: MediaTrackJSON[],
  textTracks: MediaTrackJSON[],
  generalTrack?: MediaTrackJSON,
): AccessibilityFeatures => {
  // Subtitle Tech (SDH & CC)
  const hasSDH = textTracks.some((t) => (t['Title'] || '').includes('SDH'));

  const hasCC =
    textTracks.some((t) => {
      const title = (t['Title'] || '').toLowerCase();
      const format = (t['Format'] || '').toLowerCase();
      return (
        title.includes('cc') ||
        title.includes('closed captions') ||
        format.includes('closed captions')
      );
    }) ||
    // Apple TV Check
    (() => {
      if (!generalTrack) return false;
      const fileName = (
        (generalTrack['File_Name'] as string) ||
        (generalTrack['CompleteName'] as string) || // Fallback
        ''
      ).toLowerCase();

      if (!isAppleTvFilename(fileName)) return false;

      // If Apple TV, check for SRT, tx3g, or UTF-8 text tracks
      return textTracks.some((t) => {
        const format = (t['Format'] || '').toLowerCase();
        const codecID = (t['CodecID'] || '').toLowerCase();
        return (
          format.includes('srt') ||
          format.includes('subrip') ||
          format.includes('timed text') ||
          format.includes('utf-8') ||
          codecID.includes('tx3g') ||
          codecID.includes('utf8')
        );
      });
    })();

  // Audio Description (AD)
  const hasAD = audioTracks.some((a) => {
    const title = (a['Title'] || '').toLowerCase();
    const serviceKind = (a['ServiceKind'] || '').toLowerCase();
    return (
      title.includes('ad') ||
      title.includes('audio description') ||
      title.includes('commentary') ||
      serviceKind.includes('audio description') ||
      serviceKind.includes('visually impaired')
    );
  });

  return { hasSDH, hasCC, hasAD };
};

export const getMediaBadges = (
  videoTracks: MediaTrackJSON[],
  audioTracks: MediaTrackJSON[],
  textTracks: MediaTrackJSON[],
  generalTrack?: MediaTrackJSON,
): string[] => {
  const icons: string[] = [];
  const { BADGES, TOKENS } = MEDIA_CONSTANTS;

  // Filename for IMAX check
  const filenameRaw =
    (generalTrack?.['CompleteName'] as string) ||
    (generalTrack?.['File_Name'] as string) ||
    '';
  const displayFilename =
    filenameRaw.split('/').pop()?.split('\\').pop() || filenameRaw;

  // 1. Resolution
  if (videoTracks.length > 0) {
    const widthRaw = videoTracks[0]['Width'] || '0';
    const width = Number(widthRaw);

    if (!isNaN(width)) {
      if (width >= 3840) icons.push(BADGES.RESOLUTION_4K);
      else if (width >= 1920) icons.push(BADGES.RESOLUTION_HD);
      else if (width <= 1280) icons.push(BADGES.RESOLUTION_SD);
    }

    // IMAX Detection
    const aspectRatio = Number(videoTracks[0]['DisplayAspectRatio'] || 0);
    // Allow small margin of error for aspect ratios (epsilon)
    const isImaxRatio =
      Math.abs(aspectRatio - 1.43) < 0.02 || Math.abs(aspectRatio - 1.9) < 0.02;

    if (
      displayFilename.toUpperCase().includes(TOKENS.IMAX.toUpperCase()) ||
      isImaxRatio
    ) {
      icons.push(BADGES.IMAX);
    }

    // HDR / Dolby Vision
    const hdrFormat = videoTracks[0]['HDR_Format'] || '';
    const hdrCompatibility = videoTracks[0]['HDR_Format_Compatibility'] || '';

    if (
      hdrFormat.includes(TOKENS.HDR10_PLUS) ||
      hdrCompatibility.includes(TOKENS.HDR10_PLUS)
    ) {
      icons.push(BADGES.HDR10_PLUS); // 'hdr10-plus'
    } else if (
      hdrFormat.includes('HDR') ||
      hdrCompatibility.includes('HDR10')
    ) {
      // 'HDR'
      icons.push(BADGES.HDR);
    }

    if (hdrFormat.includes('Dolby Vision')) {
      icons.push(BADGES.DOLBY_VISION);
    }

    // AV1 Detection
    if (videoTracks.some((v) => v['Format'] === 'AV1')) {
      icons.push(BADGES.AV1);
    }
  }

  // 2. Audio Tech
  let hasAtmos = false;
  let hasDTSX = false;
  let hasDTS = false;
  let hasDolby = false;

  audioTracks.forEach((a) => {
    // Keys in JSON: "Format", "Format_Commercial_IfAny", "Title"
    const fmt = a['Format'] || '';
    const commercial = a['Format_Commercial_IfAny'] || '';
    const title = a['Title'] || '';
    const additionalFeatures = a['Format_AdditionalFeatures'] || '';
    const combined = (fmt + commercial + title).toLowerCase();

    if (combined.includes(TOKENS.ATMOS)) hasAtmos = true;

    // DTS Logic
    if (additionalFeatures.includes('XLL X')) {
      // Generic XLL X check
      hasDTSX = true;
    } else if (additionalFeatures.includes(TOKENS.XLL)) {
      hasDTS = true;
    } else if (combined.includes(TOKENS.DTS)) {
      hasDTS = true;
    }

    if (
      combined.includes(TOKENS.DOLBY) ||
      combined.includes(TOKENS.AC3) ||
      combined.includes(TOKENS.EAC3)
    )
      hasDolby = true;
  });

  if (hasAtmos) icons.push(BADGES.DOLBY_ATMOS);
  else if (hasDolby && !hasDTS && !hasDTSX) {
    icons.push(BADGES.DOLBY_AUDIO);
  }

  if (hasDTSX) icons.push(BADGES.DTS_X);
  else if (hasDTS) icons.push(BADGES.DTS);

  // 3. Lossless Audio Detection (moved to header as requested)
  // Check for the *best* quality track to determine the badge
  let isHiResLossless = false;
  let isLossless = false;

  audioTracks.forEach((t) => {
    // 1. Bit Depth (Field or Title Fallback)
    let samplingRate = 0;
    const rawRate = t['SamplingRate'];
    if (typeof rawRate === 'number') {
      samplingRate = rawRate;
    } else if (typeof rawRate === 'string') {
      const lowerRate = rawRate.toLowerCase();
      const val = parseFloat(rawRate.replace(/[^0-9.]/g, ''));
      if (lowerRate.includes('k')) samplingRate = val * 1000;
      else samplingRate = val;
    }

    let bitDepth = 0;
    const rawDepth = t['BitDepth'];
    if (typeof rawDepth === 'number') {
      bitDepth = rawDepth;
    } else if (typeof rawDepth === 'string') {
      bitDepth = parseInt(rawDepth.replace(/\D/g, ''), 10);
    }

    if (!bitDepth && t['Title']) {
      const titleMatch = (t['Title'] as string).match(/(\d+)\s*bits?/i);
      if (titleMatch) {
        bitDepth = parseInt(titleMatch[1], 10);
      }
    }

    // 2. Lossless Detection
    const compressionMode =
      typeof t['Compression_Mode'] === 'string'
        ? t['Compression_Mode'].toLowerCase()
        : '';
    const isKnownLosslessFormat = [
      'alac',
      'flac',
      'pcm',
      'wave',
      'wav',
      'ape',
      'wavpack',
      'truehd',
      'mlp',
    ].includes((t['Format'] as string)?.toLowerCase() || '');

    const isTrackLossless =
      compressionMode === 'lossless' || bitDepth >= 16 || isKnownLosslessFormat;

    if (isTrackLossless) {
      if (bitDepth >= 24 && samplingRate > 44100) {
        isHiResLossless = true;
      } else {
        isLossless = true;
      }
    }
  });

  if (isHiResLossless) {
    icons.push(BADGES.HI_RES_LOSSLESS);
  } else if (isLossless) {
    icons.push(BADGES.LOSSLESS);
  }

  // 4. Subtitle Tech (SDH & CC & AD)
  const accessibleFeatures = getAccessibilityFeatures(
    audioTracks,
    textTracks,
    generalTrack,
  );
  if (accessibleFeatures.hasCC) icons.push(BADGES.CC);
  if (accessibleFeatures.hasSDH) icons.push(BADGES.SDH);
  if (accessibleFeatures.hasAD) icons.push(BADGES.AD);

  return icons;
};

export interface ChapterItem {
  time: string;
  name: string;
}

export const parseChapters = (
  menuTrack: MediaTrackJSON | undefined,
): ChapterItem[] => {
  if (!menuTrack || !menuTrack.extra) return [];

  // Extract chapters from 'extra' object
  // Keys like "_00_00_00_000"
  const timeRegex = /^_\d{2}_\d{2}_\d{2}_\d{3}$/;

  return Object.entries(menuTrack.extra)
    .filter(([key]) => timeRegex.test(key))
    .map(([key, value]) => {
      // Convert "_00_00_00_000" to "00:00:00.000"
      const time = key.substring(1).replace(/_/g, (match, offset) => {
        if (offset === 8) return '.'; // Last underscore becomes dot
        return ':';
      });

      return {
        time,
        name: value,
      };
    })
    .sort((a, b) => a.time.localeCompare(b.time));
};
