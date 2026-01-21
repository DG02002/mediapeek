import { cleanBitrateString, mapDolbyProfile } from '~/lib/formatters';
import type { MediaTrackJSON } from '~/types/media';

import { MediaDetailItem } from './media-detail-item';

export function VideoSection({
  videoTracks,
}: {
  videoTracks: MediaTrackJSON[];
}) {
  if (videoTracks.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="text-foreground mb-2 flex items-center gap-2">
        <h2 className="mb-3 text-xl font-semibold tracking-tight">Video</h2>
      </div>
      <div className="grid gap-4">
        {videoTracks.map((video, idx) => {
          let codec = video['Format'];
          const formatInfo = video['Format_Info'] || video['Format/Info'];

          if (formatInfo) {
            codec = `${codec} (${formatInfo})`;
          }
          const profile = video['Format_Profile'];
          const level = video['Format_Level'];
          const tier = video['Format_Tier'];

          const profileStr = [
            profile,
            level ? `@L${level}` : '',
            tier ? `@${tier}` : '',
          ]
            .filter(Boolean)
            .join('');

          const rawBitrate =
            video['BitRate_String'] || video['OverallBitRate_String'];
          const bitrateStr = rawBitrate
            ? cleanBitrateString(String(rawBitrate))
            : null;
          const bpf = video['BitsPixel_Frame'];

          return (
            <div
              key={idx}
              className="border-border/40 grid gap-x-8 gap-y-6 border-b pb-6 text-sm last:border-0 sm:grid-cols-2 lg:grid-cols-4"
            >
              <MediaDetailItem label="Codec">
                <div className="flex flex-col">
                  <span className="text-foreground/85 font-semibold">
                    {codec}
                  </span>
                  {video['CodecID'] && (
                    <span className="text-muted-foreground text-xs font-normal">
                      {video['CodecID']}
                    </span>
                  )}
                  {profileStr && (
                    <span className="text-muted-foreground text-xs font-normal">
                      {profileStr}
                    </span>
                  )}
                </div>
              </MediaDetailItem>
              <MediaDetailItem label="Resolution">
                <div className="flex flex-col">
                  <span className="text-foreground/85 font-semibold">
                    {video['Width']} x {video['Height']}
                  </span>
                  {video['DisplayAspectRatio'] && (
                    <span className="text-muted-foreground text-xs font-normal">
                      {video['DisplayAspectRatio_String'] ||
                        video['DisplayAspectRatio']}
                    </span>
                  )}
                </div>
              </MediaDetailItem>
              {bitrateStr && (
                <MediaDetailItem label="Bitrate">
                  <div className="flex flex-col">
                    <span className="text-foreground/85 font-semibold">
                      {bitrateStr}
                    </span>
                    {video['BitRate_Mode'] && (
                      <span className="text-muted-foreground text-xs font-normal">
                        {video['BitRate_Mode_String'] || video['BitRate_Mode']}
                      </span>
                    )}
                    {bpf && (
                      <span className="text-muted-foreground text-xs font-normal">
                        Bits/(Pixel*Frame): {bpf}
                      </span>
                    )}
                  </div>
                </MediaDetailItem>
              )}
              <MediaDetailItem label="Frame Rate">
                <div className="flex flex-col">
                  <span className="text-foreground/85 font-semibold">
                    {video['FrameRate_String'] ||
                      video['FrameRate'] ||
                      'Unknown'}
                  </span>
                  {video['FrameRate_Original'] && (
                    <span className="text-muted-foreground text-xs font-normal">
                      Original: {video['FrameRate_Original']}
                    </span>
                  )}
                  {video['FrameRate_Mode'] && (
                    <span className="text-muted-foreground text-xs font-normal">
                      {video['FrameRate_Mode_String'] ||
                        video['FrameRate_Mode']}
                    </span>
                  )}
                </div>
              </MediaDetailItem>

              {(video['colour_primaries'] ||
                video['transfer_characteristics'] ||
                video['matrix_coefficients']) && (
                <MediaDetailItem label="Colorimetry">
                  <div className="flex flex-col">
                    {video['colour_primaries'] && (
                      <span className="text-foreground/85 font-semibold">
                        {video['colour_primaries']}
                      </span>
                    )}
                    {video['matrix_coefficients'] && (
                      <span className="text-muted-foreground text-xs font-normal">
                        {video['matrix_coefficients']}
                      </span>
                    )}
                    {video['transfer_characteristics'] && (
                      <span className="text-muted-foreground text-xs font-normal">
                        {video['transfer_characteristics']} (Transfer)
                      </span>
                    )}
                  </div>
                </MediaDetailItem>
              )}

              {video['HDR_Format'] && (
                <MediaDetailItem
                  label="High Dynamic Range"
                  value={String(video['HDR_Format'])}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-foreground/85 font-semibold">
                      {video['HDR_Format']}
                    </span>
                    {video['HDR_Format_Profile'] && (
                      <span className="text-muted-foreground text-xs">
                        {mapDolbyProfile(String(video['HDR_Format_Profile']))}
                      </span>
                    )}
                    {video['HDR_Format_Compatibility'] && (
                      <span className="text-muted-foreground text-xs">
                        Compatibility: {video['HDR_Format_Compatibility']}
                      </span>
                    )}
                  </div>
                </MediaDetailItem>
              )}

              {(video['MasteringDisplay_ColorPrimaries'] ||
                video['MasteringDisplay_Luminance']) && (
                <MediaDetailItem label="Mastering Display">
                  <div className="flex flex-col">
                    {video['MasteringDisplay_ColorPrimaries'] && (
                      <span className="text-foreground/85 font-semibold">
                        {video['MasteringDisplay_ColorPrimaries']}
                      </span>
                    )}
                    {video['MasteringDisplay_Luminance'] && (
                      <span className="text-muted-foreground text-xs font-normal">
                        {video['MasteringDisplay_Luminance']}
                      </span>
                    )}
                  </div>
                </MediaDetailItem>
              )}

              {(video['ColorSpace'] ||
                video['ChromaSubsampling'] ||
                video['colour_range']) && (
                <MediaDetailItem label="Color">
                  <div className="flex flex-col">
                    {video['ColorSpace'] && (
                      <span className="text-foreground/85 font-semibold">
                        {video['ColorSpace']}
                      </span>
                    )}
                    {video['ChromaSubsampling'] && (
                      <span className="text-muted-foreground text-xs font-normal">
                        {video['ChromaSubsampling_String'] ||
                          video['ChromaSubsampling']}
                        {video['ChromaSubsampling_Position'] &&
                          !(
                            video['ChromaSubsampling_String'] ||
                            video['ChromaSubsampling']
                          )
                            ?.toString()
                            .includes(
                              String(video['ChromaSubsampling_Position']),
                            ) &&
                          ` (${video['ChromaSubsampling_Position']})`}
                      </span>
                    )}
                    {video['colour_range'] && (
                      <span className="text-muted-foreground text-xs font-normal">
                        {video['colour_range']}
                      </span>
                    )}
                  </div>
                </MediaDetailItem>
              )}

              {video['BitDepth'] && (
                <MediaDetailItem
                  label="Bit Depth"
                  value={
                    video['BitDepth_String'] || `${video['BitDepth']} bits`
                  }
                />
              )}

              {(video['ScanType'] || video['Standard']) && (
                <MediaDetailItem label="Scan Type">
                  <div className="flex flex-col">
                    {video['Standard'] && (
                      <span className="text-foreground/85 font-semibold">
                        {video['Standard']}
                      </span>
                    )}
                    {video['ScanType'] && (
                      <span
                        className={
                          video['Standard']
                            ? 'text-muted-foreground text-xs font-normal'
                            : 'text-foreground/85 font-semibold'
                        }
                      >
                        {video['ScanType']}
                      </span>
                    )}
                    {video['ScanType_StoreMethod'] && (
                      <span className="text-muted-foreground text-xs font-normal">
                        {video['ScanType_StoreMethod']}
                      </span>
                    )}
                    {video['ScanOrder'] && (
                      <span className="text-muted-foreground text-xs font-normal">
                        {video['ScanOrder'] === 'TFF'
                          ? 'Top Field First'
                          : video['ScanOrder'] === 'BFF'
                            ? 'Bottom Field First'
                            : video['ScanOrder']}
                      </span>
                    )}
                  </div>
                </MediaDetailItem>
              )}

              {(() => {
                const libName = video['Encoded_Library_Name'];
                const libVersion = video['Encoded_Library_Version'];
                const fullLib = video['Encoded_Library'];

                let displayMain = libName;
                let displaySub = libVersion;

                if (!displayMain && fullLib) {
                  // Fallback: try to split "x264 - core 123"
                  const match = String(fullLib).match(/^(.*?) - (.*)$/);
                  if (match) {
                    displayMain = match[1];
                    displaySub = match[2];
                  } else {
                    displayMain = fullLib;
                  }
                }

                if (!displayMain) return null;

                return (
                  <MediaDetailItem label="Encoded Library">
                    <div className="flex flex-col">
                      <span className="text-foreground/85 font-semibold">
                        {displayMain}
                      </span>
                      {displaySub && (
                        <span className="text-muted-foreground text-xs font-normal">
                          {displaySub}
                        </span>
                      )}
                    </div>
                  </MediaDetailItem>
                );
              })()}

              {video['extra']?.['CodecConfigurationBox'] && (
                <MediaDetailItem
                  label="Codec Configuration Box"
                  value={video['extra']['CodecConfigurationBox']}
                />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
