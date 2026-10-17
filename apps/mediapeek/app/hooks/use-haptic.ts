import { useCallback } from 'react';

/**
 * Hook to provide haptic feedback using the Vibration API.
 * Safely handles environments where navigator or vibrate is not available.
 */
export function useHapticFeedback() {
  const vibrate = useCallback((pattern: number | number[]) => {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  }, []);

  const triggerSuccess = useCallback(() => {
    vibrate(50);
  }, [vibrate]);

  const triggerCreativeSuccess = useCallback(() => {
    vibrate([50, 75, 50]);
  }, [vibrate]);

  const triggerError = useCallback(() => {
    vibrate([50, 100, 50]);
  }, [vibrate]);

  return {
    vibrate,
    triggerSuccess,
    triggerCreativeSuccess,
    triggerError,
  };
}
