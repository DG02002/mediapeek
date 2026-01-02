import { Skeleton } from '~/components/ui/skeleton';

export function MediaSkeleton() {
  return (
    <div className="mx-auto mt-8 w-full max-w-5xl space-y-6 px-0 pb-20 sm:px-12">
      {/* Header Skeleton */}
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-3/4 max-w-md bg-zinc-200 dark:bg-zinc-800" />{' '}
        {/* Filename */}
        <div className="flex flex-wrap items-center gap-4">
          <Skeleton className="h-4 w-24 bg-zinc-200 dark:bg-zinc-800" />{' '}
          {/* Runtime/Size */}
          <div className="flex gap-2 border-l border-zinc-200 pl-4 dark:border-zinc-800">
            <Skeleton className="h-6 w-10 bg-zinc-200 dark:bg-zinc-800" />{' '}
            {/* Icons */}
            <Skeleton className="h-6 w-10 bg-zinc-200 dark:bg-zinc-800" />
          </div>
          {/* Actions */}
          <div className="mt-2 flex w-full shrink-0 items-center justify-start gap-4 sm:mt-0 sm:ml-auto sm:w-auto sm:justify-end">
            <Skeleton className="h-6 w-32 rounded-full bg-zinc-200 dark:bg-zinc-800" />{' '}
            {/* Switch */}
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24 rounded-md bg-zinc-200 dark:bg-zinc-800" />{' '}
              {/* Copy */}
              <Skeleton className="h-9 w-24 rounded-md bg-zinc-200 dark:bg-zinc-800" />{' '}
              {/* Share */}
            </div>
          </div>
        </div>
        <Skeleton className="h-px w-full bg-zinc-200 dark:bg-zinc-800" />{' '}
        {/* Separator */}
      </div>

      {/* Section 1: Video */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-16 bg-zinc-200 dark:bg-zinc-800" />{' '}
        {/* Title */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-16 bg-zinc-200 dark:bg-zinc-800" />{' '}
              {/* Label */}
              <Skeleton className="h-5 w-24 bg-zinc-200 dark:bg-zinc-800" />{' '}
              {/* Value */}
            </div>
          ))}
        </div>
        <Skeleton className="h-px w-full bg-zinc-200 dark:bg-zinc-800" />
      </div>

      {/* Section 2: Audio */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-16 bg-zinc-200 dark:bg-zinc-800" />
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="bg-muted/10 flex h-20 w-full animate-pulse rounded-lg border border-zinc-200 dark:border-zinc-800"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
