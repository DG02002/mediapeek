import { ValidationFailureError } from "./error-utils"

export { extractFilenameFromUrl } from "@mediapeek/shared/filename-resolution"

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "metadata.google.internal",
])

// Headers are static, so we can reuse the same object or recreate from a static init.
// However, Headers API is mutable, so returning a fresh instance is safer if callers modify it.
// But we can define the static values once.
const EMULATION_HEADERS_INIT = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "accept-language": "en-US,en;q=0.9",
  priority: "u=0, i",
  "sec-ch-ua":
    '"Google Chrome";v="155", "Chromium";v="155", "Not A(Brand";v="24"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"macOS"',
  "sec-fetch-dest": "document",
  "sec-fetch-mode": "navigate",
  "sec-fetch-site": "none",
  "sec-fetch-user": "?1",
  "upgrade-insecure-requests": "1",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
}

export const validateUrl = (url: string) => {
  const parsedUrl = new URL(url)

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new ValidationFailureError(
      "Invalid URL: Only HTTP and HTTPS sources are supported."
    )
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new ValidationFailureError(
      "Invalid URL: Embedded credentials are not allowed."
    )
  }

  const host = parsedUrl.hostname
    .toLowerCase()
    .replaceAll(/^\[|\]$/g, "")
    .replace(/\.+$/, "")

  if (BLOCKED_HOSTS.has(host) || isBlockedIpLiteral(host)) {
    throw new ValidationFailureError(
      "Invalid URL: Access to local, private, or reserved resources is denied."
    )
  }
}

const isBlockedIpv4 = (host: string) => {
  const parts = host.split(".")

  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) {
    return false
  }

  const octets = parts.map(Number)

  if (octets.some((part) => part > 255)) {
    return false
  }

  const value = octets.reduce((result, octet) => (result << 8) + octet, 0) >>> 0

  const inRange = (network: number, bits: number) =>
    bits === 0 || value >>> (32 - bits) === network >>> (32 - bits)

  return [
    [0x00000000, 8],
    [0x0a000000, 8],
    [0x64400000, 10],
    [0x7f000000, 8],
    [0xa9fe0000, 16],
    [0xac100000, 12],
    [0xc0000000, 24],
    [0xc0000200, 24],
    [0xc0a80000, 16],
    [0xc6120000, 15],
    [0xc6336400, 24],
    [0xcb007100, 24],
    [0xe0000000, 4],
    [0xf0000000, 4],
  ].some(([network, bits]) => inRange(network, bits))
}

const expandIpv6Groups = (raw: string) =>
  raw
    ? raw.split(":").flatMap((part) => {
        if (!part.includes(".")) {
          return [part]
        }

        const octets = part.split(".").map(Number)

        if (
          octets.length !== 4 ||
          octets.some(
            (value) => !Number.isInteger(value) || value < 0 || value > 255
          )
        ) {
          return ["invalid"]
        }

        return [
          ((octets[0] << 8) | octets[1]).toString(16),
          ((octets[2] << 8) | octets[3]).toString(16),
        ]
      })
    : []

const parseIpv6 = (host: string): bigint | null => {
  if (!host.includes(":")) {
    return null
  }

  const [leftRaw, rightRaw = ""] = host.split("::")

  if (host.split("::").length > 2) {
    return null
  }

  const left = expandIpv6Groups(leftRaw)
  const right = expandIpv6Groups(rightRaw)
  const missing = 8 - left.length - right.length

  if (
    (host.includes("::") && missing < 1) ||
    (!host.includes("::") && missing !== 0)
  ) {
    return null
  }

  const groups = [
    ...left,
    ...Array.from({ length: missing }, () => "0"),
    ...right,
  ]

  if (groups.some((group) => !/^[\da-f]{1,4}$/i.test(group))) {
    return null
  }

  return groups.reduce(
    (value, group) => (value << 16n) | BigInt(`0x${group}`),
    0n
  )
}

const isBlockedIpLiteral = (host: string) => {
  if (isBlockedIpv4(host)) {
    return true
  }

  const value = parseIpv6(host)

  if (value === null) {
    return host.includes(":")
  }

  // nip.io-style names that resolve privately are accepted; production fetches are edge-routed.
  const prefix = (network: bigint, bits: bigint) =>
    value >> (128n - bits) === network >> (128n - bits)

  return (
    value === 0n ||
    value === 1n ||
    prefix(0xfc00n << 112n, 7n) ||
    prefix(0xfe80n << 112n, 10n) ||
    prefix(0xff00n << 112n, 8n) ||
    prefix(0x20010db8n << 96n, 32n) ||
    prefix(0x20010000n << 96n, 32n) ||
    prefix(0x2002n << 112n, 16n) ||
    prefix(0n, 96n) ||
    prefix(0xffffn << 32n, 96n)
  )
}

export const getEmulationHeaders = (range?: string): Headers => {
  const headers = new Headers(EMULATION_HEADERS_INIT)

  if (range) {
    headers.set("Range", range)
  }

  return headers
}

/**
 * Checks if the filename has an archive extension.
 */
export const isArchiveExtension = (filename: string): boolean => {
  const ext = filename.split(".").pop()?.toLowerCase() ?? ""

  return ["zip", "tar", "rar", "7z", "gz", "bz2", "xz"].includes(ext)
}
