import { Schema } from "effect"

export interface MediaStructureObject {
  readonly [key: string]: MediaStructureValue
}

export interface MediaStructureArray extends ReadonlyArray<MediaStructureValue> {}

export type MediaStructureValue =
  | null
  | boolean
  | number
  | string
  | MediaStructureArray
  | MediaStructureObject

export type MediaStructurePrimitive = boolean | number | string

const isJsonObject = Schema.is(Schema.JsonObject)
const isJsonValue = Schema.is(Schema.Json)
const isJsonArray = Schema.is(Schema.Array(Schema.Json))
const isJsonString = Schema.is(Schema.String)
const isJsonNumber = Schema.is(Schema.Number)
const isJsonBoolean = Schema.is(Schema.Boolean)

export const isMediaStructureRecord = <Value>(
  value: Value
): value is Value & MediaStructureObject => isJsonObject(value)

export const isMediaStructureValue = <Value>(
  value: Value
): value is Value & MediaStructureValue => isJsonValue(value)

export const isMediaStructureArray = <Value>(
  value: Value
): value is Value & MediaStructureArray => isJsonArray(value)

export const isMediaStructureString = <Value>(
  value: Value
): value is Value & string => isJsonString(value)

export const isMediaStructureNumber = <Value>(
  value: Value
): value is Value & number => isJsonNumber(value)

const isMediaStructureBoolean = <Value>(
  value: Value
): value is Value & boolean => isJsonBoolean(value)

export const isMediaStructurePrimitive = (
  value: unknown
): value is MediaStructurePrimitive =>
  isMediaStructureString(value) ||
  isMediaStructureNumber(value) ||
  isMediaStructureBoolean(value)

export const getMediaStructureString = (
  value: MediaStructureValue | undefined,
  key: string
): string | undefined => {
  if (isMediaStructureRecord(value)) {
    const property = value[key]

    return isMediaStructureString(property) ? property : undefined
  }

  return undefined
}

export const safeMediaStructureString = (
  value: MediaStructureValue | undefined
): string => {
  if (value === null || value === undefined) {
    return ""
  }

  if (isMediaStructureString(value)) {
    return value
  }

  if (isMediaStructureNumber(value) || isMediaStructureBoolean(value)) {
    return String(value)
  }

  if (isMediaStructureArray(value)) {
    return value.map(safeMediaStructureString).join(", ")
  }

  return "[Object]"
}

export const partitionMediaStructureEntries = (value: MediaStructureObject) => {
  const primitives: [string, MediaStructurePrimitive][] = []
  const complex: [string, MediaStructureValue][] = []

  for (const [key, property] of Object.entries(value)) {
    if (isMediaStructurePrimitive(property)) {
      primitives.push([key, property])
    } else if (property !== null && property !== undefined) {
      complex.push([key, property])
    }
  }

  return { primitives, complex }
}
