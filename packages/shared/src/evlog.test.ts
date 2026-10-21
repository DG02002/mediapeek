import { describe, expect, it } from "vitest"

import { createEvlogLoggerConfig } from "./evlog"
import { resolveRuntimeConfig } from "./runtime-config"

describe("createEvlogLoggerConfig", () => {
  it("redacts signature query fields", () => {
    const loggerConfig = createEvlogLoggerConfig(
      "mediapeek-test",
      resolveRuntimeConfig({})
    )

    expect(loggerConfig.redact).toMatchObject({
      paths: expect.arrayContaining(["**.signature", "**.sig"]),
    })
  })
})
