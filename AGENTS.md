# MediaPeek

MediaPeek is a browser-based MediaInfo analyzer. A visitor submits a public
media URL, and the web Worker asks the analyzer Worker to inspect it with
range-based fetching. Reports stay in the visitor's browser unless they choose
to export or share them.

Keep the product useful, predictable, and small as it grows.

## Priorities

Correctness, reliability, and maintainability come first. Treat retries,
timeouts, partial responses, unsupported ranges, and upstream failures as
normal product states. Choose robustness over short-term convenience.

Prefer the smallest model that makes the required behavior clear. Reuse shared
logic where it has more than one real consumer; avoid machinery that only adds
layers. Preserve the task's product decisions and ask when a requirement is
outside them.

## Product invariants

- MediaPeek has no accounts, login, usage system, D1, or server-side report
  storage. Public analysis is the only analysis path.
- The analyze endpoint's admission control is its rate limiter. Turnstile is a
  separate, config-gated feature that defaults off.
- Reports live in the visitor's browser storage. A report keeps every requested
  output format; reports leave the device only when the visitor exports or
  shares them.
- The analysis queue runs in the browser and processes one URL at a time.
- The compare view diffs the visitor-chosen JSON or text output line by line,
  like git diff. It never diffs rendered views.
- Browser and Worker contracts live in `packages/shared`, which both Workers
  consume.
- Effect v4 is the runtime and schema library. Keep Zod out of the codebase.

## Hit every surface

Before calling a feature complete, trace every path it affects and state which
ones apply:

- **Entry points.** URL submission, queued analysis, stored reports, report
  comparison, settings, exports, and sharing.
- **Contracts.** Browser routes, web Worker, analyzer Worker, and shared
  package contracts.
- **Storage.** Browser state and IndexedDB. Analysis reports do not gain a
  server persistence path.
- **Reverse states.** Retry, cancel, reopen, delete, import, export, and failed
  analysis.
- **Outputs.** JSON, text, HTML, XML, and PNG where the feature uses them.
- **Operations.** Local secrets, CI checks, release workflow, and health check.
- **Docs.** User-visible behavior belongs in the product UI. Architecture and
  maintainer procedures belong in `docs/internals/` and `docs/operations/`.

## Ways to hurt yourself

1. **Deploying production from a development shell.** CI owns production.
   Never run `wrangler deploy` or any `--remote` command locally. Stable tags
   deploy the analyzer Worker first, then the web Worker, and verify `/healthz`.
2. **Committing secrets.** `.env` and `.dev.vars` contain local values. Keep
   secrets in per-app `.dev.vars`; commit only the example files.
3. **Bypassing the analyzer's fetch protections.** Keep range reads, outbound
   target checks, cancellation, and response limits intact when changing media
   fetching.
4. **Treating the archive as current history.** `archive/pre-rebuild` is a
   read-only porting source. Copy only the files the rebuild plan calls for;
   never merge, rebase, or cherry-pick the branch.
5. **Editing vendored references.** `.repos/` contains read-only local
   references. Read `.repos/effect-smol/LLMS.md` before writing Effect code.

## Linting, formatting, and verification

- Use the root scripts and current configuration as the source of truth for
  lint, formatting, and verification commands.
- Format touched files and run the relevant package checks. Run `pnpm check`,
  `pnpm test`, and `pnpm build` before handing off a complete change; Worker
  changes also need both `wrangler deploy --dry-run` checks.
- Treat lint warnings as failures. Fix the source finding instead of adding a
  suppression, unsafe cast, or deleted test.
- Prefer focused tests through the module's public interface. Cover retries,
  cancellation, malformed input, and failure results when they apply.
- Use interfaces for object contracts, arrow functions, kebab-case file names,
  descriptive names, and `Boolean(value)` instead of `!!value`.
- Put shared constants in `constants.ts` as `SCREAMING_SNAKE_CASE` names with
  unit suffixes where the value has a unit.
- Avoid comments. Add a `// HACK:` comment only when a workaround needs its
  reason recorded.

## Pull requests

- Open a pull request only when the developer asks for one.
- Follow `.github/pull_request_template.md`. Use an imperative title with
  normal capitalization and no conventional-commit prefix.
- Make every body claim verifiable from the diff. Keep `Release Notes:` as the
  final section with one bullet: `- Added ...`, `- Fixed ...`, or
  `- Improved ...` for user-facing changes; use `- N/A` for other changes.
- Do not merge or close a pull request unless the developer asks.

## Rules hygiene

Keep this file high-signal. Add rules only for non-obvious problems that have
recurred and have a specific action. If tooling can enforce a rule, put it in
the lint or format configuration instead.

Do not commit implementation plans or agent scratch files. `.plans/` is
ignored; use it only when the developer has supplied a plan that must remain
available locally during the task.

## Documentation

- Put user-facing instructions beside the feature in the product UI.
- Put architecture decisions and constraints that span components in
  `docs/internals/`. Put setup and release procedures in `docs/operations/`.
- Include only what a maintainer would get wrong without the document. Do not
  maintain file catalogs, enumerate fields, narrate code, or append PR
  summaries.
- When a documented decision changes, rewrite or remove the old account.

## Where code lives

- `apps/mediapeek` is the React Router web app and web Worker.
- `apps/mediapeek-analyzer` is the analyzer Worker and MediaInfo integration.
- `packages/shared` owns contracts and utilities shared by both Workers.
- `apps/mediapeek/app/features/{analyze,library,diff,settings}` owns
  feature-specific UI and logic.
- `apps/mediapeek/app/components/ui/` contains generated shadcn primitives.
  Treat those files as read-only and compose them from feature code.
- `tools/oxlint/anti-slop/` is vendored lint tooling. Do not edit or format it
  by hand; update it with the `install-anti-slop` skill.
- `.repos/` contains read-only reference checkouts. Sync it with
  `pnpm sync:repos` when the dependency guidance requires it.

## Taste

Keep browser state explicit and local. Keep the two Worker responsibilities
clear. Prefer plain modules over new frameworks, and expose errors to the user
when an operation fails. Names use full words; comments explain only a
non-obvious reason. A stale status, lost progress update, or misleading
success state is a product bug.
