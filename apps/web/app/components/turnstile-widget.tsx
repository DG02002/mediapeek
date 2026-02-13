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

export const TurnstileWidget = forwardRef<
  TurnstileWidgetHandle,
  TurnstileWidgetProps
>(({ onVerify, onError, onExpire }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [widgetId, setWidgetId] = useState<string | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  const [isVerified, setIsVerified] = useState(() => import.meta.env.DEV);

  // Store callbacks in ref to avoid effect dependencies
  const callbacksRef = useRef({ onVerify, onError, onExpire });

  useEffect(() => {
    callbacksRef.current = { onVerify, onError, onExpire };
  });

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
      callbacksRef.current.onVerify('localhost-mock-token');
      // Already set to true in initial state
      return;
    }

    if (!containerRef.current) return;

    // Wait for turnstile to be available
    const checkTurnstile = setInterval(() => {
      // Type assertion as we check existence
      const turnstile = window.turnstile;

      if (turnstile && containerRef.current) {
        clearInterval(checkTurnstile);
        // Check ref instead of state to avoid stale closure issues during initial mount/setup
        if (!widgetIdRef.current) {
          try {
            const siteKey = getTurnstileSiteKey();
            const id = turnstile.render(containerRef.current, {
              sitekey: siteKey,
              callback: (token) => {
                callbacksRef.current.onVerify(token);
                setIsVerified(true);
              },
              'error-callback': () => {
                callbacksRef.current.onError?.();
              },
              'expired-callback': () => {
                callbacksRef.current.onExpire?.();
                setIsVerified(false);
              },
              theme: 'auto',
            });
            setWidgetId(id);
            widgetIdRef.current = id;
          } catch (e) {
            console.error('Turnstile render error:', e);
          }
        }
      }
    }, 100);

    return () => {
      clearInterval(checkTurnstile);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
        setWidgetId(null);
      }
    };
  }, []);

  if (import.meta.env.DEV) {
    return isVerified ? null : (
      <div className="text-muted-foreground flex min-h-[65px] min-w-[300px] items-center justify-center rounded-md border border-dashed p-4 text-sm">
        Turnstile Bypassed (Dev Mode)
      </div>
    );
  }

  // Hide when verified to clean up UI, but keep mounted if needed (logic specific to use case)
  if (isVerified) {
    return null;
  }

  return <div ref={containerRef} className="min-h-[65px] min-w-[300px]" />;
});

TurnstileWidget.displayName = 'TurnstileWidget';
