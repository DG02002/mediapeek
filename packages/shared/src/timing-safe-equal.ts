type CloudflareSubtleCrypto = Omit<SubtleCrypto, "timingSafeEqual"> & {
  timingSafeEqual?: (
    left: ArrayBuffer | ArrayBufferView,
    right: ArrayBuffer | ArrayBufferView
  ) => boolean
}

const encoder = new TextEncoder()

export const timingSafeEqualStrings = async (
  left: string,
  right: string
): Promise<boolean> => {
  const [leftDigest, rightDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(left)),
    crypto.subtle.digest("SHA-256", encoder.encode(right)),
  ])

  // SAFETY: Workers provides this; other runtimes fail closed without a timing-safe fallback.
  const subtleCrypto = crypto.subtle as CloudflareSubtleCrypto

  if (!subtleCrypto.timingSafeEqual) {
    throw new Error("Constant-time comparison is unavailable in this runtime.")
  }

  return subtleCrypto.timingSafeEqual(leftDigest, rightDigest)
}
