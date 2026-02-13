import type { MediaInfo } from './MediaInfo';

export interface MediaInfoFactoryOptions {
  format?: 'object' | 'JSON' | 'XML' | 'HTML' | 'Text';
  coverData?: boolean;
  full?: boolean;
  chunkSize?: number;
  locateFile?: (path: string, prefix: string) => string;
  wasmModule?: WebAssembly.Module;
  print?: (str: string) => void;
  printErr?: (str: string) => void;
}

declare function mediaInfoFactory(options?: MediaInfoFactoryOptions): Promise<MediaInfo>;

export default mediaInfoFactory;
