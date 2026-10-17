import { describe, expect, it, vi } from 'vitest';

import {
  extractFirstFileFromArchive,
  isValidFilename,
} from '~/lib/media-utils';

// Mock the factory to avoid the .wasm import failure
vi.mock('~/services/mediainfo-factory.server', () => {
  return {
    createMediaInfo: async () => Promise.resolve({}),
  };
});

// --- Mock Generators ---

function createMockZip(
  entries: { name: string; isDir?: boolean }[],
): Uint8Array {
  // Simple Zip Local File Header generator
  const buffers: Uint8Array[] = [];

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name);
    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);

    // Signature: PK\x03\x04
    view.setUint32(0, 0x04034b50, true);

    // Version (20)
    view.setUint16(4, 20, true);

    // Flags (0)
    view.setUint16(6, 0, true);

    // Compression (0 = Store)
    view.setUint16(8, 0, true);

    // Time/Date (Dummy)
    view.setUint32(10, 0, true);

    // CRC32 (Dummy)
    view.setUint32(14, 0x12345678, true);

    // Compressed Size (Dummy 10 bytes content)
    const contentSize = entry.isDir ? 0 : 10;
    view.setUint32(18, contentSize, true);

    // Uncompressed Size
    view.setUint32(22, contentSize, true);

    // Filename Length
    view.setUint16(26, nameBytes.length, true);

    // Extra Field Length (0)
    view.setUint16(28, 0, true);

    // Write Filename
    header.set(nameBytes, 30);

    buffers.push(header);

    // Content (mock content)
    if (contentSize > 0) {
      buffers.push(new Uint8Array(contentSize).fill(0xaa));
    }
  }

  // Combine
  const totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const b of buffers) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
}

function createMockTar(
  entries: { name: string; type?: string; size?: number }[],
): Uint8Array {
  // Simple Tar block generator
  const BLOCK_SIZE = 512;
  const buffers: Uint8Array[] = [];

  function writeHeader(name: string, size: number, type: string) {
    const header = new Uint8Array(BLOCK_SIZE);

    // Name (0-100)
    const nameBytes = new TextEncoder().encode(name);
    // Note: Standard tar truncates at 100, checking parser handles it?
    // Our parser reads up to 100.
    header.set(nameBytes.subarray(0, 100), 0);

    // Size (124-136) - Octal string encoded
    // Format: "00000000012 " (11 chars + space or null)
    const sizeStr = size.toString(8).padStart(11, '0') + ' ';
    const sizeBytes = new TextEncoder().encode(sizeStr);
    header.set(sizeBytes, 124);

    // TypeFlag (156)
    header.set(new TextEncoder().encode(type), 156);

    // Magic (257) - ustar
    header.set(new TextEncoder().encode('ustar'), 257);

    buffers.push(header);
  }

  for (const entry of entries) {
    const size = entry.size ?? 100;

    // Handle LongLink simulation
    // If name is > 100 chars, usually a Type 'L' block precedes it with the full name as content.
    // We simulate this manually if needed, OR we can make a helper that produces the L block.
    // Let's manually create the L block structure if 'type' is 'L'

    const isLongLink = entry.type === 'L';
    writeHeader(entry.name, size, entry.type ?? '0');

    // Content Blocks
    const payloadSize = size;
    const blocksNeeded = Math.ceil(payloadSize / BLOCK_SIZE);
    const content = new Uint8Array(blocksNeeded * BLOCK_SIZE);
    if (isLongLink) {
      // If it's a LongLink, the content IS the real name of the next file.
      // We assume the test passes the "Real Name" as what we want to put in content?
      // Wait, for this mock function:
      // if type='L', 'name' is usually ././@LongLink. 'size' is length of real name.
      // We need to fill content with the real name.
      // To make usage easy: createMockTar([{ name: '././@LongLink', type: 'L', content: 'RealLongName...' }])?
      // Let's just trust the caller fills the sequence correctly or use a simpler mock.
      // For 'L' type, let's assume valid text content is needed.
      // But here I'm filling 0s.
      // Let's allow passing content text.
      content.fill(0); // Default
    } else {
      content.fill(0xbb);
    }
    buffers.push(content);
  }

  // End of archive (2 null blocks)
  buffers.push(new Uint8Array(BLOCK_SIZE * 2));

  // Combine
  const totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const b of buffers) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
}

// Special helper for LongLink Tar
function createMockTarWithLongLink(longName: string): Uint8Array {
  const BLOCK_SIZE = 512;
  const buffers: Uint8Array[] = [];

  // 1. LongLink Header
  const linkHeader = new Uint8Array(BLOCK_SIZE);
  linkHeader.set(new TextEncoder().encode('././@LongLink'), 0);
  const size = longName.length + 1; // +1 for null terminator? standard usually includes it
  const sizeStr = size.toString(8).padStart(11, '0') + ' ';
  linkHeader.set(new TextEncoder().encode(sizeStr), 124);
  linkHeader.set(new TextEncoder().encode('L'), 156); // Type L
  linkHeader.set(new TextEncoder().encode('ustar'), 257); // Add Magic
  buffers.push(linkHeader);

  // 2. LongLink Content (The Name)
  const contentBlocks = Math.ceil(size / BLOCK_SIZE);
  const contentBuf = new Uint8Array(contentBlocks * BLOCK_SIZE);
  contentBuf.set(new TextEncoder().encode(longName), 0);
  buffers.push(contentBuf);

  // 3. Actual File Header (Name is truncated, but we care about the override)
  const fileHeader = new Uint8Array(BLOCK_SIZE);
  fileHeader.set(new TextEncoder().encode(longName.slice(0, 100)), 0);
  fileHeader.set(new TextEncoder().encode('00000000000 '), 124); // Size 0 for simplicity
  fileHeader.set(new TextEncoder().encode('0'), 156); // Regular file
  buffers.push(fileHeader);

  // 4. End blocks
  buffers.push(new Uint8Array(BLOCK_SIZE * 2));

  // Combine
  const totalLength = buffers.reduce((acc, b) => acc + b.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0; // Fixed: offset was not initialized
  for (const b of buffers) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
}

// --- Tests ---

describe('Archive Filename Extraction', () => {
  it('should extract filename from a flat Zip', () => {
    const zip = createMockZip([{ name: 'MyMovie.mkv', isDir: false }]);
    const result = extractFirstFileFromArchive(zip);
    expect(result).toBe('MyMovie.mkv');
  });

  it('should skip directories in a Zip', () => {
    const zip = createMockZip([
      { name: 'Folder/', isDir: true },
      { name: 'Nested/Path/', isDir: true },
      { name: 'RealMovie.mp4', isDir: false },
    ]);
    const result = extractFirstFileFromArchive(zip);
    expect(result).toBe('RealMovie.mp4');
  });

  it('should extract filename from a simple Tar', () => {
    const tar = createMockTar([{ name: 'Simple.mkv', type: '0' }]);
    const result = extractFirstFileFromArchive(tar);
    expect(result).toBe('Simple.mkv');
  });

  it('should skip directories in a Tar', () => {
    const tar = createMockTar([
      { name: 'RootDir/', type: '5' },
      // Note: createMockTar handles standard name field.
      // If type is 0 but name ends in /, parser treats as dir?
      // Let's be explicit with type '5' (Directory)
      { name: 'Movie.avi', type: '0' },
    ]);
    const result = extractFirstFileFromArchive(tar);
    expect(result).toBe('Movie.avi');
  });

  it('should handle GNU LongLink in Tar', () => {
    const longName =
      'VeryLongNameThatExceedsOneHundredCharactersAndThereforeRequiresTheSpecialGnuLongLinkExtensionToWorkCorrectly.mkv';
    // Use special helper to construct valid L-block sequence
    const tar = createMockTarWithLongLink(longName);

    const result = extractFirstFileFromArchive(tar);
    expect(result).toBe(longName);
  });

  it('should return null for non-archive buffer', () => {
    const junk = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    const result = extractFirstFileFromArchive(junk);
    expect(result).toBeNull();
  });
  it('should return null for Matroska (MKV) file signature', () => {
    // Matroska signature: 1A 45 DF A3
    const mkvHeader = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00]);
    const result = extractFirstFileFromArchive(mkvHeader);
    expect(result).toBeNull();
  });

  it('should return null for MP4/MOV file signature', () => {
    // ftyp atom at offset 4 usually
    const mp4Header = new Uint8Array([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
    ]); // ... ftyp
    const result = extractFirstFileFromArchive(mp4Header);
    expect(result).toBeNull();
  });
});

describe('Filename Validation', () => {
  it('should accept valid filenames', () => {
    expect(isValidFilename('Movie.mkv')).toBe(true);
    expect(isValidFilename('My Document 2024.pdf')).toBe(true);
    expect(isValidFilename('Standard-ASCII_Chars.txt')).toBe(true);
  });

  it('should reject binary garbage', () => {
    // Matroska header raw bytes as string
    const garbage = String.fromCharCode(0x1a, 0x45, 0xdf, 0xa3);
    expect(isValidFilename(garbage)).toBe(false);
  });

  it('should reject strings with excessive control characters', () => {
    const garbage = 'Normal' + String.fromCharCode(0, 1, 2, 3, 4, 5);
    // 6/12 = 50% bad
    expect(isValidFilename(garbage)).toBe(false);
  });

  it('should reject empty or null inputs', () => {
    expect(isValidFilename('')).toBe(false);
    expect(isValidFilename(null)).toBe(false);
    expect(isValidFilename(undefined)).toBe(false);
  });
});
