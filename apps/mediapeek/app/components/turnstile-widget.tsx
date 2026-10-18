import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"

import { TURNSTILE_SCRIPT_LOAD_TIMEOUT_MS } from "~/constants"

interface TurnstileWidgetProps {
  onVerify: (token: string) => void
  onError: () => void
  onExpire?: () => void
}

export interface TurnstileWidgetHandle {
  reset: () => void
}

export const TurnstileWidget = forwardRef<
  TurnstileWidgetHandle,
  TurnstileWidgetProps
>(({ onVerify, onError, onExpire }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [widgetId, setWidgetId] = useState<string | null>(null)
  const widgetIdRef = useRef<string | null>(null)

  const [isVerified, setIsVerified] = useState(false)

  // Store callbacks in ref to avoid effect dependencies
  const callbacksRef = useRef({ onVerify, onError, onExpire })

  useEffect(() => {
    callbacksRef.current = { onVerify, onError, onExpire }
  })

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetId && window.turnstile) {
        window.turnstile.reset(widgetId)
        setIsVerified(false)
      }
    },
  }))

  useEffect(() => {
    if (containerRef.current) {
      const siteKey = window.ENV.TURNSTILE_SITE_KEY?.trim() ?? ""

      if (!siteKey) {
        callbacksRef.current.onError()

        return undefined
      }

      let didFinish = false

      const clearTimers = () => {
        window.clearInterval(checkInterval)
        window.clearTimeout(loadTimeout)
      }

      const fail = () => {
        if (didFinish) {
          return
        }

        didFinish = true
        clearTimers()
        callbacksRef.current.onError()
      }

      const checkTurnstile = () => {
        const { turnstile } = window

        if (!turnstile || !containerRef.current || didFinish) {
          return
        }

        try {
          const id = turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token) => {
              callbacksRef.current.onVerify(token)
              setIsVerified(true)
            },
            "error-callback": () => {
              callbacksRef.current.onError()
            },
            "expired-callback": () => {
              callbacksRef.current.onExpire?.()
              setIsVerified(false)
            },
            theme: "auto",
          })

          didFinish = true
          clearTimers()
          setWidgetId(id)
          widgetIdRef.current = id
        } catch {
          fail()
        }
      }

      const checkInterval = window.setInterval(checkTurnstile, 100)

      const loadTimeout = window.setTimeout(
        fail,
        TURNSTILE_SCRIPT_LOAD_TIMEOUT_MS
      )

      checkTurnstile()

      return () => {
        didFinish = true
        clearTimers()

        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.remove(widgetIdRef.current)
          widgetIdRef.current = null
          setWidgetId(null)
        }
      }
    }

    return undefined
  }, [])

  // Hide when verified to clean up UI, but keep mounted if needed (logic specific to use case)
  if (isVerified) {
    return null
  }

  return <div ref={containerRef} className="min-h-[65px] min-w-[300px]" />
})

TurnstileWidget.displayName = "TurnstileWidget"
