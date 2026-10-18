import { describe, expect, it } from "vitest"

import {
  ARCHIVE_SIZING_WARNING,
  extractFirstFileFromArchive,
  inspectArchiveEntry,
} from "./archive-inspection"

const writeUint64LE = (view: DataView, offset: number, value: number) => {
  view.setUint32(offset, value >>> 0, true)
  view.setUint32(offset + 4, Math.floor(value / 0x100000000), true)
}

const createLocalZipEntry = ({
  name,
  compressedSize,
  uncompressedSize,
  compressionMethod = 0,
  isDirectory = false,
  useDataDescriptor = false,
}: {
  name: string
  compressedSize: number
  uncompressedSize: number
  compressionMethod?: number
  isDirectory?: boolean
  useDataDescriptor?: boolean
}) => {
  const nameBytes = new TextEncoder().encode(name)
  const header = new Uint8Array(30 + nameBytes.length)
  const view = new DataView(header.buffer)

  view.setUint32(0, 0x04034b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(6, useDataDescriptor ? 0x08 : 0, true)
  view.setUint16(8, compressionMethod, true)
  view.setUint32(14, 0x12345678, true)
  view.setUint32(18, useDataDescriptor ? 0 : compressedSize, true)
  view.setUint32(22, useDataDescriptor ? 0 : uncompressedSize, true)
  view.setUint16(26, nameBytes.length, true)
  view.setUint16(28, 0, true)
  header.set(nameBytes, 30)

  const payload = new Uint8Array(isDirectory ? 0 : compressedSize)
  payload.fill(compressionMethod === 8 ? 0xcd : 0xab)

  return { header, payload }
}

interface CentralDirectoryEntryOptions {
  name: string
  compressedSize: number
  uncompressedSize: number
  localHeaderOffset: number
  compressionMethod?: number
  useZip64?: boolean
}

const writeZip64Extra = (
  view: DataView,
  nameByteLength: number,
  {
    uncompressedSize,
    compressedSize,
    localHeaderOffset,
  }: CentralDirectoryEntryOptions
) => {
  view.setUint16(46 + nameByteLength, 0x0001, true)
  view.setUint16(46 + nameByteLength + 2, 24, true)
  writeUint64LE(view, 46 + nameByteLength + 4, uncompressedSize)
  writeUint64LE(view, 46 + nameByteLength + 12, compressedSize)
  writeUint64LE(view, 46 + nameByteLength + 20, localHeaderOffset)
}

const writeCentralDirectoryFields = (
  view: DataView,
  nameBytes: Uint8Array,
  options: CentralDirectoryEntryOptions & { extraLength: number }
) => {
  const {
    compressedSize,
    uncompressedSize,
    localHeaderOffset,
    compressionMethod = 0,
    useZip64 = false,
    extraLength,
  } = options

  view.setUint32(0, 0x02014b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(6, 20, true)
  view.setUint16(10, compressionMethod, true)
  view.setUint32(16, 0x12345678, true)
  view.setUint32(20, useZip64 ? 0xffffffff : compressedSize, true)
  view.setUint32(24, useZip64 ? 0xffffffff : uncompressedSize, true)
  view.setUint16(28, nameBytes.length, true)
  view.setUint16(30, extraLength, true)
  view.setUint32(42, useZip64 ? 0xffffffff : localHeaderOffset, true)

  if (useZip64) {
    writeZip64Extra(view, nameBytes.length, options)
  }
}

const createCentralDirectoryEntry = (options: CentralDirectoryEntryOptions) => {
  const { name, useZip64 = false } = options
  const nameBytes = new TextEncoder().encode(name)
  const extraLength = useZip64 ? 28 : 0
  const entry = new Uint8Array(46 + nameBytes.length + extraLength)
  const view = new DataView(entry.buffer)

  writeCentralDirectoryFields(view, nameBytes, { ...options, extraLength })
  entry.set(nameBytes, 46)

  return entry
}

const createZipTail = (entries: Uint8Array[]) => {
  const totalEntriesLength = entries.reduce(
    (sum, entry) => sum + entry.length,
    0
  )

  const tail = new Uint8Array(totalEntriesLength + 22)
  let offset = 0

  for (const entry of entries) {
    tail.set(entry, offset)
    offset += entry.length
  }

  const view = new DataView(tail.buffer)
  view.setUint32(offset, 0x06054b50, true)
  view.setUint16(offset + 8, entries.length, true)
  view.setUint16(offset + 10, entries.length, true)
  view.setUint32(offset + 12, totalEntriesLength, true)
  view.setUint32(offset + 16, 0, true)

  return tail
}

const concat = (...parts: Uint8Array[]) => {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0

  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }

  return out
}

const createTarHeader = (name: string, type: string, size: number) => {
  const header = new Uint8Array(512)
  header.set(new TextEncoder().encode(name), 0)
  header.set(
    new TextEncoder().encode(
      `${"00000000000".slice(size.toString(8).length)}${size.toString(8)} `
    ),
    124
  )
  header.set(new TextEncoder().encode(type), 156)
  header.set(new TextEncoder().encode("ustar"), 257)

  return header
}

describe("inspectArchiveEntry", () => {
  it("returns the first real stored zip file with verified local-header size", () => {
    const dir = createLocalZipEntry({
      name: "Folder/",
      compressedSize: 0,
      uncompressedSize: 0,
      isDirectory: true,
    })

    const file = createLocalZipEntry({
      name: "Folder/Movie.mkv",
      compressedSize: 32,
      uncompressedSize: 64,
    })

    const archive = concat(dir.header, file.header, file.payload)
    const result = inspectArchiveEntry(archive)

    expect(result).toMatchObject({
      name: "Folder/Movie.mkv",
      archiveKind: "zip",
      compression: "stored",
      dataOffset: dir.header.length + file.header.length,
      compressedSize: 32,
      uncompressedSize: 64,
      sizeStatus: "verified",
      sizeSource: "zip-local-header",
    })
    expect(extractFirstFileFromArchive(archive)).toBe("Folder/Movie.mkv")
  })

  it("returns the first deflate zip file with verified local-header size", () => {
    const file = createLocalZipEntry({
      name: "Movie.mkv",
      compressedSize: 48,
      uncompressedSize: 96,
      compressionMethod: 8,
    })

    const result = inspectArchiveEntry(concat(file.header, file.payload))

    expect(result).toMatchObject({
      name: "Movie.mkv",
      compression: "deflate",
      compressedSize: 48,
      uncompressedSize: 96,
      sizeStatus: "verified",
      sizeSource: "zip-local-header",
    })
  })

  it("uses the central directory when the local zip header cannot verify size", () => {
    const file = createLocalZipEntry({
      name: "Movie.mkv",
      compressedSize: 48,
      uncompressedSize: 96,
      compressionMethod: 8,
      useDataDescriptor: true,
    })

    const tail = createZipTail([
      createCentralDirectoryEntry({
        name: "Movie.mkv",
        compressedSize: 48,
        uncompressedSize: 96,
        localHeaderOffset: 0,
        compressionMethod: 8,
      }),
    ])

    const result = inspectArchiveEntry(concat(file.header, file.payload), {
      tailBuffer: tail,
    })

    expect(result).toMatchObject({
      name: "Movie.mkv",
      compression: "deflate",
      compressedSize: 48,
      uncompressedSize: 96,
      sizeStatus: "verified",
      sizeSource: "zip-central-directory",
    })
  })

  it("marks zip size as estimated when metadata cannot verify it", () => {
    const file = createLocalZipEntry({
      name: "Movie.mkv",
      compressedSize: 48,
      uncompressedSize: 96,
      compressionMethod: 8,
      useDataDescriptor: true,
    })

    const result = inspectArchiveEntry(concat(file.header, file.payload))

    expect(result).toMatchObject({
      name: "Movie.mkv",
      sizeStatus: "estimated",
      sizeSource: "unknown",
    })
    expect(ARCHIVE_SIZING_WARNING).toContain("may be inaccurate")
  })

  it("returns tar header sizes as verified", () => {
    const dirHeader = createTarHeader("Folder/", "5", 0)
    const fileHeader = createTarHeader("Folder/Movie.mkv", "0", 1024)
    const filePayload = new Uint8Array(1024)

    const tar = concat(
      dirHeader,
      fileHeader,
      filePayload,
      new Uint8Array(512 * 2)
    )

    const result = inspectArchiveEntry(tar)

    expect(result).toMatchObject({
      name: "Folder/Movie.mkv",
      archiveKind: "tar",
      compression: "stored",
      dataOffset: 1024,
      compressedSize: 1024,
      uncompressedSize: 1024,
      sizeStatus: "verified",
      sizeSource: "tar-header",
    })
  })
})
