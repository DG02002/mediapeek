import { Badge } from '~/components/ui/badge';
import { getLanguageName } from '~/lib/formatters';
import type { MediaTrackJSON } from '~/types/media';

export function SubtitleSection({
  textTracks,
}: {
  textTracks: MediaTrackJSON[];
}) {
  if (textTracks.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="text-foreground flex items-center gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Subtitles</h2>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        {textTracks.map((text, idx) => {
          const langCode = text['Language'];
          const langName = getLanguageName(langCode);
          const title = text['Title'];

          let format = text['Format'] || '';
          const codecID = text['CodecID'] || '';
          const originalFormat = format;

          if (codecID === 'S_TEXT/UTF8' || format === 'UTF-8') {
            format = 'SRT';
          }

          const displayFormat = `${format}${
            originalFormat && originalFormat !== format
              ? ` (${originalFormat})`
              : ''
          }`;

          return (
            <div
              key={idx}
              className="bg-muted/10 border-border/40 flex items-center justify-between rounded-md border p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-0.5">
                  {/* Line 1: Language Name */}
                  <span className="text-foreground/85 text-sm font-semibold">
                    {langName}
                  </span>

                  {/* Line 2: Track Title */}
                  {title && (
                    <span className="text-muted-foreground text-xs font-medium">
                      {title}
                    </span>
                  )}

                  {/* Line 3: Format */}
                  <span className="text-muted-foreground/70 text-xs tracking-wide uppercase">
                    {displayFormat}
                  </span>
                </div>
              </div>
              <div className="flex gap-1.5">
                {text['Default'] === 'Yes' && (
                  <Badge className="h-5 border border-emerald-500/20 bg-emerald-500/15 text-[10px] text-emerald-700 hover:bg-emerald-500/25 dark:bg-emerald-500/20 dark:text-emerald-400">
                    Default
                  </Badge>
                )}
                {text['Forced'] === 'Yes' && (
                  <Badge className="h-5 border border-amber-500/20 bg-amber-500/15 text-[10px] text-amber-700 hover:bg-amber-500/25 dark:bg-amber-500/20 dark:text-amber-400">
                    Forced
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
