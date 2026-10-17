import { extractFirstFileFromArchive as inspectFirstArchiveFile } from "@mediapeek/shared/archive-inspection"
import { z } from "zod"

export type MediaInfoData =
  | string
  | number
  | boolean
  | null
  | undefined
  | MediaInfoData[]
  | MediaInfoDataObject

interface MediaInfoDataObject {
  [key: string]: MediaInfoData
}

export const MediaInfoDataSchema: z.ZodType<MediaInfoData> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.undefined(),
    z.array(MediaInfoDataSchema),
    z.record(z.string(), MediaInfoDataSchema),
  ])
)

const mediaInfoObjectSchema = z.record(z.string(), MediaInfoDataSchema)

const mediaInfoTrackSchema = z
  .object({
    "@type": z.string(),
    CompleteName: z.string().optional(),
    Complete_name: z.string().optional(),
    File_Name: z.string().optional(),
    Title: z.string().optional(),
    Movie: z.string().optional(),
    Archive_Name: z.string().optional(),
    Archive_Sizing_Status: z.enum(["verified", "estimated"]).optional(),
    Archive_Sizing_Source: z
      .enum([
        "zip-local-header",
        "zip-central-directory",
        "tar-header",
        "unknown",
      ])
      .optional(),
    Archive_Sizing_Warning: z.string().optional(),
  })
  .catchall(MediaInfoDataSchema)

export const mediaInfoResultSchema = z
  .object({
    media: z
      .object({
        track: z.array(mediaInfoTrackSchema).optional(),
      })
      .catchall(MediaInfoDataSchema)
      .optional(),
  })
  .catchall(MediaInfoDataSchema)

export type MediaInfoResult = z.output<typeof mediaInfoResultSchema>

/** Recursively unwrap MediaInfo `{ "#value": ... }` metadata wrappers. */
export const normalizeMediaInfo = (data: MediaInfoData): MediaInfoData => {
  if (Array.isArray(data)) {
    return data.map((item) => normalizeMediaInfo(item))
  }

  const objectResult = mediaInfoObjectSchema.safeParse(data)

  if (!objectResult.success) {
    return data
  }

  const mediaInfoObject = objectResult.data
  const wrappedValue = mediaInfoObject["#value"]

  if (wrappedValue !== undefined) {
    return normalizeMediaInfo(wrappedValue)
  }

  const normalized: MediaInfoDataObject = {}

  for (const [key, value] of Object.entries(mediaInfoObject)) {
    normalized[key] =
      value === undefined ? undefined : normalizeMediaInfo(value)
  }

  return normalized
}

export function extractFirstFileFromArchive(buffer: Uint8Array): string | null {
  return inspectFirstArchiveFile(buffer)
}

export const isArchiveExtension = (filename: string): boolean => {
  const extension = filename.split(".").pop()?.toLowerCase() ?? ""

  return ["zip", "tar", "rar", "7z", "gz", "bz2", "xz"].includes(extension)
}
