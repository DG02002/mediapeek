export {};

declare global {
  interface Window {
    turnstile?: TurnstileObject;
  }
}

export interface TurnstileObject {
  render: (
    element: HTMLElement | string,
    options: TurnstileOptions,
  ) => string;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
  getResponse: (widgetId?: string) => string | undefined;
}

export interface TurnstileOptions {
  sitekey: string;
  callback?: (token: string) => void;
  'error-callback'?: () => void;
  'expired-callback'?: () => void;
  theme?: 'light' | 'dark' | 'auto';
  size?: 'normal' | 'compact' | 'invisible';
  tabindex?: number;
  appearance?: 'always' | 'execute' | 'interaction-only';
}
