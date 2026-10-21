import { cloudflareTest } from "@cloudflare/vitest-plugin"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          globals: true,
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: ["src/**/*.workerd.test.ts"],
        },
      },
      {
        plugins: [
          cloudflareTest({
            wrangler: { configPath: "./wrangler.jsonc" },
          }),
        ],
        test: {
          name: "workerd",
          globals: true,
          include: ["src/**/*.workerd.test.ts"],
        },
      },
    ],
  },
})
