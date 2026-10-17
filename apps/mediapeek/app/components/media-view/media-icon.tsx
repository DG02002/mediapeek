import { cn } from '@mediapeek/ui/lib/utils';

const BADGE_ASPECT_RATIOS: Record<string, number> = {
  '3d': 26 / 15,
  '4k': 26 / 15,
  aac: 168 / 53,
  ad: 26 / 15,
  'apple-digital-master': 75 / 18,
  av1: 278 / 155,
  cc: 32 / 15,
  'dolby-atmos': 52 / 22,
  'dolby-audio': 52 / 22,
  'dolby-vision': 52 / 22,
  dolby: 24 / 17,
  'dts-hd-ma': 302.86 / 92.66,
  'dts-x': 139 / 40.8,
  dts: 24 / 10,
  hd: 26 / 15,
  hdr: 34 / 15,
  'hdr10-plus': 54 / 15,
  'hi-res-lossless': 64 / 17,
  'imax-enhanced': 191.2 / 66.7,
  imax: 489.22 / 94.727,
  immersive: 26 / 15,
  lossless: 64 / 17,
  mediainfo: 26 / 15,
  sd: 26 / 15,
  sdh: 32 / 15,
  spatial: 1760 / 830,
};

export const MediaIcon = ({
  name,
  className,
}: {
  name: string;
  className?: string;
}) => {
  const aspectRatio = BADGE_ASPECT_RATIOS[name] || 26 / 15; // Default to standard badge ratio

  return (
    <div
      className={cn('bg-foreground inline-block', className)}
      style={{
        maskImage: `url(/badges/${name}.svg)`,
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
        maskSize: 'contain',
        WebkitMaskImage: `url(/badges/${name}.svg)`,
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        WebkitMaskSize: 'contain',
        aspectRatio: String(aspectRatio),
      }}
    />
  );
};
