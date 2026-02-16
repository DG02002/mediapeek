# Logging Standards

This document defines the logging standards for the project, strictly adhering to the "Wide Events" philosophy from [Logging Sucks](https://loggingsucks.com/) and the [Google JSON Style Guide](https://google.github.io/styleguide/jsoncstyleguide.xml).

## Core Philosophy: Wide Events

We treat logs not as a stream of text, but as a **structured record of business events**.

- **One Request = One Log**: We emit exactly **one** canonical log line at the end of the request.
- **Context is King**: The log must contain _everything_ needed to debug that request (metrics, params, errors, user info).
- **High Cardinality**: We embrace high-cardinality fields (like `userId`, `filename`, `requestId`) because they afford precise slicing.

## Mandatory Standard Fields

Every log line implies a "Unit of Work" (usually an HTTP Request) and must include:

### 1. Identity & Tracing

- `requestId`: A unique identifier for the request (e.g., Cloudflare Ray ID or UUID).
- `traceId`: (Optional) For distributed tracing across multiple services.

### 2. Service Metadata

To identify _where_ the log came from:

- `service`: Name of the service (e.g., `mediapeek-worker`).
- `version`: Git commit hash, release tag, or build date (e.g., `2025-01-12`).
- `environment`: `production`, `development`, or `staging`.

### 3. Execution Metrics

- `durationMs`: Total time taken in milliseconds.
- `status`: High-level outcome (`success`, `error`).

## Tail Sampling Strategy

To control costs without losing value, we implement **Tail Sampling** (deciding to keep a log _after_ we know what happened):

1.  **Always Keep Errors**: `severity` >= `WARNING`.
2.  **Always Keep Slow Requests**: `durationMs` > 2000ms.
3.  **Always Keep VIPs/Debugging**: Specific flags or specific user IDs.
4.  **Sample the Rest**: Randomly sample healthy, fast traffic (e.g., 10%).

_Note: In local development, we keep 100% of logs._

Runtime sampling controls are configured via Worker bindings:

- `APP_ENV` (`development`, `staging`, `production`)
- `LOG_SAMPLE_RATE` (`0..1`)
- `LOG_SLOW_REQUEST_MS`
- `LOG_FORCE_ALL_REQUESTS` (`true`/`false`)

## Cloudflare Workers Integration

To ensure seamless integration with the Cloudflare Dashboard and `wrangler tail` (see [Workers Logs documentation](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)):

1.  **Level Mapping**: We map strict JSON `severity` fields to native console methods to ensure the "Level" column in Cloudflare is correct:
    - `"severity": "ERROR"` -> `console.error()`
    - `"severity": "WARNING"` -> `console.warn()`
    - `"severity": "INFO"` -> `console.log()`

2.  **Serialization**: We explicitly `JSON.stringify` the payload before logging. This ensures the output is treated as a single string event, preventing object truncation in some viewers and guaranteeing valid JSON for ingestion pipelines.

## JSON Style Guide (Google-Compliant)

- **Property Naming**: `camelCase` (e.g., `itemsPerPage`).
- **Enums**: `UPPER_SNAKE_CASE` (e.g., `"severity": "INFO"`).
- **Dates**: RFC 3339 strings.
- **Errors**: Structured objects, not strings.

## Sensitive Data Redaction

- Never log raw Turnstile tokens, API keys, auth headers, cookies, or URL query signatures.
- Redact signed URL query params before writing request context (`token`, `sig`, `signature`, `key`, `auth`, `expires`, `X-Amz-*`, `X-Goog-*`).
- Prefer metadata (`tokenPresent`, `tokenLength`) instead of raw token values.

## Standard Schema (`LogEvent`)

```typescript
interface LogEvent {
  // --- Standard Metadata ---
  timestamp: string; // RFC 3339
  severity: 'INFO' | 'WARNING' | 'ERROR';
  message: string; // Human-readable summary

  // --- Tracing & Service ---
  requestId: string;
  service: string;
  version: string;
  environment: 'development' | 'staging' | 'production';

  // --- HTTP Context ---
  httpRequest?: {
    requestMethod: string;
    requestUrl: string;
    status: number;
    userAgent?: string;
    remoteIp?: string;
    latency?: string; // Google Style: "1.23s"
  };

  // --- Application Context (The "Wide" part) ---
  context?: {
    // Business fields
    fileSize?: number;
    filename?: string;
    archiveName?: string; // If inside a container (zip/tar)
    innerFilename?: string; // The file inside the container

    // Sub-system diagnostics
    fetch?: FetchDiagnostics;
    analysis?: AnalysisDiagnostics;

    // Errors
    error?: {
      code: number;
      message: string;
      details?: unknown;
    };

    // Normalized failure category for alerting and dashboards
    // e.g., CPU_LIMIT_EXCEEDED, ROUTE_NOT_FOUND, THEME_CONTEXT_MISSING
    errorClass?: string;

    [key: string]: unknown;
  };
}
```

## Implementation Pattern

Accumulate context, then log _once_ in `finally` block using the `log()` utility which handles sampling.

```typescript
const ctx = {};
try {
  // ... work ...
} finally {
  log({
    requestId: request.headers.get('cf-ray'),
    // ...
  });
}
```
