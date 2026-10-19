import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

const cliArguments = process.argv
  .slice(2)
  .filter((argument) => argument !== "--")

const analyzerMode = cliArguments.includes("--analyzer")

const configArguments = cliArguments.filter(
  (argument) => argument !== "--analyzer"
)

const unknownOptions = configArguments.filter((argument) =>
  argument.startsWith("--")
)

if (unknownOptions.length > 0 || configArguments.length > 1) {
  throw new Error(
    "Usage: node scripts/deployment-preflight.mjs [config-path] [--analyzer]"
  )
}

const defaultConfigPath = fileURLToPath(
  new URL(
    analyzerMode
      ? "../apps/mediapeek-analyzer/wrangler.jsonc"
      : "../apps/mediapeek/wrangler.jsonc",
    import.meta.url
  )
)

const configPath = resolve(configArguments[0] ?? defaultConfigPath)
const configSource = await readFile(configPath, "utf8")

const uncommentedConfigSource = configSource
  .split(/\r?\n/)
  .filter((line) => !/^\s*\/\//.test(line))
  .join("\n")

const config = JSON.parse(
  uncommentedConfigSource.replaceAll(/,\s*([}\]])/g, "$1")
)

const failures = []
const warnings = []
const temporaryWarningAllowlist = new Set(["missing ANALYZE_RATE_LIMITER"])

if (
  Object.prototype.toString.call(config.main) !== "[object String]" ||
  config.main.length === 0
) {
  failures.push("missing main entry point")
}

if (!Array.isArray(config.compatibility_flags)) {
  failures.push("missing compatibility_flags with nodejs_compat")
} else if (!config.compatibility_flags.includes("nodejs_compat")) {
  failures.push("compatibility_flags must include nodejs_compat")
}

if (config.observability?.enabled !== true) {
  failures.push("observability.enabled must be true")
}

if (config.observability?.traces?.enabled !== true) {
  failures.push("observability.traces.enabled must be true")
}

if (analyzerMode) {
  if (!Number.isFinite(config.limits?.cpu_ms) || config.limits.cpu_ms <= 0) {
    failures.push("missing limits.cpu_ms")
  }
} else {
  const services = Array.isArray(config.services) ? config.services : []

  const analyzerBindings = services.filter(
    (service) => service?.binding === "ANALYZER"
  )

  if (analyzerBindings.length === 0) {
    failures.push("missing services binding ANALYZER")
  } else if (analyzerBindings.length > 1) {
    failures.push(
      `ANALYZER service binding appears ${analyzerBindings.length} times; expected 1`
    )
  } else if (analyzerBindings[0].service !== "mediapeek-analyzer") {
    failures.push("ANALYZER service must target mediapeek-analyzer")
  }

  const rateLimiters = Array.isArray(config.ratelimits) ? config.ratelimits : []

  const analyzeRateLimiters = rateLimiters.filter(
    (rateLimiter) => rateLimiter?.name === "ANALYZE_RATE_LIMITER"
  )

  if (analyzeRateLimiters.length === 0) {
    failures.push("missing ANALYZE_RATE_LIMITER")
  } else if (analyzeRateLimiters.length > 1) {
    failures.push(
      `ANALYZE_RATE_LIMITER appears ${analyzeRateLimiters.length} times; expected 1`
    )
  }
}

if (
  /REPLACE_WITH_|00000000-0000-0000-0000-000000000000|\b0{32}\b/i.test(
    uncommentedConfigSource
  )
) {
  failures.push("contains a placeholder production value")
}

const remainingFailures = []

for (const failure of failures) {
  if (temporaryWarningAllowlist.has(failure)) {
    warnings.push(failure)
  } else {
    remainingFailures.push(failure)
  }
}

for (const warning of warnings) {
  console.warn(`Deployment configuration preflight warning: ${warning}`)
}

if (remainingFailures.length > 0) {
  throw new Error(
    [
      "Deployment configuration preflight failed:",
      ...remainingFailures.map((failure) => `- ${failure}`),
    ].join("\n")
  )
}

console.log(`Deployment configuration preflight passed: ${configPath}`)
