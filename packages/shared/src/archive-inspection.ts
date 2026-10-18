const ZIP_LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50
const ZIP_CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50
const UINT32_LIMIT = 0x100000000

export type ArchiveKind = "zip" | "tar"

export type ArchiveCompression = "stored" | "deflate" | "other"

export type ArchiveSizingStatus = "verified" | "estimated"

export type ArchiveSizingSource =
  | "zip-local-header"
  | "zip-central-directory"
  | "tar-header"
  | "unknown"

export const ARCHIVE_SIZING_WARNING =
  "Archive-backed analysis could not verify the inner file size. File size and bitrate may be inaccurate."

export interface ArchiveEntryInspection {
  name: string
  archiveKind: ArchiveKind
  compression: ArchiveCompression
  dataOffset?: number
  compressedSize?: number
  uncompressedSize?: number
  sizeStatus: ArchiveSizingStatus
  sizeSource: ArchiveSizingSource
}

interface ZipExtraInfo {
  compressedSize?: number
  uncompressedSize?: number
  localHeaderOffset?: number
}

interface ZipExtraRequirements {
  needsUncompressed: boolean
  needsCompressed: boolean
  needsOffset: boolean
}

interface ZipEntryFields extends ZipExtraRequirements {
  flags: number
  method: number
  compressedSize32: number
  uncompressedSize32: number
  localHeaderOffset32: number
  fileNameLength: number
  extraLength: number
  commentLength: number
}

interface ZipCentralDirectoryHeader {
  name: string
  fields: ZipEntryFields
  extra: Uint8Array
  nextOffset: number
}

interface ZipEntryOptions {
  name: string
  method: number
  compressedSize?: number
  uncompressedSize?: number
  dataOffset?: number
  hasDataDescriptor: boolean
  source: "zip-local-header" | "zip-central-directory"
}

interface ParsedZipEntry {
  entry: ArchiveEntryInspection
  nextOffset: number
}

interface ZipLocalHeader {
  name: string
  flags: number
  method: number
  compressedSize32: number
  uncompressedSize32: number
  extra: Uint8Array
  dataOffset: number
  headerSize: number
}

const isZip = (buffer: Uint8Array) =>
  buffer.byteLength > 4 &&
  buffer[0] === 0x50 &&
  buffer[1] === 0x4b &&
  buffer[2] === 0x03 &&
  buffer[3] === 0x04

const isTar = (buffer: Uint8Array) => {
  if (buffer.byteLength <= 262) {
    return false
  }

  const ustarMagic = new TextDecoder().decode(buffer.subarray(257, 262))

  return ustarMagic === "ustar"
}

const endsWithSlash = (value: string) =>
  value.slice(Math.max(0, value.length - 1)) === "/"

const readZip64Value = (data: Uint8Array, offset: number) => {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const low = view.getUint32(offset, true)
  const high = view.getUint32(offset + 4, true)

  return high * UINT32_LIMIT + low
}

const readZip64ExtraValues = ({
  extra,
  fieldStart,
  fieldEnd,
  ...requirements
}: ZipExtraRequirements & {
  extra: Uint8Array
  fieldStart: number
  fieldEnd: number
}): ZipExtraInfo => {
  let cursor = fieldStart
  const result: ZipExtraInfo = {}

  if (requirements.needsUncompressed && cursor + 8 <= fieldEnd) {
    result.uncompressedSize = readZip64Value(extra, cursor)
    cursor += 8
  }

  if (requirements.needsCompressed && cursor + 8 <= fieldEnd) {
    result.compressedSize = readZip64Value(extra, cursor)
    cursor += 8
  }

  if (requirements.needsOffset && cursor + 8 <= fieldEnd) {
    result.localHeaderOffset = readZip64Value(extra, cursor)
  }

  return result
}

const parseZipExtraInfo = (
  extra: Uint8Array,
  requirements: ZipExtraRequirements
): ZipExtraInfo => {
  const view = new DataView(extra.buffer, extra.byteOffset, extra.byteLength)
  let offset = 0

  while (offset + 4 <= extra.byteLength) {
    const headerId = view.getUint16(offset, true)
    const fieldSize = view.getUint16(offset + 2, true)
    const fieldStart = offset + 4
    const fieldEnd = fieldStart + fieldSize

    if (fieldEnd > extra.byteLength) {
      break
    }

    if (headerId === 0x0001) {
      return readZip64ExtraValues({
        extra,
        fieldStart,
        fieldEnd,
        ...requirements,
      })
    }

    offset = fieldEnd
  }

  return {}
}

const mapZipCompression = (method: number): ArchiveCompression => {
  if (method === 0) {
    return "stored"
  }

  if (method === 8) {
    return "deflate"
  }

  return "other"
}

const readZipEntryFields = (view: DataView, offset: number): ZipEntryFields => {
  const flags = view.getUint16(offset + 8, true)
  const compressedSize32 = view.getUint32(offset + 20, true)
  const uncompressedSize32 = view.getUint32(offset + 24, true)
  const localHeaderOffset32 = view.getUint32(offset + 42, true)

  return {
    flags,
    method: view.getUint16(offset + 10, true),
    compressedSize32,
    uncompressedSize32,
    localHeaderOffset32,
    fileNameLength: view.getUint16(offset + 28, true),
    extraLength: view.getUint16(offset + 30, true),
    commentLength: view.getUint16(offset + 32, true),
    needsUncompressed: uncompressedSize32 === 0xffffffff,
    needsCompressed: compressedSize32 === 0xffffffff,
    needsOffset: localHeaderOffset32 === 0xffffffff,
  }
}

const createZipEntry = ({
  name,
  method,
  compressedSize,
  uncompressedSize,
  dataOffset,
  hasDataDescriptor,
  source,
}: ZipEntryOptions): ArchiveEntryInspection => {
  const hasVerifiedSize = !hasDataDescriptor && uncompressedSize !== undefined

  return {
    name,
    archiveKind: "zip",
    compression: mapZipCompression(method),
    compressedSize,
    uncompressedSize,
    dataOffset,
    sizeStatus: hasVerifiedSize ? "verified" : "estimated",
    sizeSource: hasVerifiedSize ? source : "unknown",
  }
}

const parseCentralDirectoryHeader = (
  buffer: Uint8Array,
  offset: number
): ZipCentralDirectoryHeader | null => {
  if (offset + 46 > buffer.byteLength) {
    return null
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)

  if (view.getUint32(offset, true) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
    return null
  }

  const fields = readZipEntryFields(view, offset)
  const fileNameStart = offset + 46
  const extraStart = fileNameStart + fields.fileNameLength
  const nextOffset = extraStart + fields.extraLength + fields.commentLength

  if (nextOffset > buffer.byteLength) {
    return null
  }

  return {
    name: new TextDecoder().decode(
      buffer.subarray(fileNameStart, extraStart - fields.extraLength)
    ),
    fields,
    extra: buffer.subarray(extraStart, extraStart + fields.extraLength),
    nextOffset,
  }
}

const parseCentralDirectoryEntry = (
  buffer: Uint8Array,
  offset: number
): ParsedZipEntry | null => {
  const header = parseCentralDirectoryHeader(buffer, offset)

  if (!header) {
    return null
  }

  const { fields } = header
  const zip64 = parseZipExtraInfo(header.extra, fields)

  const compressedSize =
    fields.compressedSize32 === 0xffffffff
      ? zip64.compressedSize
      : fields.compressedSize32

  const uncompressedSize =
    fields.uncompressedSize32 === 0xffffffff
      ? zip64.uncompressedSize
      : fields.uncompressedSize32

  return {
    entry: createZipEntry({
      name: header.name,
      method: fields.method,
      compressedSize,
      uncompressedSize,
      dataOffset: zip64.localHeaderOffset ?? fields.localHeaderOffset32,
      hasDataDescriptor: (fields.flags & 0x08) !== 0,
      source: "zip-central-directory",
    }),
    nextOffset: header.nextOffset,
  }
}

const findZipCentralDirectoryEntry = (
  tailBuffer: Uint8Array,
  name: string
): ArchiveEntryInspection | null => {
  const view = new DataView(
    tailBuffer.buffer,
    tailBuffer.byteOffset,
    tailBuffer.byteLength
  )

  for (let offset = 0; offset + 46 <= tailBuffer.byteLength;) {
    if (view.getUint32(offset, true) !== ZIP_CENTRAL_DIRECTORY_SIGNATURE) {
      offset += 1
      continue
    }

    const parsed = parseCentralDirectoryEntry(tailBuffer, offset)

    if (!parsed) {
      break
    }

    if (parsed.entry.name === name && !endsWithSlash(name)) {
      return parsed.entry
    }

    offset = parsed.nextOffset
  }

  return null
}

const readLocalZipHeader = (
  buffer: Uint8Array,
  offset: number
): ZipLocalHeader | null => {
  if (offset + 30 > buffer.byteLength) {
    return null
  }

  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)

  if (view.getUint32(offset, true) !== ZIP_LOCAL_FILE_HEADER_SIGNATURE) {
    return null
  }

  const flags = view.getUint16(offset + 6, true)
  const method = view.getUint16(offset + 8, true)
  const compressedSize32 = view.getUint32(offset + 18, true)
  const uncompressedSize32 = view.getUint32(offset + 22, true)
  const fileNameLength = view.getUint16(offset + 26, true)
  const extraLength = view.getUint16(offset + 28, true)
  const fileNameStart = offset + 30
  const extraStart = fileNameStart + fileNameLength
  const dataOffset = extraStart + extraLength

  if (dataOffset > buffer.byteLength) {
    return null
  }

  return {
    name: new TextDecoder().decode(buffer.subarray(fileNameStart, extraStart)),
    flags,
    method,
    compressedSize32,
    uncompressedSize32,
    extra: buffer.subarray(extraStart, dataOffset),
    dataOffset,
    headerSize: 30 + fileNameLength + extraLength,
  }
}

const parseLocalZipEntry = (
  buffer: Uint8Array,
  offset: number
): ParsedZipEntry | null => {
  const header = readLocalZipHeader(buffer, offset)

  if (!header) {
    return null
  }

  const needsUncompressed = header.uncompressedSize32 === 0xffffffff
  const needsCompressed = header.compressedSize32 === 0xffffffff

  const zip64 = parseZipExtraInfo(header.extra, {
    needsUncompressed,
    needsCompressed,
    needsOffset: false,
  })

  const compressedSize =
    header.compressedSize32 === 0xffffffff
      ? zip64.compressedSize
      : header.compressedSize32

  const uncompressedSize =
    header.uncompressedSize32 === 0xffffffff
      ? zip64.uncompressedSize
      : header.uncompressedSize32

  const hasDataDescriptor = (header.flags & 0x08) !== 0

  const entry = createZipEntry({
    name: header.name,
    method: header.method,
    compressedSize,
    uncompressedSize,
    dataOffset: header.dataOffset,
    hasDataDescriptor,
    source: "zip-local-header",
  })

  const skipSize = hasDataDescriptor ? 0 : (compressedSize ?? 0)

  return {
    entry,
    nextOffset: offset + header.headerSize + skipSize,
  }
}

const verifyZipEntrySize = (
  entry: ArchiveEntryInspection,
  tailBuffer: Uint8Array | undefined
): ArchiveEntryInspection => {
  if (entry.sizeStatus !== "estimated" || !tailBuffer) {
    return entry
  }

  const centralDirectoryEntry = findZipCentralDirectoryEntry(
    tailBuffer,
    entry.name
  )

  if (
    centralDirectoryEntry?.uncompressedSize === undefined ||
    centralDirectoryEntry.compressedSize === undefined
  ) {
    return entry
  }

  return {
    ...entry,
    compressedSize: centralDirectoryEntry.compressedSize,
    uncompressedSize: centralDirectoryEntry.uncompressedSize,
    sizeStatus: "verified",
    sizeSource: "zip-central-directory",
  }
}

const inspectZipArchiveEntry = (
  buffer: Uint8Array,
  tailBuffer?: Uint8Array
): ArchiveEntryInspection | null => {
  let offset = 0

  while (offset + 30 <= buffer.byteLength) {
    const parsed = parseLocalZipEntry(buffer, offset)

    if (!parsed) {
      return null
    }

    if (!endsWithSlash(parsed.entry.name)) {
      return verifyZipEntrySize(parsed.entry, tailBuffer)
    }

    offset = parsed.nextOffset
  }

  return null
}

const readTarString = (buffer: Uint8Array, start: number, length: number) => {
  let end = start
  const limit = Math.min(start + length, buffer.byteLength)

  while (end < limit && buffer[end] !== 0) {
    end += 1
  }

  return new TextDecoder().decode(buffer.subarray(start, end))
}

const readTarSize = (buffer: Uint8Array, offset: number) => {
  const sizeStr = readTarString(buffer, offset + 124, 12).trim()

  return parseInt(sizeStr || "0", 8) || 0
}

interface TarEntryHeader {
  typeFlag: string
  size: number
  dataOffset: number
  paddedSize: number
  defaultName: string
  name: string
}

const readTarEntryHeader = (
  buffer: Uint8Array,
  offset: number,
  nextNameOverride: string | null
): TarEntryHeader => {
  const typeFlag = String.fromCharCode(buffer[offset + 156] ?? 0)
  const size = readTarSize(buffer, offset)
  const dataOffset = offset + 512
  const paddedSize = Math.ceil(size / 512) * 512
  const defaultName = readTarString(buffer, offset, 100)

  return {
    typeFlag,
    size,
    dataOffset,
    paddedSize,
    defaultName,
    name: nextNameOverride ?? defaultName,
  }
}

const readTarLongName = (
  buffer: Uint8Array,
  header: TarEntryHeader
): { name: string; nextOffset: number } | null => {
  if (header.dataOffset + header.size > buffer.byteLength) {
    return null
  }

  return {
    name: readTarString(buffer, header.dataOffset, header.size),
    nextOffset: header.dataOffset + header.paddedSize,
  }
}

const inspectTarArchiveEntry = (
  buffer: Uint8Array
): ArchiveEntryInspection | null => {
  let offset = 0
  let nextNameOverride: string | null = null

  while (offset + 512 <= buffer.byteLength) {
    const header = readTarEntryHeader(buffer, offset, nextNameOverride)
    nextNameOverride = null

    if (!header.defaultName) {
      offset += 512
      continue
    }

    if (header.typeFlag === "L") {
      const longName = readTarLongName(buffer, header)

      if (!longName) {
        return null
      }

      nextNameOverride = longName.name
      offset = longName.nextOffset
      continue
    }

    if (header.typeFlag !== "5" && header.name && !endsWithSlash(header.name)) {
      return {
        name: header.name,
        archiveKind: "tar",
        compression: "stored",
        dataOffset: header.dataOffset,
        compressedSize: header.size,
        uncompressedSize: header.size,
        sizeStatus: "verified",
        sizeSource: "tar-header",
      }
    }

    offset = header.dataOffset + header.paddedSize
  }

  return null
}

export interface InspectArchiveEntryOptions {
  tailBuffer?: Uint8Array
}

export const inspectArchiveEntry = (
  buffer: Uint8Array,
  options: InspectArchiveEntryOptions = {}
): ArchiveEntryInspection | null => {
  if (isZip(buffer)) {
    return inspectZipArchiveEntry(buffer, options.tailBuffer)
  }

  if (isTar(buffer)) {
    return inspectTarArchiveEntry(buffer)
  }

  return null
}

export const extractFirstFileFromArchive = (buffer: Uint8Array) =>
  inspectArchiveEntry(buffer)?.name ?? null
