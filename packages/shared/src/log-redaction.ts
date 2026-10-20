const REDACTED = "[REDACTED]"

const SENSITIVE_QUERY_PREFIXES = ["x-amz-", "x-goog-"] as const

const SENSITIVE_QUERY_KEYS = {
  token: true,
  sig: true,
  signature: true,
  key: true,
  auth: true,
  authorization: true,
  expires: true,
  api_key: true,
  apikey: true,
  access_token: true,
  id_token: true,
  refresh_token: true,
}

export const sensitiveQueryPattern = new RegExp(
  `\\b(${[
    ...Object.keys(SENSITIVE_QUERY_KEYS),
    ...SENSITIVE_QUERY_PREFIXES.map((prefix) => `${prefix}[\\w-]+`),
  ].join("|")})=([^&\\s]+)`,
  "gi"
)

export interface SensitiveLogObject {
  [key: string]: SensitiveLogValue
}

export type SensitiveLogValue =
  | undefined
  | string
  | number
  | boolean
  | null
  | Date
  | readonly SensitiveLogValue[]
  | SensitiveLogObject

const isLikelyAbsoluteUrl = (value: string) =>
  /^https?:\/\//i.test(value.trim())

export const isSensitiveQueryParam = (param: string) => {
  const normalized = param.trim().toLowerCase()

  if (Object.hasOwn(SENSITIVE_QUERY_KEYS, normalized)) {
    return true
  }

  return SENSITIVE_QUERY_PREFIXES.some(
    (prefix) => normalized.slice(0, prefix.length) === prefix
  )
}

export const redactSensitiveUrl = (rawUrl: string) => {
  if (!isLikelyAbsoluteUrl(rawUrl)) {
    return rawUrl
  }

  try {
    const parsed = new URL(rawUrl)
    const keys: string[] = []
    parsed.searchParams.forEach((_value, key) => {
      if (keys.indexOf(key) === -1) {
        keys.push(key)
      }
    })

    for (let index = 0; index < keys.length; index += 1) {
      const key = keys[index]

      if (isSensitiveQueryParam(key)) {
        parsed.searchParams.set(key, REDACTED)
      }
    }

    return parsed.toString()
  } catch {
    return rawUrl
  }
}

export const summarizeSensitiveToken = (token: string | null | undefined) => {
  const normalized = token?.trim() ?? ""

  return {
    tokenPresent: normalized.length > 0,
    tokenLength: normalized.length,
  }
}
