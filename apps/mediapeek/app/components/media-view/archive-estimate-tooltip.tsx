import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@mediapeek/ui/components/tooltip';

interface ArchiveEstimateTooltipProps {
  warning?: string;
}

export function ArchiveEstimateTooltip({
  warning,
}: ArchiveEstimateTooltipProps) {
  if (!warning) return null;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={warning}
            className="text-muted-foreground/75 hover:text-foreground inline-flex size-4 items-center justify-center rounded-full border border-current text-[10px] leading-none transition-colors"
          >
            i
          </button>
        }
      />
      <TooltipContent side="top" align="center">
        {warning}
      </TooltipContent>
    </Tooltip>
  );
}
