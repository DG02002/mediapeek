import { memo } from 'react';

import { parseChapters } from '~/lib/media-utils';
import type { MediaTrackJSON } from '~/types/media';

export const ChapterSection = memo(function ChapterSection({
  menuTrack,
}: {
  menuTrack?: MediaTrackJSON;
}) {
  const chapters = parseChapters(menuTrack);

  if (chapters.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="text-foreground flex items-center gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Chapters</h2>
      </div>
      <div className="border-border/40 bg-card/30 max-h-[300px] overflow-y-auto rounded-lg border p-4">
        <div className="grid grid-cols-1 gap-x-8 gap-y-2">
          {chapters.map(({ time, name }, i) => (
            <div
              key={i}
              className="border-border/30 flex gap-4 border-b py-2 text-sm last:border-0"
            >
              <span className="text-muted-foreground w-24 shrink-0 font-mono">
                {time.split('.')[0]}
              </span>
              <span className="text-foreground/85 truncate font-medium break-all">
                {
                  name.replace(
                    /^[a-z]{2}:/,
                    '',
                  ) /* Remove 'en:' prefix if present */
                }
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});
