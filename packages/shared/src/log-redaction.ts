import { z } from "zod"

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
  | SensitiveLogValue[]
  | SensitiveLogObject

export const SensitiveLogValueSchema: z.ZodType<SensitiveLogValue> = z.lazy(
  () =>
    z.union([
      z.undefined(),
      z.string(),
      z.number(),
      z.boolean(),
      z.null(),
      z.date(),
      z.array(SensitiveLogValueSchema),
      z.record(z.string(), SensitiveLogValueSchema),
    ])
)

const SENSITIVE_FIELD_PATTERNS = [
  /token/i,
  /secret/i,
  /api[-_]?key/i,
  /authorization/i,
  /cookie/i,
  /password/i,
  /signature/i,
]

const SENSITIVE_LOG_STRING_SCHEMA = z.string()

const isPlainObject = (value: SensitiveLogValue): value is SensitiveLogObject =>
  value !== undefined &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date) &&
  (Object.getPrototypeOf(value) === Object.prototype ||
    Object.getPrototypeOf(value) === null)

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

const isSensitiveFieldName = (key: string) =>
  SENSITIVE_FIELD_PATTERNS.some((pattern) => pattern.test(key))

const redactString = (value: string) =>
  (isLikelyAbsoluteUrl(value) ? redactSensitiveUrl(value) : value).replaceAll(
    /\b(token|sig|signature|key|auth|authorization|expires|api_key|apikey|access_token|id_token|refresh_token|x-amz-[\w-]+|x-goog-[\w-]+)=([^&\s]+)/gi,
    (_, name: string) => `${name}=${REDACTED}`
  )

const redactInternal = (
  value: SensitiveLogValue,
  keyHint?: string
): SensitiveLogValue => {
  const stringValue = SENSITIVE_LOG_STRING_SCHEMA.safeParse(value)

  if (stringValue.success) {
    if (keyHint && isSensitiveFieldName(keyHint)) {
      return REDACTED
    }

    return redactString(stringValue.data)
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactInternal(entry))
  }

  if (!isPlainObject(value)) {
    return value
  }

  const result: SensitiveLogObject = {}

  for (const [key, nested] of Object.entries(value)) {
    result[key] = isSensitiveFieldName(key)
      ? REDACTED
      : redactInternal(nested, key)
  }

  return result
}

export const redactSensitiveLogData = (value: SensitiveLogValue) =>
  redactInternal(value)

export const summarizeSensitiveToken = (token: string | null | undefined) => {
  const normalized = token?.trim() ?? ""

  return {
    tokenPresent: normalized.length > 0,
    tokenLength: normalized.length,
  }
}
