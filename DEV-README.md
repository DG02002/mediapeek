# MediaPeek Dev Commands

## Workspaces

- `apps/web` = frontend app
- `apps/analyzer` = analyzer worker
- `packages/ui` = shared shadcn/ui package
- `packages/shared` = shared non-UI code

## Rule

- Use repo root for almost everything
- Use `pnpm --filter ...` for one workspace
- Use `packages/ui` for shadcn updates
- Do not run shadcn in `packages/shared`

## Important Notes

- The recommended place to run `pnpm dlx shadcn@latest --all --overwrite` is `packages/ui`
- Running `pnpm dlx shadcn@latest --all --overwrite` inside `apps/web` also works in this repo
- Do not run shadcn commands in `packages/shared`
- Use repo root for `pnpm install`, `pnpm update -r`, `pnpm lint`, `pnpm test`, `pnpm typecheck`, and `pnpm build`
- After dependency or shadcn updates, review the git diff before committing

## Root Commands

Run from repo root:

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm format
pnpm clean
pnpm approve-builds
```

## Filter Names

```bash
mediapeek-web
mediapeek-analyzer
@mediapeek/ui
@mediapeek/shared
```

## Web Commands

Run from repo root:

```bash
pnpm --filter mediapeek-web dev
pnpm --filter mediapeek-web lint
pnpm --filter mediapeek-web typecheck
pnpm --filter mediapeek-web test
pnpm --filter mediapeek-web build
pnpm --filter mediapeek-web deploy
pnpm --filter mediapeek-web cf-typegen
```

## Analyzer Commands

Run from repo root:

```bash
pnpm --filter mediapeek-analyzer dev
pnpm --filter mediapeek-analyzer lint
pnpm --filter mediapeek-analyzer typecheck
pnpm --filter mediapeek-analyzer test
pnpm --filter mediapeek-analyzer build
pnpm --filter mediapeek-analyzer deploy
pnpm --filter mediapeek-analyzer cf-typegen
```

## Shared Package Commands

Run from repo root:

```bash
pnpm --filter @mediapeek/ui lint
pnpm --filter @mediapeek/ui typecheck
pnpm --filter @mediapeek/ui test

pnpm --filter @mediapeek/shared lint
pnpm --filter @mediapeek/shared typecheck
pnpm --filter @mediapeek/shared test
```

## Dependency Update Commands

Run from repo root:

```bash
pnpm update -r
pnpm update -r --latest
```

Update one workspace:

```bash
pnpm --filter mediapeek-web update --latest
pnpm --filter mediapeek-analyzer update --latest
pnpm --filter @mediapeek/ui update --latest
pnpm --filter @mediapeek/shared update --latest
```

Update one package:

```bash
pnpm --filter mediapeek-web update react --latest
pnpm --filter @mediapeek/ui update shadcn --latest
```

## Shadcn Commands

Preferred:

```bash
cd packages/ui
pnpm dlx shadcn@latest --all --overwrite
```

Also works in this repo:

```bash
cd apps/web
pnpm dlx shadcn@latest --all --overwrite
```

Do not use:

```bash
cd packages/shared
```

## Env Files

```bash
apps/web/.dev.vars
apps/analyzer/.dev.vars
```

## Wrangler Commands

Run from repo root:

```bash
pnpm dlx wrangler login

pnpm --filter mediapeek-web exec wrangler secret put TURNSTILE_SECRET_KEY
pnpm --filter mediapeek-web exec wrangler secret put ANALYZE_API_KEY
pnpm --filter mediapeek-web exec wrangler secret put SESSION_SECRET

pnpm --filter mediapeek-analyzer exec wrangler secret put ANALYZE_API_KEY
```

## Deploy Order

Run from repo root:

```bash
pnpm --filter mediapeek-analyzer deploy
pnpm --filter mediapeek-web deploy
```

## Validation

Run from repo root:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Docs

- `docs/shadcn-monorepo-setup.md`
