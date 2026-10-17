export interface MediaInfo {
  options: {
    format?: 'object' | 'JSON' | 'XML' | 'HTML' | 'Text';
    coverData?: boolean;
    full?: boolean;
    chunkSize?: number;
    locateFile?: (path: string, prefix: string) => string;
    wasmModule?: WebAssembly.Module;
    print?: (str: string) => void;
    printErr?: (str: string) => void;
  };
  analyzeData(
    getSize: () => number,
    readChunk: (size: number, offset: number) => Uint8Array | Promise<Uint8Array>,
  ): Promise<string | object>;
  inform(): string;
  reset(): void;
  close(): void;
}

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
