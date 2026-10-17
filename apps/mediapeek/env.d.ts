/// <reference types="vite/client" />
/// <reference types="@react-router/node" />

interface Env {
  ANALYZER?: Fetcher;
  ANALYZE_API_KEY?: string;
  ANALYZE_PUBLIC_API_KEY?: string;
  ANALYZE_RATE_LIMIT_PER_MINUTE?: string;
  ANALYZER_REQUEST_TIMEOUT_MS?: string;
  APP_ENV?: string;
  LOG_SAMPLE_RATE?: string;
  LOG_SLOW_REQUEST_MS?: string;
  LOG_FORCE_ALL_REQUESTS?: string;
  ANALYZE_RATE_LIMITER?: {
    limit: (options: { key: string }) => Promise<{ success: boolean }>;
  };
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_GRANT_SECRET?: string;
  TURNSTILE_SITE_KEY: string;
  ENABLE_TURNSTILE?: string;
  SESSION_SECRET?: string;
}



declare module "virtual:react-router/server-build" {
  import { ServerBuild } from "react-router";
  export const routes: ServerBuild["routes"];
  export const assets: ServerBuild["assets"];
  export const future: ServerBuild["future"];
  export const publicPath: ServerBuild["publicPath"];
  export const entry: ServerBuild["entry"];
  export const assetsBuildDirectory: ServerBuild["assetsBuildDirectory"];
  export const ssr: ServerBuild["ssr"];
  export const isSpaMode: ServerBuild["isSpaMode"];
  export const prerender: ServerBuild["prerender"];
  export const routeDiscovery: ServerBuild["routeDiscovery"];
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
