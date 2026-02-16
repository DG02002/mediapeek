# MediaPeek Monorepo Developer Guide

This repository is a pnpm workspace + Turbo monorepo.

## Project Structure

- `apps/web`: React Router + Vite frontend Worker (UI + `/resource/analyze` gateway route).
- `apps/analyzer`: Hono Worker that performs media fetch + analysis.
- `packages/shared`: Shared schemas/contracts/types.
- `packages/config-*`: Shared lint/type/tailwind config packages.

## Prerequisites

- Node.js 22+
- pnpm 10+
- Cloudflare account with Wrangler access

## Install

Run from repo root:

```bash
cd /path/to/mediapeek
pnpm install
```

## Local Development

Run both workers in dev mode (from repo root):

```bash
pnpm dev
```

- Web: `http://localhost:5173`
- Analyzer: dynamic local port (Wrangler assigns a free port automatically)

## Local Env Setup

Create local env files (not committed):

1. `apps/web/.dev.vars`
2. `apps/analyzer/.dev.vars`

Recommended local values:

```bash
# apps/web/.dev.vars
SESSION_SECRET="<long-random-string>"
TURNSTILE_SECRET_KEY="1x0000000000000000000000000000000AA"
ANALYZE_API_KEY="<shared-internal-api-key>"
APP_ENV="development"
LOG_SAMPLE_RATE="1"
LOG_SLOW_REQUEST_MS="2000"
LOG_FORCE_ALL_REQUESTS="true"
```

```bash
# apps/analyzer/.dev.vars
ANALYZE_API_KEY="<same-shared-internal-api-key-as-web>"
ANALYZE_CPU_BUDGET_MS="25000"
APP_ENV="development"
LOG_SAMPLE_RATE="1"
LOG_SLOW_REQUEST_MS="2000"
LOG_FORCE_ALL_REQUESTS="true"
```

Turnstile localhost test key pair:

- Site key: `1x00000000000000000000AA`
- Secret key: `1x0000000000000000000000000000000AA`

`apps/web/wrangler.jsonc` already defaults `TURNSTILE_SITE_KEY` to the official test site key.

## Deployment (Monorepo)

### 1) One-time Cloudflare auth

Run from repo root:

```bash
pnpm dlx wrangler login
```

### 2) Set production secrets

From repo root:

```bash
# Web worker secrets
pnpm --filter mediapeek-web exec wrangler secret put TURNSTILE_SECRET_KEY
pnpm --filter mediapeek-web exec wrangler secret put ANALYZE_API_KEY
pnpm --filter mediapeek-web exec wrangler secret put SESSION_SECRET

# Analyzer worker secret (must match web ANALYZE_API_KEY)
pnpm --filter mediapeek-analyzer exec wrangler secret put ANALYZE_API_KEY
```

### 3) Configure production vars

`apps/web/wrangler.jsonc` should have production-safe values:

- `APP_ENV`: `"production"`
- `LOG_SAMPLE_RATE`: e.g. `"0.1"`
- `LOG_SLOW_REQUEST_MS`: e.g. `"2000"`
- `LOG_FORCE_ALL_REQUESTS`: `"false"`
- `TURNSTILE_SITE_KEY`: your production Turnstile site key
- `ENABLE_TURNSTILE`: `"true"`
- `ANALYZE_RATE_LIMIT_PER_MINUTE`: e.g. `"30"`

`apps/analyzer/wrangler.jsonc` should have:

- `APP_ENV`: `"production"`
- `LOG_SAMPLE_RATE`: e.g. `"0.1"`
- `LOG_SLOW_REQUEST_MS`: e.g. `"2000"`
- `LOG_FORCE_ALL_REQUESTS`: `"false"`
- `ANALYZE_CPU_BUDGET_MS`: e.g. `"25000"` (soft in-app guardrail)

Optional (paid Workers plans only):

- `limits.cpu_ms`: hard Worker CPU ceiling (not supported on Free plan)

Optional public API gate on web analyze route:

- `ANALYZE_PUBLIC_API_KEY` (secret, optional)

### 4) Deploy order (required)

Deploy analyzer first, then web:

```bash
pnpm --filter mediapeek-analyzer run deploy
pnpm --filter mediapeek-web run deploy
```

Reason: web has a service binding to analyzer, so analyzer must exist first.

## Verification Checklist After Deploy

1. `/app` submit opens Turnstile popup when Turnstile is enabled.
2. Completing challenge triggers exactly one analysis request.
3. Missing token returns `AUTH_REQUIRED`.
4. Invalid token returns `AUTH_INVALID`.
5. Re-submitting a new analysis requires a fresh challenge.
6. Burst requests return `429` with `Retry-After`.
7. Analyzer is reachable through service binding flow (no public `workers.dev` endpoint).
8. Analyzer logs include `cpuBudgetMs`, `cpuBudgetRemainingMs`, and `errorClass` for failed heavy analyses.
9. Application logs do not include raw Turnstile tokens or signed URL query-token values.

## Analyze Route Contract

- Primary contract: `POST /resource/analyze` with JSON body:
  - `{ "url": "<absolute-media-url>", "format": ["object"] }`
- Legacy compatibility:
  - `GET /resource/analyze?url=...&format=...` is still accepted temporarily but deprecated.

## Local Dev Troubleshooting

- If `/resource/analyze` returns an analyzer local-dev session error, restart both workers:

```bash
pnpm dev
```

- This repo config uses analyzer `dev.port = 0` to avoid port collisions. Wrangler will print the chosen analyzer URL in terminal logs.

## Secret Safety Before Commit

Run from repo root:

```bash
git check-ignore -v apps/web/.dev.vars apps/analyzer/.dev.vars .env .env.local
git ls-files | rg -n "(.env|.dev.vars|.pem$|.p12$|.pfx$|.pkcs12$|.jks$|.keystore$)"
```

- `git check-ignore` should confirm those local env files are ignored.
- `git ls-files` should return no secret/env artifact paths.

## Recommended Validation Commands

Run from repo root:

```bash
pnpm --filter mediapeek-web lint
pnpm --filter mediapeek-web typecheck
pnpm --filter mediapeek-web test
pnpm --filter mediapeek-web build

pnpm --filter mediapeek-analyzer lint
pnpm --filter mediapeek-analyzer typecheck
pnpm --filter mediapeek-analyzer test
pnpm --filter mediapeek-analyzer build
```

## Security Notes

- Keep Turnstile and rate limiting both enabled.
- Use service bindings for web -> analyzer calls.
- Do not commit `.env`, `.dev.vars`, or any secrets.
- If you add Cloudflare native Rate Limiting binding, configure it per environment with a real `namespace_id`.
