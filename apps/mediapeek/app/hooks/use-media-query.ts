import * as React from 'react';

export function useMediaQuery(query: string) {
  const [value, setValue] = React.useState(false);

  React.useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function'
    ) {
      function onChange(event: MediaQueryListEvent) {
        setValue(event.matches);
      }

      const result = window.matchMedia(query);
      result.addEventListener('change', onChange);
      setValue(result.matches);

      return () => {
        result.removeEventListener('change', onChange);
      };
    }

    return undefined;
  }, [query]);

  return value;
}
