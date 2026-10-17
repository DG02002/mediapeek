import { useCallback, useEffect, useRef, useState } from "react"

import type { TurnstileWidgetHandle } from "~/components/turnstile-widget"

export const useTurnstileVerification = () => {
  const [isOpen, setIsOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const widgetRef = useRef<TurnstileWidgetHandle>(null)
  const tokenResolverRef = useRef<((token: string | null) => void) | null>(null)
  const tokenPromiseRef = useRef<Promise<string | null> | null>(null)

  const enabled =
    typeof window !== "undefined" ? window.ENV.TURNSTILE_ENABLED : false

  const settle = useCallback((token: string | null) => {
    const resolve = tokenResolverRef.current
    tokenResolverRef.current = null
    tokenPromiseRef.current = null
    resolve?.(token)
  }, [])

  const requestToken = useCallback(async () => {
    if (!enabled) {
      return null
    }

    if (tokenPromiseRef.current) {
      return tokenPromiseRef.current
    }

    widgetRef.current?.reset()

    if (inputRef.current) {
      inputRef.current.value = ""
    }

    setIsOpen(true)

    const tokenPromise = new Promise<string | null>((resolve) => {
      tokenResolverRef.current = resolve
    })

    tokenPromiseRef.current = tokenPromise

    return tokenPromise
  }, [enabled])

  useEffect(() => () => settle(null), [settle])

  return {
    enabled,
    inputRef,
    widgetRef,
    isOpen,
    setIsOpen,
    settle,
    requestToken,
  }
}
