# Contributing

This guide covers the development workflow, workspace layout, and common commands for working on MediaPeek.

Unless noted otherwise, run commands from the repository root.

## Workspaces

- `apps/mediapeek`: frontend app
- `apps/mediapeek-analyzer`: analyzer worker
- `packages/ui`: shared shadcn/ui package
- `packages/shared`: shared non-UI code

## Rules

- Use the repository root for most commands
- Use `pnpm --filter ...` for one workspace
- Use `apps/mediapeek` as the shadcn app configuration
- Let `packages/ui` own the generated shared shadcn components
- Do not run shadcn in `packages/shared`

## Notes

- Run shadcn from the repository root with the app config: `pnpm dlx shadcn@latest add <component> -c apps/mediapeek`
- The app config writes shared UI output to `packages/ui/src/components`
- Keep shared shadcn dependencies and generated components in `packages/ui`
- Do not run shadcn commands in `packages/shared`
- Use the repository root for `pnpm install`, `pnpm update -r`, `pnpm lint`, `pnpm test`, `pnpm typecheck`, and `pnpm build`
- Use `pnpm fmt` and `pnpm fmt:check` for `oxfmt` formatting
- After dependency or shadcn updates, review the git diff before committing
- The sample app in `sample/react-router-monorepo` is reference-only; do not migrate or clean its tooling as part of main repo work

## Root Commands

```bash
pnpm install
pnpm dev
pnpm lint
pnpm fmt
pnpm fmt:check
pnpm typecheck
pnpm test
pnpm build
pnpm format
pnpm clean
pnpm approve-builds
```

## Filter Names

```bash
mediapeek
mediapeek-analyzer
@mediapeek/ui
@mediapeek/shared
```

## Web Commands

```bash
pnpm --filter mediapeek dev
pnpm --filter mediapeek lint
pnpm --filter mediapeek typecheck
pnpm --filter mediapeek test
pnpm --filter mediapeek build
pnpm --filter mediapeek deploy
pnpm --filter mediapeek cf-typegen
```

## Analyzer Commands

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

```bash
pnpm --filter @mediapeek/ui lint
pnpm --filter @mediapeek/ui typecheck
pnpm --filter @mediapeek/ui test

pnpm --filter @mediapeek/shared lint
pnpm --filter @mediapeek/shared typecheck
pnpm --filter @mediapeek/shared test
```

## Dependency Update Commands

```bash
pnpm update -r
pnpm update -r --latest
```

Update one workspace:

```bash
pnpm --filter mediapeek update --latest
pnpm --filter mediapeek-analyzer update --latest
pnpm --filter @mediapeek/ui update --latest
pnpm --filter @mediapeek/shared update --latest
```

Update one package:

```bash
pnpm --filter mediapeek update react --latest
pnpm --filter @mediapeek/ui update shadcn --latest
```

## Shadcn Commands

Preferred shared UI workflow:

```bash
pnpm dlx shadcn@latest add button -c apps/mediapeek
```

This uses `apps/mediapeek/components.json` and writes shared UI files to:

```bash
packages/ui/src/components
```

Do not use:

```bash
cd packages/shared
```

## Env Files

```bash
apps/mediapeek/.dev.vars
apps/mediapeek-analyzer/.dev.vars
```

## Wrangler Commands

```bash
pnpm dlx wrangler login

pnpm --filter mediapeek exec wrangler secret put TURNSTILE_SECRET_KEY
pnpm --filter mediapeek exec wrangler secret put ANALYZE_API_KEY
pnpm --filter mediapeek exec wrangler secret put SESSION_SECRET

pnpm --filter mediapeek-analyzer exec wrangler secret put ANALYZE_API_KEY
```

## Deploy Order

```bash
pnpm --filter mediapeek-analyzer run deploy
pnpm --filter mediapeek run deploy
```

## Validation

```bash
pnpm lint
pnpm fmt:check
pnpm typecheck
pnpm test
pnpm build
```

## Docs

- `docs/shadcn-monorepo-setup.md`
