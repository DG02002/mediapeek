interface ContentSecurityPolicyOptions {
  isDevelopment: boolean
  turnstileEnabled: boolean
  nonce: string
}

export const createContentSecurityPolicy = ({
  isDevelopment,
  turnstileEnabled,
  nonce,
}: ContentSecurityPolicyOptions) => {
  const turnstileOrigin = turnstileEnabled
    ? " https://challenges.cloudflare.com"
    : ""

  return isDevelopment
    ? `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https: blob:${turnstileOrigin}; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https: blob:; font-src 'self' https: data:; connect-src 'self' https: ws: wss:; worker-src 'self' blob:; frame-src 'self'${turnstileOrigin};`
    : `default-src 'self'; script-src 'self' 'nonce-${nonce}'${turnstileOrigin}; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; font-src 'self' https: data:; connect-src 'self' https:; frame-src 'self'${turnstileOrigin};`
}
