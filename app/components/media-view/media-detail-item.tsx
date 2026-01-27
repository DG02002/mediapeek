import type { ReactNode } from 'react';

import { cn } from '~/lib/utils';

interface MediaDetailItemProps {
  label: string;
  value?: ReactNode;
  subtext?: string | null;
  className?: string;
  children?: ReactNode;
  colSpan?: number;
}

export function MediaDetailItem({
  label,
  value,
  subtext,
  className,
  children,
  colSpan,
}: MediaDetailItemProps) {
  return (
    <div
      className={cn(
        colSpan && colSpan > 1 && `sm:col-span-${String(colSpan)}`,
        className,
      )}
    >
      <span className="text-muted-foreground/70 mb-1 block text-[10px] tracking-wider uppercase">
        {label}
      </span>
      {children ?? (
        <div className="flex flex-col">
          <span className="text-foreground/85 text-sm font-medium break-all">
            {value ?? 'N/A'}
          </span>
          {subtext && (
            <span className="text-muted-foreground text-xs font-normal">
              {subtext}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
