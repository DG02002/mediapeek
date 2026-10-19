export const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/

const REQUEST_ID_HEADERS = ["x-request-id", "x-mediapeek-request-id"]

export const getRequestId = (request: Request): string => {
  for (const header of REQUEST_ID_HEADERS) {
    const requestId = request.headers.get(header)?.trim()

    if (requestId && REQUEST_ID_PATTERN.test(requestId)) {
      return requestId
    }
  }

  const cloudflareRay = request.headers.get("cf-ray")?.trim()

  if (cloudflareRay && REQUEST_ID_PATTERN.test(cloudflareRay)) {
    return cloudflareRay
  }

  return crypto.randomUUID()
}
