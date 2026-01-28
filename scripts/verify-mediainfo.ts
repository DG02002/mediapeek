import { analyzeMediaBuffer } from '../app/services/mediainfo.server';

async function main() {
  console.log('Starting verification...');
  // Create a minimal valid MP4 header (ftyp box) to test WASM loading
  // ftyp isom (not a full file, but enough to trigger analysis)
  const buffer = new Uint8Array([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
    0x00, 0x00, 0x02, 0x00, 0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
  ]);

  try {
    const result = await analyzeMediaBuffer(buffer, buffer.length, 'test.mp4');
    console.log('Analysis Success!', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Analysis Failed:', error);
    process.exit(1);
  }
}

main();
