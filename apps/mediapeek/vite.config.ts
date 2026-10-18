/// <reference types="vitest" />
import { cloudflare } from "@cloudflare/vite-plugin"
import tailwindcss from "@tailwindcss/vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
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
    }),
    tailwindcss(),
    tanstackStart({
      srcDirectory: "./app",
    }),
    viteReact(),
  ],
  define: {
    __BUILD_NUMBER__: JSON.stringify(new Date().toISOString().split("T")[0]),
  },
})
