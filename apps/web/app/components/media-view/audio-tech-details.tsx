import { memo, type ReactNode, useMemo } from 'react';

import { cleanBitrateString, cleanMetadataString } from '~/lib/formatters';
import type { MediaTrackJSON } from '~/types/media';

import { MediaDetailItem } from './media-detail-item';

interface AudioTechDetailsProps {
  track: MediaTrackJSON;
}

interface DetailItem {
  label: string;
  value: string | ReactNode | undefined;
  sub?: string;
}

export const AudioTechDetails = memo(function AudioTechDetails({
  track,
}: AudioTechDetailsProps) {
  const details: DetailItem[] = useMemo(() => {
    return [
      {
        label: 'Format',
        value: track.Format_String ?? track.Format_Commercial ?? track.Format,
      },
      {
        label: 'Format Settings',
        value: [track.Format_Settings_Endianness, track.Format_Settings_Sign]
          .filter(Boolean)
          .join(' / '),
      },
      {
        label: 'Format Profile',
        value: [
          track.Format_Profile,
          track.Format_Level && `@L${track.Format_Level}`,
          track.Format_Tier && `@${track.Format_Tier}`,
        ]
          .filter(Boolean)
          .join(''),
      },
      {
        label: 'Format Mode',
        value: track.Format_Settings_Mode,
      },
      {
        label: 'Bitrate',
        value: cleanBitrateString(
          (track.BitRate_String ??
            track.BitRate_Maximum_String ??
            '') as string,
        ),

        sub: track.BitRate_Mode_String ?? track.BitRate_Mode,
      },
      {
        label: 'Sample Rate',

        value:
          track.SamplingRate_String ??
          (track.SamplingRate ? `${String(track.SamplingRate)} Hz` : undefined),
      },
      {
        label: 'Bit Depth',
        value:
          track.BitDepth_String ??
          (track.BitDepth ? `${String(track.BitDepth)}-bit` : undefined),
      },
      {
        label: 'Delay',
        value: (() => {
          const d = track.Delay;
          const sd = track.extra?.Source_Delay;
          if (d && d !== '0' && d !== '0.000') return `${String(d)}ms`;
          if (sd && sd !== '0' && sd !== '0.000') return `${String(sd)}ms`;
          return undefined;
        })(),
        sub: (() => {
          const d = track.Delay;
          const sd = track.extra?.Source_Delay;
          // If primary delay exists, we don't show source.
          // If primary is empty/0, and we use source delay, show its source if available.
          if (
            (!d || d === '0' || d === '0.000') &&
            sd &&
            sd !== '0' &&
            sd !== '0.000'
          ) {
            return track.extra?.Source_Delay_Source;
          }
          return undefined;
        })(),
      },
      {
        label: 'Dialogue Intelligence',
        value:
          track.extra?.dialnorm_String ??
          (track.extra?.dialnorm
            ? `${String(track.extra.dialnorm)} dB`
            : undefined),
      },
      {
        label: 'Compression',

        value:
          track.Compression_Mode_String ??
          cleanMetadataString(track.Compression_Mode),
      },
      {
        label: 'Encoded Library',

        value: track.Encoded_Library_String ?? track.Encoded_Library,
      },
      {
        label: 'Service Kind',

        value: (track.ServiceKind_String ?? track.ServiceKind) as string,
      },
      {
        label: 'Codec Configuration Box',
        value: track.extra?.CodecConfigurationBox,
      },
    ].filter((item) => item.value);
  }, [track]);

  if (details.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-3 md:grid-cols-4 md:gap-4">
      {details.map((item, idx) => (
        <MediaDetailItem
          key={`${item.label}-${String(idx)}`}
          label={item.label}
          value={
            <>
              {item.value}
              {item.sub && (
                <span className="text-muted-foreground/60 ml-1.5 font-sans text-xs font-normal">
                  {item.sub}
                </span>
              )}
            </>
          }
        />
      ))}
    </div>
  );
});
