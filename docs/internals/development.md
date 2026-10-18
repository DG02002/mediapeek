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

Keep real values in per-app `.dev.vars` files and never commit them. The
analyzer Worker currently needs no local secrets, so it does not need a
`.dev.vars` file.

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

Both Workers currently use compatibility date `2026-10-13`, the newest date
supported by the locked local runtime. The seven-day minimum release-age
policy delays runtime upgrades. Update both Wrangler configurations when the
locked runtime supports a newer date, after checking the compatibility changes
and testing both Workers. Cloudflare keeps deployed Workers on their selected
compatibility behavior until the date is changed.

To run only the analyzer, use `pnpm --filter mediapeek-analyzer run dev`.

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
