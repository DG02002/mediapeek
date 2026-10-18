/// <reference types="vite/client" />

interface Env {
  ANALYZER?: Fetcher;
  ANALYZE_API_KEY?: string;
  ANALYZE_PUBLIC_API_KEY?: string;
  ANALYZE_RATE_LIMIT_PER_MINUTE?: string;
  ANALYZER_REQUEST_TIMEOUT_MS?: string;
  APP_ENV?: string;
  COMMIT_HASH?: string;
  LOG_SAMPLE_RATE?: string;
  LOG_SLOW_REQUEST_MS?: string;
  LOG_FORCE_ALL_REQUESTS?: string;
  ANALYZE_RATE_LIMITER?: {
    limit: (options: { key: string }) => Promise<{ success: boolean }>;
  };
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_GRANT_SECRET?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_ENABLED?: string;
  SERVICE_VERSION?: string;
}

declare module "mediainfo.js" {
  export interface MediaInfoOptions {
    chunkSize?: number;
    coverData?: boolean;
    format?: "object" | "text" | "xml" | "json";
    full?: boolean;
  }

  export interface MediaInfo {
    options: MediaInfoOptions;
    analyzeData(
      getSize: () => number,
      readChunk: (size: number, offset: number) => Uint8Array | Promise<Uint8Array>
    ): Promise<string | object>;
    inform(): string;
    reset(): void;
    close(): void;
  }

  export interface MediaInfoFactoryOptions {
    format?: "json" | "xml" | "text" | "object";
    coverData?: boolean;
    full?: boolean;
    locateFile?: (path: string, prefix: string) => string;
  }

  type MediaInfoFactory = (options?: MediaInfoFactoryOptions) => Promise<MediaInfo>;

  const mediainfo: MediaInfoFactory;
  export default mediainfo;
}
