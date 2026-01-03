import { Badge } from '~/components/ui/badge';
import {
  formatBitrate,
  formatChannels,
  formatSamplingRate,
  getLanguageName,
} from '~/lib/formatters';
import type { MediaTrackJSON } from '~/types/media';

export function AudioSection({
  audioTracks,
}: {
  audioTracks: MediaTrackJSON[];
}) {
  if (audioTracks.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="text-foreground flex items-center gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Audio</h2>
      </div>
      <div className="flex flex-col gap-3">
        {audioTracks.map((audio, idx) => {
          const langCode = audio['Language'];
          const langName = getLanguageName(langCode);

          const format = audio['Format'];
          const commercial = audio['Format_Commercial_IfAny'];
          const channelsStr = audio['Channel(s)'] || audio['Channels'];
          const channels = formatChannels(channelsStr);
          const bitrate = audio['BitRate'];
          const bitrateMode = audio['BitRate_Mode'];
          const samplingRateRaw = (audio as unknown as Record<string, string>)[
            'SamplingRate'
          ];
          const samplingRate = formatSamplingRate(samplingRateRaw);

          const delayRaw = audio['Delay'];
          const delay = parseFloat(delayRaw || '0');

          const renderBadges = () => (
            <>
              {audio['Default'] === 'Yes' && (
                <Badge className="border border-emerald-500/20 bg-emerald-500/15 text-[10px] text-emerald-700 hover:bg-emerald-500/25 dark:bg-emerald-500/20 dark:text-emerald-400">
                  Default
                </Badge>
              )}
              {audio['Forced'] === 'Yes' && (
                <Badge className="border border-amber-500/20 bg-amber-500/15 text-[10px] text-amber-700 hover:bg-amber-500/25 dark:bg-amber-500/20 dark:text-amber-400">
                  Forced
                </Badge>
              )}
            </>
          );

          return (
            <div
              key={idx}
              className="bg-muted/20 border-muted/30 hover:bg-muted/30 flex flex-col justify-between rounded-lg border p-4 transition-colors sm:flex-row sm:items-center"
            >
              <div className="flex flex-1 flex-col gap-1">
                <div className="flex w-full flex-col gap-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground/85 text-base font-semibold">
                        {langName}
                      </span>
                      {langCode && langCode !== langName && (
                        <span className="text-muted-foreground text-xs uppercase">
                          ({langCode})
                        </span>
                      )}
                    </div>
                    {/* Mobile Badges - Inline Right */}
                    <div className="flex gap-2 sm:hidden">{renderBadges()}</div>
                  </div>
                  {audio['Title'] && (
                    <span className="text-muted-foreground text-xs">
                      {audio['Title']}
                    </span>
                  )}
                </div>

                <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-foreground/85">
                    {format} {commercial ? `(${commercial})` : ''}
                    {format === 'AAC' && (
                      <span className="text-muted-foreground ml-1 text-[10px] font-normal">
                        {audio['Format/Info'] ||
                          'Advanced Audio Codec Low Complexity with Spectral Band Replication'}
                      </span>
                    )}
                  </span>
                  <span>•</span>
                  <span className="text-foreground/85">
                    {channels}
                    {audio.extra?.NumberOfDynamicObjects && (
                      <span className="ml-1">
                        with {audio.extra.NumberOfDynamicObjects} Objects
                      </span>
                    )}
                  </span>
                  {bitrateMode && <span>• {bitrateMode}</span>}
                  {audio['Compression_Mode'] && (
                    <span className="text-foreground/85">
                      • {audio['Compression_Mode']}
                    </span>
                  )}
                  {bitrate && (
                    <>
                      <span>•</span>
                      <span className="text-foreground/85">
                        {formatBitrate(bitrate)}
                      </span>
                    </>
                  )}
                  {audio['BitRate_Maximum'] && (
                    <>
                      <span>•</span>
                      <span className="text-foreground/85">
                        {formatBitrate(audio['BitRate_Maximum'])}
                      </span>
                    </>
                  )}
                  {samplingRate && (
                    <>
                      <span>•</span>
                      <span className="text-foreground/85">{samplingRate}</span>
                    </>
                  )}
                  {audio['BitDepth'] && (
                    <>
                      <span>•</span>
                      <span className="text-foreground/85">
                        {audio['BitDepth']}-bit
                      </span>
                    </>
                  )}
                  {audio.extra?.dialnorm && (
                    <>
                      <span>•</span>
                      <span className="text-amber-600/90 dark:text-yellow-500/80">
                        Dialnorm: {audio.extra.dialnorm}
                      </span>
                    </>
                  )}
                  {delay !== 0 && (
                    <>
                      <span>•</span>
                      <span className="text-amber-600/90 dark:text-yellow-500/80">
                        Delay: {delay}ms
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Desktop Badges - Separate Column */}
              <div className="hidden flex-col items-end gap-2 sm:mt-0 sm:flex">
                <div className="flex gap-2">{renderBadges()}</div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
