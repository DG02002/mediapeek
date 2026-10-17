import { describe, expect, it } from "vitest"

import { extractFirstFileFromArchive, isValidFilename } from "~/lib/media-utils"

// --- Mock Generators ---

const concatenateBuffers = (buffers: Uint8Array[]) => {
  const totalLength = buffers.reduce(
    (total, buffer) => total + buffer.length,
    0
  )

  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const buffer of buffers) {
    result.set(buffer, offset)
    offset += buffer.length
  }

  return result
}

const createZipEntry = (entry: { name: string; isDir?: boolean }) => {
  const nameBytes = new TextEncoder().encode(entry.name)
  const contentSize = entry.isDir ? 0 : 10
  const header = new Uint8Array(30 + nameBytes.length)
  const view = new DataView(header.buffer)

  view.setUint32(0, 0x04034b50, true)
  view.setUint16(4, 20, true)
  view.setUint16(6, 0, true)
  view.setUint16(8, 0, true)
  view.setUint32(10, 0, true)
  view.setUint32(14, 0x12345678, true)
  view.setUint32(18, contentSize, true)
  view.setUint32(22, contentSize, true)
  view.setUint16(26, nameBytes.length, true)
  view.setUint16(28, 0, true)
  header.set(nameBytes, 30)

  const content = new Uint8Array(contentSize).fill(0xaa)

  return [header, content]
}

function createMockZip(
  entries: { name: string; isDir?: boolean }[]
): Uint8Array {
  return concatenateBuffers(entries.flatMap(createZipEntry))
}

const TAR_BLOCK_SIZE = 512

const createTarHeader = (name: string, size: number, type: string) => {
  const header = new Uint8Array(TAR_BLOCK_SIZE)
  const nameBytes = new TextEncoder().encode(name)

  const sizeBytes = new TextEncoder().encode(
    `${size.toString(8).padStart(11, "0")} `
  )

  header.set(nameBytes.subarray(0, 100), 0)
  header.set(sizeBytes, 124)
  header.set(new TextEncoder().encode(type), 156)
  header.set(new TextEncoder().encode("ustar"), 257)

  return header
}

const createMockTarEntry = (entry: {
  name: string
  type?: string
  size?: number
}) => {
  const size = entry.size ?? 100
  const type = entry.type ?? "0"
  const header = createTarHeader(entry.name, size, type)

  const content = new Uint8Array(
    Math.ceil(size / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE
  )

  content.fill(type === "L" ? 0 : 0xbb)

  return [header, content]
}

function createMockTar(
  entries: { name: string; type?: string; size?: number }[]
): Uint8Array {
  const archiveEnd = new Uint8Array(TAR_BLOCK_SIZE * 2)

  return concatenateBuffers([
    ...entries.flatMap(createMockTarEntry),
    archiveEnd,
  ])
}

function createMockTarWithLongLink(longName: string): Uint8Array {
  const size = longName.length + 1
  const linkHeader = createTarHeader("././@LongLink", size, "L")

  const content = new Uint8Array(
    Math.ceil(size / TAR_BLOCK_SIZE) * TAR_BLOCK_SIZE
  )

  content.set(new TextEncoder().encode(longName), 0)

  const fileHeader = createTarHeader(longName.slice(0, 100), 0, "0")
  const archiveEnd = new Uint8Array(TAR_BLOCK_SIZE * 2)

  return concatenateBuffers([linkHeader, content, fileHeader, archiveEnd])
}

// --- Tests ---

describe("Archive Filename Extraction", () => {
  it("should extract filename from a flat Zip", () => {
    const zip = createMockZip([{ name: "MyMovie.mkv", isDir: false }])
    const result = extractFirstFileFromArchive(zip)
    expect(result).toBe("MyMovie.mkv")
  })

  it("should skip directories in a Zip", () => {
    const zip = createMockZip([
      { name: "Folder/", isDir: true },
      { name: "Nested/Path/", isDir: true },
      { name: "RealMovie.mp4", isDir: false },
    ])

    const result = extractFirstFileFromArchive(zip)
    expect(result).toBe("RealMovie.mp4")
  })

  it("should extract filename from a simple Tar", () => {
    const tar = createMockTar([{ name: "Simple.mkv", type: "0" }])
    const result = extractFirstFileFromArchive(tar)
    expect(result).toBe("Simple.mkv")
  })

  it("should skip directories in a Tar", () => {
    const tar = createMockTar([
      { name: "RootDir/", type: "5" },
      // Note: createMockTar handles standard name field.
      // If type is 0 but name ends in /, parser treats as dir?
      // Let's be explicit with type '5' (Directory)
      { name: "Movie.avi", type: "0" },
    ])

    const result = extractFirstFileFromArchive(tar)
    expect(result).toBe("Movie.avi")
  })

  it("should handle GNU LongLink in Tar", () => {
    const longName =
      "VeryLongNameThatExceedsOneHundredCharactersAndThereforeRequiresTheSpecialGnuLongLinkExtensionToWorkCorrectly.mkv"

    // Use special helper to construct valid L-block sequence
    const tar = createMockTarWithLongLink(longName)

    const result = extractFirstFileFromArchive(tar)
    expect(result).toBe(longName)
  })

  it("should return null for non-archive buffer", () => {
    const junk = new Uint8Array([0x00, 0x01, 0x02, 0x03])
    const result = extractFirstFileFromArchive(junk)
    expect(result).toBeNull()
  })
  it("should return null for Matroska (MKV) file signature", () => {
    // Matroska signature: 1A 45 DF A3
    const mkvHeader = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00])
    const result = extractFirstFileFromArchive(mkvHeader)
    expect(result).toBeNull()
  })

  it("should return null for MP4/MOV file signature", () => {
    // ftyp atom at offset 4 usually
    const mp4Header = new Uint8Array([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
    ]) // ... ftyp

    const result = extractFirstFileFromArchive(mp4Header)
    expect(result).toBeNull()
  })
})

describe("Filename Validation", () => {
  it("should accept valid filenames", () => {
    expect(isValidFilename("Movie.mkv")).toBe(true)
    expect(isValidFilename("My Document 2024.pdf")).toBe(true)
    expect(isValidFilename("Standard-ASCII_Chars.txt")).toBe(true)
  })

  it("should reject binary garbage", () => {
    // Matroska header raw bytes as string
    const garbage = String.fromCharCode(0x1a, 0x45, 0xdf, 0xa3)
    expect(isValidFilename(garbage)).toBe(false)
  })

  it("should reject strings with excessive control characters", () => {
    const garbage = "Normal" + String.fromCharCode(0, 1, 2, 3, 4, 5)
    // 6/12 = 50% bad
    expect(isValidFilename(garbage)).toBe(false)
  })

  it("should reject empty or null inputs", () => {
    expect(isValidFilename("")).toBe(false)
    expect(isValidFilename(null)).toBe(false)
    expect(isValidFilename(undefined)).toBe(false)
  })
})
