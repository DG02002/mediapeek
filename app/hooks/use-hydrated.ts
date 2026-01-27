import { useSyncExternalStore } from 'react';

function subscribe() {
  return () => void 0;
}

export function useHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
