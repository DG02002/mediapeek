import { Schema } from "effect"

export const AnalysisOutputIdSchema = Schema.Literals([
  "json",
  "text",
  "xml",
  "html",
])

export type AnalysisOutputId = typeof AnalysisOutputIdSchema.Type

export type AnalysisOutputResults = Partial<Record<AnalysisOutputId, string>>

export const AnalysisOutputRequestSchema = Schema.Literals([
  "object",
  "JSON",
  "json",
  "Text",
  "text",
  "XML",
  "xml",
  "HTML",
  "html",
])

export type AnalysisOutputRequest = typeof AnalysisOutputRequestSchema.Type

export interface AnalysisOutputChoice {
  id: AnalysisOutputId
  label: "JSON" | "Text" | "XML" | "HTML"
}

interface MediaInfoOutputTarget {
  options: {
    format?: string
    full?: boolean
  }
}

const definitions = {
  json: {
    aliases: ["object", "JSON", "json"],
    generationName: "object",
    label: "JSON",
    mediaInfo: { format: "object", full: true },
  },
  text: {
    aliases: ["Text", "text"],
    generationName: "Text",
    label: "Text",
    mediaInfo: { format: "text", full: true },
  },
  xml: {
    aliases: ["XML", "xml"],
    generationName: "XML",
    label: "XML",
    mediaInfo: { format: "XML", full: false },
  },
  html: {
    aliases: ["HTML", "html"],
    generationName: "HTML",
    label: "HTML",
    mediaInfo: { format: "HTML", full: false },
  },
} as const satisfies Record<
  AnalysisOutputId,
  {
    aliases: readonly AnalysisOutputRequest[]
    generationName: string
    label: AnalysisOutputChoice["label"]
    mediaInfo: { format: string; full: boolean }
  }
>

const formatIds = ["json", "text", "xml", "html"] as const

const effectAliases = {
  object: "json",
  JSON: "json",
  json: "json",
  Text: "text",
  text: "text",
  XML: "xml",
  xml: "xml",
  HTML: "html",
  html: "html",
} satisfies Record<AnalysisOutputRequest, AnalysisOutputId>

const decodeAnalysisOutputSelection = Schema.decodeUnknownSync(
  Schema.UniqueArray(AnalysisOutputRequestSchema).pipe(
    Schema.check(Schema.isMinLength(1), Schema.isMaxLength(5))
  )
)

const canonicalizeEffectOutputRequests = (
  requests: ReadonlyArray<AnalysisOutputRequest>
): readonly AnalysisOutputId[] => [
  ...new Set(requests.map((request) => effectAliases[request])),
]

const choices = Object.freeze(
  formatIds.map((id) =>
    Object.freeze({
      id,
      label: definitions[id].label,
    })
  )
)

export const analysisOutputFormats = Object.freeze({
  parse(
    input: Parameters<typeof decodeAnalysisOutputSelection>[0]
  ): readonly AnalysisOutputId[] {
    if (input === undefined) {
      return canonicalizeEffectOutputRequests(["JSON"])
    }

    return canonicalizeEffectOutputRequests(
      decodeAnalysisOutputSelection(input)
    )
  },

  choices(): readonly AnalysisOutputChoice[] {
    return choices
  },

  configure(id: AnalysisOutputId, target: MediaInfoOutputTarget): string {
    const definition = definitions[id]
    const configuration = definition.mediaInfo
    target.options.format = configuration.format
    target.options.full = configuration.full

    return definition.generationName
  },
})
