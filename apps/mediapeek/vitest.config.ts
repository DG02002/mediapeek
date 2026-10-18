import { fileURLToPath } from "node:url"

import { cloudflareTest } from "@cloudflare/vitest-plugin"
import { defineConfig } from "vitest/config"

import { createScriptedAnalyzerFetcher } from "./app/test/analyze-server.ts"

const testWasmModule = fileURLToPath(
  new URL("./app/test/media-info-wasm.ts", import.meta.url)
)

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: [
      {
        find: "./MediaInfoModule.wasm",
        replacement: testWasmModule,
      },
    ],
  },
  test: {
    projects: [
      {
        test: {
          name: "client",
          globals: true,
          environment: "jsdom",
          setupFiles: ["./app/test/setup.ts"],
          include: ["app/**/*.{test,spec}.{ts,tsx}"],
          exclude: ["app/**/*.server.test.ts"],
        },
      },
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: "./wrangler.jsonc" },
            miniflare: {
              serviceBindings: {
                ANALYZER: (request) => createScriptedAnalyzerFetcher(request),
              },
            },
          }),
        ],
        test: {
          name: "server",
          globals: true,
          include: ["app/**/*.server.test.ts"],
        },
      },
    ],
  },
})
