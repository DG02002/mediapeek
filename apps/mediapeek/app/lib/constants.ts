interface WindowEnv {
  ENV?: {
    TURNSTILE_SITE_KEY?: string;
  };
}

export function getTurnstileSiteKey(): string {
  const fallbackSiteKey = import.meta.env.DEV ? '1x00000000000000000000AA' : '';

  if (typeof window !== 'undefined') {
    const win = window as unknown as WindowEnv;
    return (
      (win.ENV?.TURNSTILE_SITE_KEY ??
        (import.meta.env.VITE_TURNSTILE_SITE_KEY as string)) ||
      fallbackSiteKey
    );
  }

  return (import.meta.env.VITE_TURNSTILE_SITE_KEY as string) || fallbackSiteKey;
}
