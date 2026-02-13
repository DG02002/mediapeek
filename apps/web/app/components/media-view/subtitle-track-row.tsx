import { Badge } from '@mediapeek/ui/components/badge';
import { AnimatePresence, motion } from 'motion/react';
import { memo, useMemo } from 'react';

import { cleanSubtitleTrackTitle } from '~/lib/formatters';
import type { MediaTrackJSON } from '~/types/media';

interface SubtitleTrackRowProps {
  track: MediaTrackJSON;
  showOriginalTitles: boolean;
}

export const SubtitleTrackRow = memo(function SubtitleTrackRow({
  track,
  showOriginalTitles,
}: SubtitleTrackRowProps) {
  const langName = track.Language_String ?? track.Language ?? 'Unknown';
  const rawTitle = track.Title;
  const format = track.Format_Info ?? track.Format;
  const codecId = track.CodecID;

  const displayTitle = useMemo(() => {
    return showOriginalTitles
      ? rawTitle
      : cleanSubtitleTrackTitle(rawTitle, track, langName);
  }, [showOriginalTitles, rawTitle, track, langName]);

  const isForcedTitle =
    rawTitle?.toLowerCase() === `${langName} (Forced)`.toLowerCase();

  const showTitle =
    displayTitle &&
    displayTitle.length > 0 &&
    displayTitle.toLowerCase() !== langName.toLowerCase() &&
    !(isForcedTitle && track.Forced === 'Yes');

  let displayFormat = track.CodecID_Info ?? format;
  if (!displayFormat && codecId && format) {
    displayFormat = `${format} (${codecId})`;
  } else if (!displayFormat && codecId) {
    displayFormat = codecId;
  }

  const renderBadges = () => (
    <>
      {track.Default === 'Yes' && (
        <Badge className="h-5 border border-emerald-500/20 bg-emerald-500/15 text-[10px] text-emerald-700 hover:bg-emerald-500/25 dark:bg-emerald-500/20 dark:text-emerald-400">
          Default
        </Badge>
      )}
      {track.Forced === 'Yes' && (
        <Badge className="h-5 border border-amber-500/20 bg-amber-500/15 text-[10px] text-amber-700 hover:bg-amber-500/25 dark:bg-amber-500/20 dark:text-amber-400">
          Forced
        </Badge>
      )}
    </>
  );

  return (
    <motion.div
      layout
      transition={{
        layout: {
          duration: 0.3,
          type: 'spring',
          bounce: 0,
          damping: 20,
          stiffness: 140,
        },
      }}
      className="bg-muted/10 border-border/40 flex items-center justify-between rounded-md border p-3"
    >
      <div className="flex items-start gap-3">
        {/* Track Number Column */}
        <span className="text-muted-foreground pt-0.5 text-xs font-medium">
          {track['@typeorder']}
        </span>

        {/* Content Column */}
        <div className="flex flex-col gap-0.5">
          {/* Line 1: Language Name */}
          <span className="text-foreground/85 text-sm font-semibold">
            {langName}
          </span>

          {/* Line 2: Track Title */}
          <AnimatePresence mode="popLayout">
            {showTitle && (
              <motion.span
                key={displayTitle}
                initial={{ opacity: 0, filter: 'blur(4px)' }}
                animate={{ opacity: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, filter: 'blur(4px)' }}
                transition={{ duration: 0.2 }}
                className="text-muted-foreground text-xs"
              >
                {displayTitle}
              </motion.span>
            )}
          </AnimatePresence>

          {/* Line 3: Format */}
          <span className="text-muted-foreground/70 text-xs tracking-wide">
            {displayFormat}
          </span>
        </div>
      </div>
      <div className="flex gap-1.5 self-center">{renderBadges()}</div>
    </motion.div>
  );
});
