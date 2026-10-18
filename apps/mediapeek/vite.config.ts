/// <reference types="vitest" />
import { cloudflare } from "@cloudflare/vite-plugin"
import { reactRouter } from "@react-router/dev/vite"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

export default defineConfig(({ command }) => ({
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        banner:
          "globalThis.Cloudflare = globalThis.Cloudflare || { compatibilityFlags: {} };",
      },
    },
  },
  optimizeDeps: {
    exclude: ["mediainfo.js"],
  },
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    cloudflare({
      viteEnvironment: { name: "ssr" },
      config: () =>
        command === "serve"
          ? {
              compatibility_date:
                process.env.MEDIAPEAK_DEV_COMPATIBILITY_DATE ?? "2026-10-13",
            }
          : undefined,
    }),
    tailwindcss(),
    reactRouter(),
  ],
  define: {
    __BUILD_NUMBER__: JSON.stringify(new Date().toISOString().split("T")[0]),
  },
  test: {
    globals: true,
    environment: "jsdom",
  },
}))
