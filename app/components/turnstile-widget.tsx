import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import { getTurnstileSiteKey } from '~/lib/constants';

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: () => void;
  onExpire?: () => void;
}

export interface TurnstileWidgetHandle {
  reset: () => void;
}

declare global {
  interface Window {
    turnstile: {
      render: (
        element: HTMLElement | string,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: () => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

export const TurnstileWidget = forwardRef<
  TurnstileWidgetHandle,
  TurnstileWidgetProps
>(({ onVerify, onError, onExpire }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widgetId, setWidgetId] = useState<string | null>(null);

  const [isVerified, setIsVerified] = useState(false);

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetId && window.turnstile) {
        window.turnstile.reset(widgetId);
        setIsVerified(false);
      }
    },
  }));

  useEffect(() => {
    // Localhost / Development Bypass
    if (import.meta.env.DEV) {
      onVerify('localhost-mock-token');
      setIsVerified(true);
      return;
    }

    if (!containerRef.current) return;

    // Wait for turnstile to be available
    const checkTurnstile = setInterval(() => {
      if (window.turnstile && containerRef.current) {
        clearInterval(checkTurnstile);
        if (!widgetId) {
          try {
            const siteKey = getTurnstileSiteKey();
            const id = window.turnstile.render(containerRef.current, {
              sitekey: siteKey,
              callback: (token) => {
                onVerify(token);
                setIsVerified(true);
              },
              'error-callback': () => {
                onError?.();
              },
              'expired-callback': () => {
                onExpire?.();
                setIsVerified(false);
              },
              theme: 'auto',
            });
            setWidgetId(id);
          } catch (e) {
            console.error('Turnstile render error:', e);
          }
        }
      }
    }, 100);

    return () => {
      clearInterval(checkTurnstile);
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (import.meta.env.DEV) {
    return isVerified ? null : (
      <div className="text-muted-foreground flex min-h-[65px] min-w-[300px] items-center justify-center rounded-md border border-dashed p-4 text-sm">
        Turnstile Bypassed (Dev Mode)
      </div>
    );
  }

  // We keep the widget in DOM but hide it to avoid re-verification issues if react unmounts/remounts excessively
  // Or simply return null if we are confident.
  // Generally safer to css-hide it so the session stays active if we needed to re-submit but usually token is one-time use anyway.
  // Actually, once verified, we have the token. If user submits, token is used.
  // If we hide it, that's fine.

  if (isVerified) {
    return null;
  }

  return <div ref={containerRef} className="min-h-[65px] min-w-[300px]" />;
});

TurnstileWidget.displayName = 'TurnstileWidget';
