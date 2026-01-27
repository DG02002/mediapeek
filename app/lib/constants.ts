interface WindowEnv {
  ENV?: {
    TURNSTILE_SITE_KEY?: string;
  };
}

export function getTurnstileSiteKey(): string {
  if (import.meta.env.DEV) {
    return '1x00000000000000000000AA';
  }
  if (typeof window !== 'undefined') {
    const win = window as unknown as WindowEnv;
    return (
      (win.ENV?.TURNSTILE_SITE_KEY ??
        (import.meta.env.VITE_TURNSTILE_SITE_KEY as string)) ||
      ''
    );
  }

  return (import.meta.env.VITE_TURNSTILE_SITE_KEY as string) || '';
}
