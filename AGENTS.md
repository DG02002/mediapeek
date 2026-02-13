# AGENTS.md

## Purpose

- Maintain and ship MediaPeek: a React Router + Vite + Cloudflare Workers app that analyzes remote media metadata without full downloads.
- Keep changes production-safe, minimal, and consistent with the repository’s existing architecture and docs.
- Required: Prefer deterministic command-based validation over ad hoc reasoning.

## Quick Start Commands

- Required: Use `pnpm` for all package and script execution.
- Core local workflow:

```bash
pnpm install
pnpm dev
```

- Validation and runtime commands:

```bash
pnpm lint
pnpm type-check
pnpm test
pnpm check
pnpm build
pnpm preview
```

- Optional remediation (mutating):

```bash
pnpm lint-fix
pnpm format
```

- Deployment and infrastructure change (explicit request only):

```bash
pnpm deploy
```

## Repository Map

- `app/`: React Router application code (routes, server/client entrypoints, services, schemas, UI components).
- `app/routes/api/analyze/route.ts`: Main analysis API route (validation, Turnstile verification, telemetry wiring).
- `app/services/`: Server-side media fetch/analyze and telemetry services.
- `app/lib/`: Shared utilities, schema definitions, logging, and vendored MediaInfo bundle.
- `workers/app.ts`: Cloudflare Worker request handler and proxy path.
- `public/`: Static assets (icons, badges, wasm copy).
- `scripts/`: One-off asset generation scripts for badges.
- `internal-docs/`: Project-specific standards and maintenance docs.
- `wrangler.jsonc`: Cloudflare Worker config and environment bindings.

## Development Workflow

- Start by scoping impact to specific files and runtime paths before editing.
- Keep edits focused; avoid opportunistic refactors outside the requested scope.
- When changing API contracts, validation, or behavior, update related schemas/tests/docs in the same change.
- If modifying logging behavior or log shape, keep it aligned with `internal-docs/logging-guidelines.md`.
- If touching `app/lib/mediainfo-bundle.js` or MediaInfo WASM integration, follow `internal-docs/mediainfo-lib-maintenance.md`.
- Update documentation when architecture, workflow, or externally visible behavior changes (`README.md` and relevant files in `internal-docs/`).

## Verification and Testing Gates

- Required: Run checks relevant to changed scope and report results as `run/skipped/failed`.
- Required: Run `pnpm lint` for JavaScript/TypeScript/CSS-class changes.
- Required: Run `pnpm type-check` for TypeScript, route, server, worker, config, or schema changes.
- Required: Run `pnpm test` when changing tested logic or adding/updating tests under `app/**/*.test.ts` or `app/**/*.test.tsx`.
- Required: Run `pnpm build` for runtime/config/packaging changes (for example `workers/`, `wrangler.jsonc`, `vite.config.ts`, `react-router.config.ts`, dependency or build-pipeline changes).
- Recommended: Run only targeted checks for unaffected areas and explicitly mark broader suites as `skipped`.
- Optional remediation (mutating, not pass/fail gates): `pnpm lint-fix`, `pnpm format`.

## Security and Data Rules

- Never expose secrets, tokens, credentials, or sensitive env values in code, logs, commits, or PR text.
- Keep secret material out of version control; use Cloudflare secrets for sensitive Worker configuration.
- Preserve SSRF protections in URL handling (`app/lib/server-utils.ts`); do not bypass private/local/metadata host restrictions.
- Treat all inbound URLs, headers, and media metadata as untrusted input; validate and sanitize before use.
- Keep Turnstile secret verification server-side; do not move secret handling into client code.
- Follow structured logging rules in `internal-docs/logging-guidelines.md` and avoid adding high-risk sensitive fields to logs.

## Git, PR, and Release Rules

- Keep branches and PRs scoped to one logical change.
- Make commits atomic and descriptive, tied to changed behavior.
- Repository currently has no `.github/` workflow configuration; do not assume CI will validate changes for you.
- Include a concise local verification summary in PR descriptions using `run/skipped/failed`.
- Treat `pnpm deploy` as release/deployment and run it only when explicitly requested.

## Safety and Guardrails

- Do not run destructive git/file operations without explicit user request (for example `git reset --hard`, force pushes, mass deletes).
- Do not execute deployment, infra mutation, or external service provisioning commands unless explicitly requested.
- Do not casually edit generated or vendored artifacts (`build/`, `.react-router/`, `worker-configuration.d.ts`, `app/lib/mediainfo-bundle.js`, wasm artifacts); modify them only via documented regeneration/maintenance workflows when the task requires it.
- Do not fabricate policies, commands, or repository facts; state uncertainty explicitly and stop for clarification when a missing fact blocks safe execution.
- Respect license and attribution files; do not remove or weaken third-party notices.

## Progressive Disclosure Pointers

- Product overview and usage: `README.md`.
- Logging design and schema expectations: `internal-docs/logging-guidelines.md`.
- MediaInfo vendoring/patch workflow: `internal-docs/mediainfo-lib-maintenance.md`.
- UI copy style conventions: `internal-docs/writing-guidelines.md`.
- Tailwind v4 project conventions: `internal-docs/tailwindcss-guidelines.md`.
- Cloudflare runtime and bindings: `wrangler.jsonc`.

## Task Execution Protocol

- Confirm objective, impacted paths, and constraints before editing.
- Read only the files needed for the scoped change, then implement minimal diffs.
- Run scope-relevant verification gates and capture outcomes as `run/skipped/failed`.
- If a required gate fails, either fix it or report the failure with concrete next action.
- Call out risks, tradeoffs, and any follow-up work required for safe merge.

## Definition of Done

- Requested behavior is implemented and consistent with surrounding architecture.
- Relevant docs are updated when behavior, API contracts, or maintenance workflow changed.
- Scope-relevant verification gates are executed and reported in `run/skipped/failed` format.
- No secrets are introduced, logged, or committed.
- No deploy/infra-changing command was run without explicit request.
- Any generated/vendored artifact changes are intentional, minimal, and tied to documented regeneration/maintenance steps.
