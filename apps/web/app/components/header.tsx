import { buttonVariants } from '@mediapeek/ui/components/button';
import { cn } from '@mediapeek/ui/lib/utils';
import { Link } from 'react-router';

import { ModeToggle } from '~/components/mode-toggle';

function GithubButton({ className }: { className?: string }) {
  return (
    <a
      href="https://github.com/luminalreason/mediapeek"
      target="_blank"
      rel="noreferrer"
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'icon' }),
        className,
      )}
    >
      <svg
        role="img"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
        className="h-[1.2rem] w-[1.2rem] fill-current"
      >
        <title>GitHub</title>
        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
      </svg>
      <span className="sr-only">GitHub</span>
    </a>
  );
}

interface HeaderProps {
  className?: string;
  showDescription?: boolean;
  align?: 'start' | 'center';
}

export function Header({
  className,
  showDescription = false,
  align = 'start',
}: HeaderProps) {
  return (
    <div className={cn('relative z-10 w-full', className)}>
      <div
        className={cn(
          'flex flex-col gap-2 sm:flex-row sm:gap-4',
          align === 'start' ? 'sm:items-start' : 'sm:items-center',
        )}
      >
        {/* Icon */}
        <Link to="/" viewTransition className="block no-underline">
          <div className="relative h-16 w-16 drop-shadow-md">
            <img
              src="/badges/icon-light.webp"
              alt="MediaPeek Logo"
              className="hidden h-full w-full object-contain dark:block"
            />
            <img
              src="/badges/icon-dark.webp"
              alt="MediaPeek Logo"
              className="h-full w-full object-contain dark:hidden"
            />
          </div>
        </Link>
        {/* Content Column: Title/Actions + Description */}
        <div className="flex flex-1 flex-col">
          {/* Title and Desktop Actions */}
          <div className="flex items-center justify-between">
            <Link to="/" viewTransition className="no-underline">
              <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl">
                MediaPeek
              </h1>
            </Link>
            <div className="flex items-center gap-2">
              <GithubButton className="hidden sm:inline-flex" />
              <ModeToggle />
            </div>
          </div>
          {/* Description and Mobile Actions */}
          <div className="flex w-full items-center justify-between gap-2">
            {showDescription ? (
              <p className="text-muted-foreground leading-7">
                Get detailed metadata for any media file.
              </p>
            ) : (
              <div /> /* Spacer to keep GithubButton aligned if description is hidden but we want to keep layout structure, though usually flex logic handles it. Effectivelly empty here. */
            )}
            <GithubButton className="inline-flex sm:hidden" />
          </div>
        </div>
      </div>
    </div>
  );
}
