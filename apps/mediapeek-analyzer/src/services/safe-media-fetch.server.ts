import { AnalyzerError } from "../lib/error-utils"
import { validateUrl } from "../lib/server-utils"

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
const MAX_REDIRECTS = 5

type SafeMediaFetchOptions = {
  currentUrl: URL
  init: RequestInit
  headers: Headers
  redirectCount: number
}

const getFetchError = (cause: unknown, signal?: AbortSignal) => {
  if (signal?.aborted) {
    if (
      signal.reason instanceof Error &&
      signal.reason.name === "TimeoutError"
    ) {
      return new AnalyzerError(
        "upstream-fetch",
        "Media source request timed out.",
        cause
      )
    }

    return signal.reason ?? cause
  }

  return new AnalyzerError(
    "upstream-fetch",
    "Unable to retrieve media source.",
    cause
  )
}

const followSafeMediaRedirects = async (
  options: SafeMediaFetchOptions
): Promise<Response> => {
  validateUrl(options.currentUrl.href)

  let response: Response

  try {
    response = await fetch(options.currentUrl, {
      ...options.init,
      headers: options.headers,
      redirect: "manual",
    })
  } catch (cause) {
    throw getFetchError(cause, options.init.signal ?? undefined)
  }

  if (!REDIRECT_STATUSES.has(response.status)) {
    return response
  }

  if (options.redirectCount >= MAX_REDIRECTS) {
    throw new AnalyzerError("upstream-fetch", "Too many media redirects.")
  }

  const location = response.headers.get("location")

  if (!location) {
    throw new AnalyzerError(
      "upstream-fetch",
      "Invalid media redirect: Missing Location header."
    )
  }

  let nextUrl: URL

  try {
    nextUrl = new URL(location, options.currentUrl)
  } catch {
    throw new AnalyzerError(
      "upstream-fetch",
      "Invalid media redirect: Invalid Location header."
    )
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
