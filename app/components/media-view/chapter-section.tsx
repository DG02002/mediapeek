import type { MediaTrackJSON } from '~/types/media';

export function ChapterSection({ menuTrack }: { menuTrack?: MediaTrackJSON }) {
  if (!menuTrack || !menuTrack.extra) return null;

  // Extract chapters from 'extra' object
  // Keys like "_00_00_00_000"
  const timeRegex = /^_\d{2}_\d{2}_\d{2}_\d{3}$/;

  const chapters = Object.entries(menuTrack.extra)
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
              <span className="text-foreground/85 truncate font-medium">
                {
                  String(name).replace(
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
}
