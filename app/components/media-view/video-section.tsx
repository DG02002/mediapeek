import { formatBitrate, mapDolbyProfile } from '~/lib/formatters';
import type { MediaTrackJSON } from '~/types/media';

const getBitrate = (
  videoTrack: MediaTrackJSON,
  generalTrack?: MediaTrackJSON,
) => {
  if (videoTrack['BitRate']) return videoTrack['BitRate'];
  if (videoTrack['BitRate_Measured']) return videoTrack['BitRate_Measured'];
  if (videoTrack['BitRate_Maximum']) return videoTrack['BitRate_Maximum'];
  if (videoTrack['BitRate_Nominal']) return videoTrack['BitRate_Nominal'];
  // Fallback to OverallBitRate from General if available
  if (generalTrack && generalTrack['OverallBitRate'])
    return generalTrack['OverallBitRate'];
  return null;
};

export function VideoSection({
  videoTracks,
  generalTrack,
}: {
  videoTracks: MediaTrackJSON[];
  generalTrack?: MediaTrackJSON;
}) {
  if (videoTracks.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="text-foreground mb-2 flex items-center gap-2">
        <h2 className="mb-3 text-xl font-semibold tracking-tight">Video</h2>
      </div>
      <div className="grid gap-4">
        {videoTracks.map((video, idx) => {
          const codec =
            video['Format'] === 'HEVC'
              ? 'HEVC (High Efficiency Video Coding)'
              : video['Format'];
          const profile = video['Format_Profile'];
          const level = video['Format_Level'];
          const tier = video['Format_Tier'];
          const frMode =
            video['FrameRate_Mode'] === 'CFR'
              ? 'CFR'
              : video['FrameRate_Mode'] === 'VFR'
                ? 'VFR'
                : video['FrameRate_Mode'];

          return (
            <div
              key={idx}
              className="border-border/40 grid gap-x-8 gap-y-6 border-b pb-6 text-sm last:border-0 sm:grid-cols-2 lg:grid-cols-4"
            >
              {/* Row 1 - Codec, Res, Bitrate, FR */}
              <div>
                <span className="text-muted-foreground mb-1 block text-xs tracking-wider uppercase">
                  Codec
                </span>
                <div className="flex flex-col">
                  <span className="text-foreground/85 font-semibold">
                    {codec}
                  </span>
                  {profile && (
                    <span className="text-muted-foreground text-xs">
                      {profile}
                      {level ? `@L${level}` : ''}
                      {tier ? `@${tier}` : ''}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground mb-1 block text-xs tracking-wider uppercase">
                  Resolution
                </span>
                <span className="font-semibold">
                  {video['Width']} x {video['Height']}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground mb-1 block text-xs tracking-wider uppercase">
                  Bitrate
                </span>
                <span className="font-semibold">
                  {formatBitrate(getBitrate(video, generalTrack) || '') ||
                    'Unknown'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground mb-1 block text-xs tracking-wider uppercase">
                  Frame Rate
                </span>
                <div className="flex flex-col">
                  <span className="text-foreground/85 font-semibold">
                    {video['FrameRate'] || 'Unknown'}
                  </span>
                  {frMode && (
                    <span className="text-muted-foreground text-xs font-normal">
                      ({frMode})
                    </span>
                  )}
                </div>
              </div>

              {/* Row 2 - Chroma, BitDepth, ColorPrimaries */}
              {video['ChromaSubsampling'] && (
                <div>
                  <span className="text-muted-foreground mb-1 block text-xs tracking-wider uppercase">
                    Chroma Subsampling
                  </span>
                  <span className="text-foreground/85 font-semibold">
                    {video['ChromaSubsampling']}
                  </span>
                </div>
              )}
              {video['BitDepth'] && (
                <div>
                  <span className="text-muted-foreground mb-1 block text-xs tracking-wider uppercase">
                    Bit Depth
                  </span>
                  <span className="text-foreground/85 font-semibold">
                    {video['BitDepth']} bits
                  </span>
                </div>
              )}
              {/* Bits/(Pixel*Frame) Calculation */}
              {(() => {
                const w = parseInt(video['Width'] || '0', 10);
                const h = parseInt(video['Height'] || '0', 10);
                const fps = parseFloat(video['FrameRate'] || '0');
                const br = parseInt(getBitrate(video, generalTrack) || '0', 10);

                if (w > 0 && h > 0 && fps > 0 && br > 0) {
                  const bpf = (br / (w * h * fps)).toFixed(3);
                  return (
                    <div>
                      <span className="text-muted-foreground mb-1 block text-xs tracking-wider uppercase">
                        Bits/(Pixel*Frame)
                      </span>
                      <span className="text-foreground/85 font-semibold">
                        {bpf}
                      </span>
                    </div>
                  );
                }
                return null;
              })()}
              {video['colour_primaries'] && (
                <div className="sm:col-span-2 lg:col-span-2">
                  <span className="text-muted-foreground mb-1 block text-xs tracking-wider uppercase">
                    Color Primaries
                  </span>
                  <span className="text-foreground/85 font-semibold">
                    {video['colour_primaries']}
                  </span>
                </div>
              )}

              {/* Row 3 - HDR, Transfer, Mastering Display */}
              {video['HDR_Format'] && (
                <div className="sm:col-span-2 lg:col-span-1">
                  <span className="text-muted-foreground mb-1 block text-xs tracking-wider uppercase">
                    High Dynamic Range
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-foreground/85 font-semibold">
                      {video['HDR_Format']}
                    </span>
                    {video['HDR_Format_Profile'] && (
                      <span className="text-muted-foreground text-xs">
                        {mapDolbyProfile(video['HDR_Format_Profile'])}
                      </span>
                    )}
                    {video['HDR_Format_Compatibility'] && (
                      <span className="text-muted-foreground text-xs">
                        Compatibility: {video['HDR_Format_Compatibility']}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {video['transfer_characteristics'] && (
                <div>
                  <span className="text-muted-foreground mb-1 block text-xs tracking-wider uppercase">
                    Transfer Characteristics
                  </span>
                  <span className="text-foreground/85 font-semibold">
                    {video['transfer_characteristics']}
                  </span>
                </div>
              )}

              {video['MasteringDisplay_ColorPrimaries'] && (
                <div>
                  <span className="text-muted-foreground mb-1 block text-xs tracking-wider uppercase">
                    Mastering Display Color Primaries
                  </span>
                  <span className="text-foreground/85 font-semibold">
                    {video['MasteringDisplay_ColorPrimaries']}
                  </span>
                </div>
              )}
              {video['MasteringDisplay_Luminance'] && (
                <div>
                  <span className="text-muted-foreground mb-1 block text-xs tracking-wider uppercase">
                    Mastering Display Luminance
                  </span>
                  <span className="text-foreground/85 font-semibold">
                    {video['MasteringDisplay_Luminance']}
                  </span>
                </div>
              )}
              {video['extra']?.['CodecConfigurationBox'] && (
                <div>
                  <span className="text-muted-foreground mb-1 block text-xs tracking-wider uppercase">
                    Codec Configuration Box
                  </span>
                  <span className="font-semibold">
                    {video['extra']['CodecConfigurationBox']}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
