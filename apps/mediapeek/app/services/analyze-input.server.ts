import { Result, Schema } from "effect"

import type { AnalysisPolicyInput } from "~/services/analysis-policy.server"

export interface ParsedAnalyzeInput {
  readonly policyInput: AnalysisPolicyInput
  readonly legacyGet: boolean
}

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

export const parseAnalyzeInput = async (
  request: Request,
  url: URL
): Promise<ParsedAnalyzeInput> => {
  if (request.method === "POST") {
    try {
      const raw: unknown = await request.json()
      const decodedObject = Schema.decodeUnknownResult(Schema.JsonObject)(raw)

      if (Result.isFailure(decodedObject)) {
        return createPolicyInput(
          {},
          false,
          "Invalid JSON body. Expected an object payload."
        )
      }

      return createPolicyInput(decodedObject.success, false)
    } catch {
      return createPolicyInput({}, false, "Invalid JSON body.")
    }
  }

  const queryInput: AnalyzeQueryInput = {
    url: url.searchParams.get("url"),
  }

  if (url.searchParams.has("format")) {
    queryInput.format = url.searchParams.getAll("format")
  }

  return createPolicyInput(queryInput, true)
}
