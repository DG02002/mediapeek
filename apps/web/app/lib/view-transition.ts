import { flushSync } from 'react-dom';

/**
 * Orchestrates a View Transition for DOM updates.
 *
 * This utility uses strict feature detection (`'startViewTransition' in document`)
 * to avoid TypeScript lint errors when the DOM library assumes universal support.
 *
 * Pattern:
 * 1. If supported: Wraps the update in `document.startViewTransition()` and `flushSync`
 *    to ensure the "after" state is captured immediately.
 * 2. If unsupported: Executes the fallback strategy (e.g., standard React state update).
 *
 * @param updateCallback - The state update function to run.
 * @param fallbackCallback - Optional fallback if View Transitions are not supported.
 *                           If not provided, `updateCallback` runs synchronously.
 */
export function startNativeViewTransition(
  updateCallback: () => void,
  fallbackCallback?: () => void,
) {
  // Use `in` check to satisfy "@typescript-eslint/no-unnecessary-condition"
  // effectively validating runtime support regardless of static type definitions.
  if (
    'startViewTransition' in document &&
    typeof document.startViewTransition === 'function'
  ) {
    document.startViewTransition(() => {
      flushSync(() => {
        updateCallback();
      });
    });
  } else {
    if (fallbackCallback) {
      fallbackCallback();
    } else {
      updateCallback();
    }
  }
}
