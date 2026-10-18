import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

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
    globals: true,
    environment: "jsdom",
    setupFiles: ["./app/test/setup.ts"],
  },
})
