import { validateUrl } from "../lib/server-utils"

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const MAX_REDIRECTS = 5

type SafeMediaFetchOptions = {
  currentUrl: URL
  init: RequestInit
  headers: Headers
  redirectCount: number
}

const followSafeMediaRedirects = async (
  options: SafeMediaFetchOptions
): Promise<Response> => {
  validateUrl(options.currentUrl.href)

  const response = await fetch(options.currentUrl, {
    ...options.init,
    headers: options.headers,
    redirect: "manual",
  })

  if (!REDIRECT_STATUSES.has(response.status)) {
    return response
  }

  if (options.redirectCount >= MAX_REDIRECTS) {
    throw new Error("Too many media redirects.")
  }

  const location = response.headers.get("location")

  if (!location) {
    throw new Error("Invalid media redirect: Missing Location header.")
  }

  let nextUrl: URL

  try {
    nextUrl = new URL(location, options.currentUrl)
  } catch {
    throw new Error("Invalid media redirect: Invalid Location header.")
  }

  validateUrl(nextUrl.href)

  return followSafeMediaRedirects({
    ...options,
    currentUrl: nextUrl,
    redirectCount: options.redirectCount + 1,
  })
}

export const safeMediaFetch = (
  input: string | URL,
  init: RequestInit = {}
): Promise<Response> =>
  followSafeMediaRedirects({
    currentUrl: new URL(input),
    init,
    headers: new Headers(init.headers),
    redirectCount: 0,
  })
