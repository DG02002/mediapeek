import { useEffect, useState } from 'react';
import { useRouteLoaderData } from 'react-router';
import { Theme, useTheme } from 'remix-themes';

import { cn } from '~/lib/utils';
import type { loader } from '~/root';

export function ModeToggle() {
  const loaderData = useRouteLoaderData<typeof loader>('root');
  const serverTheme = loaderData?.theme; // Access theme from loader data (source of truth for preference)
  const [themeState, setThemeState] = useState<Theme | null | undefined>(
    serverTheme,
  );
  const [, setTheme] = useTheme(); // useTheme used only for setting

  useEffect(() => {
    setThemeState(serverTheme);
  }, [serverTheme]);

  return (
    <div className="border-input flex h-6 items-center rounded-lg border p-0.5 sm:h-7">
      <button
        type="button"
        onClick={() => {
          setTheme(Theme.LIGHT);
          setThemeState(Theme.LIGHT);
        }}
        className={cn(
          'min-w-[2.8rem] rounded-md px-1 py-0.5 text-[10px] font-medium transition-all sm:min-w-12 sm:px-2 sm:text-xs',
          themeState === Theme.LIGHT
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        Light
      </button>
      <button
        type="button"
        onClick={() => {
          setTheme(Theme.DARK);
          setThemeState(Theme.DARK);
        }}
        className={cn(
          'min-w-[2.8rem] rounded-md px-1 py-0.5 text-[10px] font-medium transition-all sm:min-w-12 sm:px-2 sm:text-xs',
          themeState === Theme.DARK
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        Dark
      </button>
      <button
        type="button"
        onClick={() => {
          setTheme(null);
          setThemeState(null);
        }}
        className={cn(
          'min-w-[2.8rem] rounded-md px-1 py-0.5 text-[10px] font-medium transition-all sm:min-w-12 sm:px-2 sm:text-xs',
          themeState === null || themeState === undefined
            ? 'bg-primary text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        Auto
      </button>
    </div>
  );
}
