import { readStreamBytesWithinLimit } from "@mediapeek/shared/bounded-stream-read"
import { Result, Schema } from "effect"

import type { AnalysisPolicyInput } from "~/services/analysis-policy.server"

interface ParsedAnalyzeInput {
  readonly policyInput: AnalysisPolicyInput
  readonly legacyGet: boolean
}

interface OversizedAnalyzeInput {
  readonly bodyTooLarge: true
  readonly legacyGet: false
}

type AnalyzeInputParseResult = ParsedAnalyzeInput | OversizedAnalyzeInput

type AnalyzeBodyReadResult =
  | { readonly kind: "body-too-large" }
  | { readonly kind: "invalid-json" }
  | { readonly kind: "body"; readonly value: unknown }

export const MAX_ANALYZE_BODY_BYTES = 8_192

type AnalyzeQueryInput = typeof Schema.JsonObject.Type & {
  url: string | null
  format?: string[]
}

const createPolicyInput = (
  input: typeof Schema.JsonObject.Type,
  legacyGet: boolean,
  parseError?: string
): ParsedAnalyzeInput => {
  if (parseError) {
    return { policyInput: { input: {}, parseError }, legacyGet }
  }

  const { format } = input

  const normalizedInput = Schema.is(Schema.String)(format)
    ? { ...input, format: [format] }
    : input

  return { policyInput: { input: normalizedInput }, legacyGet }
}

const readAnalyzeBody = async (
  request: Request
): Promise<AnalyzeBodyReadResult> => {
  const contentLength = request.headers.get("content-length")

  if (
    contentLength !== null &&
    Number(contentLength) > MAX_ANALYZE_BODY_BYTES
  ) {
    return { kind: "body-too-large" }
  }

  const reader = request.body?.getReader()

  if (!reader) {
    return { kind: "invalid-json" }
  }

  try {
    const bytes = await readStreamBytesWithinLimit({
      reader,
      maxBytes: MAX_ANALYZE_BODY_BYTES,
      overflow: "reject",
      signal: request.signal,
    })

    if (bytes === null) {
      return { kind: "body-too-large" }
    }

    return {
      kind: "body",
      value: JSON.parse(new TextDecoder().decode(bytes)),
    }
  } catch {
    return { kind: "invalid-json" }
  } finally {
    reader.releaseLock()
  }
}

const parsePostAnalyzeInput = async (
  request: Request
): Promise<AnalyzeInputParseResult> => {
  const body = await readAnalyzeBody(request)

  if (body.kind === "body-too-large") {
    return { bodyTooLarge: true, legacyGet: false }
  }

  if (body.kind === "invalid-json") {
    return createPolicyInput({}, false, "Invalid JSON body.")
  }

  const decodedObject = Schema.decodeUnknownResult(Schema.JsonObject)(
    body.value
  )

  if (Result.isFailure(decodedObject)) {
    return createPolicyInput(
      {},
      false,
      "Invalid JSON body. Expected an object payload."
    )
  }

  return createPolicyInput(decodedObject.success, false)
}

export const parseAnalyzeInput = async (
  request: Request,
  url: URL
): Promise<AnalyzeInputParseResult> => {
  if (request.method === "POST") {
    return parsePostAnalyzeInput(request)
  }

  const queryInput: AnalyzeQueryInput = {
    url: url.searchParams.get("url"),
  }

  if (url.searchParams.has("format")) {
    queryInput.format = url.searchParams.getAll("format")
  }

  return createPolicyInput(queryInput, true)
}
