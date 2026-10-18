# MediaPeek

MediaPeek is a browser-based MediaInfo analyzer. A visitor submits a public
media URL, and the web Worker asks the analyzer Worker to inspect it with
range-based fetching. Reports stay in the visitor's browser unless they choose
to export or share them.

Keep the product simple, predictable, and useful as it grows.

## What makes MediaPeek special?

It is important to maintain the things that make MediaPeek useful as we
iterate. Here is what we cannot compromise on.

MediaPeek is not another media catalogue or downloader. It starts with a URL
the visitor already has and answers one question well: what is inside this
file?

### 1. Public analysis without accounts

MediaPeek has no accounts, sign-in, usage system, or application database.
The public analysis path is the only analysis path, and the analyze
endpoint's admission control is its rate limiter. Turnstile is a separate,
config-gated feature that defaults off.

### 2. Built around range-based reads

The analyzer reads only the byte ranges MediaInfo needs instead of
downloading whole files. Outbound target checks, response limits,
cancellation, and unsupported-range fallbacks are part of the fetch path, not
add-ons around it.

### 3. Reports live on the device

A Media Report keeps every requested output format in the visitor's browser
storage. Reports leave the device only when the visitor exports or shares
them. There is no server-side report storage.

### 4. The visitor's selections stay theirs

The queue, the saved reports, and the comparison are built around what the
visitor submitted and saved. Nothing catalogues media on their behalf.

## Priorities

Correctness, reliability, and maintainability come first. Treat retries,
timeouts, partial responses, unsupported ranges, and upstream failures as
normal product states. If a tradeoff is required, choose correctness and
robustness over short-term convenience. In the code itself, prioritize
correctness and clarity; speed and efficiency are secondary unless the task
says otherwise.

Long-term maintainability is a core priority. If you add new functionality,
first check if shared logic can be extracted into a separate module. Duplicate
logic across multiple files is a code smell and should be avoided. Don't be
afraid to change existing code. Don't take shortcuts by just adding local
logic to solve a problem. Prefer implementing functionality in existing
files unless it is a new logical component, and avoid creating many small
files.

## A note from MediaPeek

I like ambitious ideas, simple systems, and software that feels obvious. Do
not preserve complexity just because it already exists. Do not introduce
machinery because it looks architecturally impressive. Understand the real
constraint, then fight for the smallest model that makes the correct behavior
unsurprising.

Channel both "measure twice, cut once" and "yagni". Fight scope creep. Try to
honor the dev's intent in both a minimal and realistic fashion.

The rest of this document is meant to help you navigate the codebase and make
changes effectively. Think of these instructions less as "hard rules", more as
"good defaults". The developer's preferences should be able to override
anything here. If a rule in this file fights the task in front of you, say so
loudly and get a human sign-off before breaking it.

## A small glossary

Use the product terms in `CONTEXT.md` instead of inventing synonyms.

- **you** means the agent reading this file and changing MediaPeek.
- **agent** means the coding agent working in this repository.
- **we**, **us**, and **maintainers** mean the people building and maintaining
  MediaPeek.
- **visitor** means a person using MediaPeek to analyze a media URL.
- **Media Report** means one completed analysis and every output format it
  produced.
- **web app** means the React Router application and its Cloudflare Worker.
- **analyzer Worker** means the Worker that fetches remote media and runs
  MediaInfo.

## Product invariants

- MediaPeek has no accounts, login, usage system, D1, or server-side report
  storage. Public analysis is the only analysis path.
- The analyze endpoint's admission control is its rate limiter. Turnstile is
  a separate, config-gated feature that defaults off.
- Reports live in the visitor's browser storage. A report keeps every
  requested output format; reports leave the device only when the visitor
  exports or shares them.
- The analysis queue runs in the browser and processes one URL at a time.
- The compare view diffs the visitor-chosen JSON or text output line by line,
  like git diff. It never diffs rendered views.
- Browser and Worker contracts live in `packages/shared`, which both Workers
  consume.
- Effect v4 is the runtime and schema library. Keep Zod out of the codebase.

## Hit every surface

The most common defect is a change that works on the path you tested and is
missing everywhere else. Before calling work done, walk this list and say
which entries applied. Fixing one path is not fixing the feature.

- **Entry points.** URL submission, queued analysis, stored reports, report
  comparison, settings, exports, and sharing.
- **Contracts.** Browser routes, web Worker, analyzer Worker, and shared
  package contracts.
- **Storage.** Browser state and IndexedDB. Analysis reports do not gain a
  server persistence path.
- **Reverse states.** Retry, cancel, reopen, delete, export, and
  failed analysis.
- **Outputs.** JSON, text, HTML, XML, and PNG where the feature uses them.
- **Operations.** Local secrets, CI checks, release workflow, and health
  check.
- **Docs.** User-visible behavior belongs in the product UI. Architecture and
  maintainer procedures belong in `docs/internals/` and `docs/operations/`.

## Ways to hurt yourself

1. **Deploying production from a development shell.** CI owns production.
   Never run `wrangler deploy` or any `--remote` command locally. Stable tags
   deploy the analyzer Worker first, then the web Worker, and verify
   `/healthz`.
2. **Committing secrets.** `.env` and `.dev.vars` contain local values. Keep
   secrets in per-app `.dev.vars`; commit only the example files.
3. **Bypassing the analyzer's fetch protections.** Keep range reads, outbound
   target checks, cancellation, and response limits intact when changing
   media fetching.
4. **Treating the archive as current history.** `archive/pre-rebuild` is a
   read-only porting source. Copy only the files the rebuild plan calls for;
   never merge, rebase, or cherry-pick the branch.
5. **Editing vendored references.** `.repos/` contains read-only local
   references. Read `.repos/effect-smol/LLMS.md` before writing Effect code.
6. **Killing processes by pattern.** Never `pkill -f`, pipe `pgrep` to
   `kill`, or kill a PID found by matching a name, path, or worktree
   string; the pattern can match your own session or an unrelated dev
   server. Stop only a process you captured at spawn, or the owner of your
   port after confirming it is yours.

## Dev servers

- `pnpm dev` runs the web app through Vite with the Cloudflare runtime.
- `pnpm --filter mediapeek-analyzer exec wrangler dev` runs the analyzer
  Worker alone.
- The installed Wrangler runtime can lag the committed compatibility date;
  the local development guide documents the temporary override workflow.
  Tracked configs keep the real date.

## Linting and formatting

While iterating, apply the touched package's `fmt` script and its
`lint:fix`-style scripts where provided. Every workspace package and the root
workspace expose `fmt`/`fmt:check` for their checked files. Warnings fail
every lint run through `denyWarnings` in the root `.oxlintrc.json`, so a
warning is a failure everywhere. When feeding lint output back into an agent
loop, run `oxlint --format=agent <paths>` for one compact line per finding.

Knip runs in both modes inside `pnpm check`: the default run and the
production run (`knip:production`), which ignores test coverage on purpose.
After removing an export's last consumer, `pnpm exec knip --fix --fix-type
exports` strips it; repeat lint and knip until both stay green, because each
removal can expose the next.

## Verifying

- Use the smallest proof that demonstrates the change.
- Test meaningful logic and observable behavior through the public interface.
- Behavior changes need focused tests for the behavior they change.
- Wait on the real completion signal — a response, a progress event, a
  storage write — never on sleeps or polling. A test that needs a timeout to
  pass is wrong.
- Before handoff, use the repository gates in the local development guide.

## Pull requests

- Never make a PR unless the developer explicitly asks you to do so.
- Use a clear, correctly capitalized, imperative title with no trailing
  punctuation, for example `Fix queue retries losing the active item`. Do
  not use conventional commit prefixes (`fix:`, `feat:`, `docs:`).
- Follow `.github/pull_request_template.md`. Every claim in the body must be
  checkable against the diff; never state an intention as a completed result.
- Review the premise, not only the diff. Spend at least one sentence of
  every review asking whether the spec itself is right — especially for
  docs, where the artifact is the design.
- UI changes need before/after images. Capture them yourself only when the
  developer has agreed to browser or computer use; otherwise ask the
  developer to attach them to the PR. A UI PR with no visual evidence must
  at least carry that request.
- Upload PR evidence to GitHub. Never commit PR-only screenshots or assets.
- One concern per PR, where a concern is a change that can be reviewed and
  reverted on its own. Changes that only make sense together — a contract
  change and its consumers, a migration and the code that reads it — are one
  concern. An unrelated "also" in the description is a smell to raise with
  the developer, not a mandate to spin up more PRs.
- When babysitting: poll checks and comments newer than the last push, verify
  each bot finding against the source, fix real ones, dismiss false positives
  with a written reason. Stay quiet when nothing is new. Stop when the bots
  are green on the latest commit.

## Rules hygiene

AGENTS.md is read by every agent session. Keep it high-signal.

### After any agentic session

If you discover a non-obvious pattern that would help future sessions,
include a **Suggested AGENTS.md additions** section in the PR description
with the proposed text. Do **not** edit AGENTS.md inline during normal
feature or fix work. Reviewers decide what gets merged.

### High bar for new rules

Editing or clarifying existing rules is always welcome. New rules must meet
all three criteria:

1. **Non-obvious** — someone familiar with the codebase would still get it
   wrong without the rule.
2. **Repeatedly encountered** — it came up more than once (multiple hits in
   one session counts).
3. **Specific enough to act on** — a concrete instruction, not a vague
   principle.

If lint or formatting can enforce it, it belongs in the oxlint or oxfmt
configuration, not here. Avoid architectural descriptions of the codebase
(module layout, data flow, key types): they go stale fast, the agent can
gather them by reading the code, and durable architecture belongs in
`docs/internals/`. Rules should be **traps to avoid**, not **maps to
follow**.

## Plans and work artifacts

- Do not commit implementation plans, research notes, or agent scratch files.
  Keep temporary working material outside the worktree. `.plans/` is ignored
  as a safety net, not as an accepted project-artifact directory.
- Track active maintainer work in the GitHub issue or project item that owns
  it.
- Put durable architecture, constraints, and decisions in
  `docs/internals/`. Put deployment and operational procedures in
  `docs/operations/`.
- A merged PR is the implementation record. Update the tracking item when the
  work lands; do not preserve a second checklist in the repository.

## Documentation

Most code changes do not need a documentation change. Agents can read the
code.

- User-visible behavior belongs beside the feature in the product UI. Give
  each major feature a concise treatment covering what it does and anything
  unintuitive. Before adding text, ask what task or decision it helps the
  visitor with.
- `docs/internals/` is for architectural decisions and their reasons,
  constraints that span components, and implementation traps that are hard
  to discover from the source. Before adding a paragraph, ask what a
  maintainer would get wrong without it. If reading the relevant code
  answers the question, leave it out.
- `docs/operations/` is for maintainer setup, release, and debugging
  procedures.
- Do not enumerate fields or methods, narrate control flow, maintain file
  catalogs, or append PR summaries. Types, tests, and code already record
  the implementation.
- When a documented decision or constraint changes, rewrite or remove the
  affected text. Do not append another account of the new behavior.

## How it works

The browser submits URLs to the same-origin analyze route. The web Worker
applies input validation and rate limiting, then sends the request to the
analyzer Worker through a service binding. The analyzer probes the public
source and reads the byte ranges MediaInfo needs, streaming progress back
over the shared contract. The browser renders the report and keeps any saved
reports in IndexedDB on the device.

## Where code lives

- `apps/mediapeek` - React Router UI, web Worker, analysis queue, reports,
  comparison, and exports.
- `apps/mediapeek-analyzer` - analyzer Worker, MediaInfo integration, and
  safe outbound fetching.
- `packages/shared` - contracts and utilities consumed by both Workers.
- `apps/mediapeek/app/components/ui/` - generated shadcn primitives. Treat
  them as read-only and compose them from feature code outside this
  directory. The formatter and linter configurations exclude this directory;
  do not reformat or hand-edit its files. Delete wholly-unused components
  instead of keeping them; knip flags them and the shadcn CLI can restore
  them.
- `tools/oxlint/anti-slop/` - vendored Oxlint plugin installed by the
  `install-anti-slop` skill. Never edit or reformat it; update it by
  re-running the skill.
- `.repos/` - vendored read-only references. Prefer their patterns over
  invented ones. Never edit or import from them. Sync with
  `pnpm run sync:repos` when bumping the matching dependency. Read
  `.repos/effect-smol/LLMS.md` before writing Effect code.

## Code style

Use interfaces for object contracts, arrow functions, and kebab-case file
names with descriptive names. Use `Boolean(value)` instead of `!!value`. Put
shared constants in `constants.ts` as `SCREAMING_SNAKE_CASE` names with unit
suffixes where the value has a unit. Avoid comments; add a `// HACK:`
comment only when a workaround needs its reason recorded.

## Taste

- Put fetch-side complexity at the analyzer boundary. Keep browser state
  explicit and local.
- Measure before adding a cache, queue, or task orchestrator.
- Probe beats speculate. Every rule in this file is compressed experience,
  and compression loses things — when a rule and reality disagree, run the
  experiment and believe what you saw. Play all you want while you learn;
  just keep the mess out of the worktree and the write paths honest.
- Every external read has a deadline, a size bound, and a cancellation path.
  Unbounded `.text()`, `.json()`, or `.arrayBuffer()` on an external
  response belongs behind the analyzer's validated-fetch helpers.
- Never silently discard errors. Handle them, propagate them, or surface them
  to the user. When discarding an error is genuinely intended, make the
  discard explicit and leave a comment saying why.
- When implementing async operations that may fail, make sure the error
  reaches the UI so the user gets meaningful feedback.
- Comments exist to explain why code is written a certain way when the reason
  is tricky or non-obvious. Do not write organizational comments or comments
  that summarize the code.
- Use full words in names (no abbreviations like `q` for `queue`).
- A lying spinner, stale label, or lost progress update is a product bug.

## Additional tips

- Don't verify with browsers or computer use unless the user explicitly
  agrees or requests it. When they do, use a clean browser profile, never
  the user's personal session. If the tooling fights you, stop and ask the
  user to check the result instead of grinding.
- When the developer asks for browser verification, drive the
  chrome-devtools MCP server (dedicated persistent profile) against
  `pnpm dev`.
