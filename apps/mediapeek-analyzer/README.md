# Analyzer Worker

This folder is the target home for the analysis API Worker (`/resource/analyze`).

## Current Status

- Analyze implementation still runs in the root app during migration.
- Shared contracts now live in `packages/shared`.

## Planned Runtime Responsibilities

- Validate/authenticate analyze traffic.
- Fetch media chunks and run MediaInfo analysis.
- Emit structured diagnostics for CPU and upstream failures.

## API Response Contract

`/resource/analyze` returns a normalized JSON envelope.

### Preferred Request

Use `POST /resource/analyze` with a JSON body:

```json
{
  "url": "<absolute-media-url>",
  "format": ["object"]
}
```

Legacy compatibility is still available temporarily through `GET /resource/analyze?url=...&format=...`, but that path is deprecated.

### Success Response

```json
{
  "success": true,
  "requestId": "string",
  "results": {
    "<format>": "..."
  }
}
```

### Error Response

```json
{
  "success": false,
  "requestId": "string",
  "error": {
    "code": "string",
    "message": "string",
    "retryable": false
  }
}
```

## Configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `ANALYZE_API_KEY` | Secret used for internal web -> analyzer auth. | None |
| `ANALYZE_PUBLIC_API_KEY` | Optional secret for protecting public `/resource/analyze` access. | None |
| `ANALYZE_RATE_LIMIT_PER_MINUTE` | Per-minute request limit for analyze traffic. | `30` |
| `APP_ENV` | Runtime environment name. | `production` |
| `LOG_SAMPLE_RATE` | Fraction of requests sampled for logs. | `0.1` |
| `LOG_SLOW_REQUEST_MS` | Threshold for slow-request logging. | `2000` |
| `LOG_FORCE_ALL_REQUESTS` | Forces logging for every request when set to `"true"`. | `"false"` |
| `ENABLE_TURNSTILE` | Enables Turnstile gating for public analyze access. | Disabled unless set |
| `TURNSTILE_SITE_KEY` | Public Turnstile site key. | None |
| `TURNSTILE_SECRET_KEY` | Secret Turnstile key. | None |
| `TURNSTILE_GRANT_SECRET` | Secret used to sign short-lived Turnstile grant cookies. | None |

When Turnstile is enabled, MediaPeek issues an HTTP-only, URL-bound grant cookie (`mp_turnstile_grant`) after a successful challenge. That grant lets follow-up format requests (`Text`, `XML`, `HTML`) proceed for up to 10 minutes without repeating the challenge.
