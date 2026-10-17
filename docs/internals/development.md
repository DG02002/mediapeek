# Local development

## First checkout

Use the Node.js version in [`.node-version`](../../.node-version) and the pnpm
version in the root `package.json`. From the repository root, install the
workspace with:

```sh
pnpm install --frozen-lockfile
```

## Local secrets

Create each app's local variables file from its example when needed:

```sh
cp apps/mediapeek/.dev.vars.example apps/mediapeek/.dev.vars
cp apps/mediapeek-analyzer/.dev.vars.example apps/mediapeek-analyzer/.dev.vars
```

Keep real values in the per-app `.dev.vars` files. Do not commit those files or
the root `.env`. The web app runs with Turnstile disabled by default and needs
no Turnstile keys in that mode. To exercise the enabled path locally, set the
flag and provide the local site and secret keys in the web app's `.dev.vars`.

## Run the Workers

From the repository root:

```sh
pnpm dev
```

This starts the web app and analyzer Worker. Use the package scripts to work
on one app at a time. Regenerate Cloudflare binding types with that app's
`cf-typegen` script after changing its Wrangler configuration.

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
