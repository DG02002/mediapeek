import { buttonVariants } from '@mediapeek/ui/components/button';
import { cn } from '@mediapeek/ui/lib/utils';
import { Link, NavLink } from 'react-router';

import { ModeToggle } from '~/components/mode-toggle';

interface HeaderProps {
  className?: string;
  showNav?: boolean;
  sticky?: boolean;
}

const navigationItems = [
  { label: 'App', to: '/app' },
];

export function Header({ className, showNav = true, sticky = true }: HeaderProps) {
  return (
    <header
      className={cn(
        'bg-background/95 supports-backdrop-filter:bg-background/80 z-50 border-b backdrop-blur-md',
        sticky && 'sticky top-0',
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-3 sm:px-12">
        <Link
          to="/"
          viewTransition
          className="flex min-w-0 items-center gap-3 no-underline"
        >
          <div className="relative h-10 w-10 shrink-0">
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
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold tracking-tight">
              MediaPeek
            </p>
          </div>
        </Link>

        {showNav ? (
          <nav className="ml-auto hidden items-center gap-1 sm:flex">
            {navigationItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                viewTransition
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    buttonVariants({ variant: 'ghost', size: 'sm' }),
                    isActive && 'bg-muted text-foreground',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        ) : null}

        <div className="ml-auto flex items-center gap-2 sm:ml-0">
          <ModeToggle />
        </div>
      </div>

    </header>
  );
}
