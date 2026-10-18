# Local development

## First checkout

Use the Node.js version in [`.node-version`](../../.node-version) and the pnpm
version in the root `package.json`. From the repository root, install the
workspace with:

```sh
pnpm install --frozen-lockfile
```

## Local secrets

Create the web app's local variables file from its example:

```sh
cp apps/mediapeek/.dev.vars.example apps/mediapeek/.dev.vars
```

Generate a local `SESSION_SECRET` with `openssl rand -base64 32`. Keep real
values in per-app `.dev.vars` files and never commit them. The analyzer Worker
currently needs no local secrets, so it does not need a `.dev.vars` file.

The web app runs with `TURNSTILE_ENABLED=false` by default and needs no
Turnstile keys in that mode. To exercise the enabled path locally, set
`TURNSTILE_ENABLED=true` and provide `TURNSTILE_SITE_KEY`,
`TURNSTILE_SECRET_KEY`, and `TURNSTILE_GRANT_SECRET` in the web app's
`.dev.vars`.

## Run the Workers

From the repository root:

```sh
pnpm dev
```

This starts the web app and analyzer Worker. Use the package scripts to work
on one app at a time. Regenerate Cloudflare binding types with that app's
`cf-typegen` script after changing its Wrangler configuration.

The checked-in Wrangler configurations keep the deployment compatibility
date. The local `workerd` runtime can lag that date. Both development servers
use `MEDIAPEAK_DEV_COMPATIBILITY_DATE` locally and currently default to
`2026-10-13`, the newest date supported by the locked runtime. If the runtime
reports a different supported date, set the variable when starting the app:

```sh
MEDIAPEAK_DEV_COMPATIBILITY_DATE=2026-10-13 pnpm dev
```

The override only affects local development. A lower local date does not test
compatibility changes enabled after that date; update the local Wrangler and
`workerd` runtime to test against the deployment date. The seven-day minimum
release-age policy delays runtime upgrades; remove the local fallback once
the locked runtime supports the deployment date. To run the analyzer
directly, use `pnpm --filter mediapeek-analyzer run dev` so the package script
applies the same override.

## Refreshed dependency versions

The 2026-10-17 refresh resolves the main application and platform packages to:

| Package                     | Resolved version |
| --------------------------- | ---------------- |
| `@cloudflare/vite-plugin`   | `1.63.1`         |
| `@cloudflare/workers-types` | `5.20261010.1`   |
| `effect`                    | `4.0.2`          |
| `evlog`                     | `2.30.1`         |
| `hono`                      | `4.13.13`        |
| `mediainfo.js`              | `0.3.8`          |
| `react-router`              | `8.4.0`          |
| `typescript`                | `7.0.2`          |
| `vite`                      | `8.3.4`          |
| `vitest`                    | `5.0.3`          |
| `wrangler`                  | `4.149.0`        |

The workspace keeps `minimumReleaseAge: 10080` and strict release-age checks.
Wrangler `4.151.1` was released on 2026-10-16, so it remains inside that
seven-day window; `4.149.0` is the newest Wrangler version allowed by the
policy at this refresh ([Cloudflare Workers SDK releases](https://github.com/cloudflare/workers-sdk/releases)).

## Quality gates

Run the focused workspace check while iterating. Before handing off, run the
repository gates from the root:

```sh
pnpm check
pnpm test
pnpm build
```

The build includes dry-run Worker builds. For a direct check of either app's
Wrangler configuration, run `pnpm exec wrangler deploy --dry-run` from that
app directory. Never use `wrangler deploy` or a `--remote` command from local
development; production belongs to CI.
