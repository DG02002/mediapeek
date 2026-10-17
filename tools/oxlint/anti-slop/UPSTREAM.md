# Anti-slop provenance

## Source snapshots

- Previous MediaPeek installation: `archive/pre-rebuild` at
  `cc4ba3409bf4e152e98126a1e21d256712d84548`.
- Adopted bundle: `.agents/skills/install-anti-slop/assets/anti-slop`, tracked
  in `a3788f3cd88fb9009703297aa06b4dfba28165d3`.
- The skill bundle does not identify an upstream repository revision for the
  anti-slop rules. That upstream identity is unknown. The separately vendored
  ESLint Stylistic padding rule records its exact source revision in
  `vendor/eslint-stylistic/UPSTREAM.md`.
- There is no verified common upstream base between the archived installation
  and the skill bundle. The archived tree is recoverable from Git; its copy
  before this merge is also retained at
  `/tmp/mediapeek-anti-slop.8PrV8z/archive-baseline` for review.

## Adopted changes

- Preserved the archived generic and Effect rule paths and adopted the tracked
  skill implementations for those rules.
- Added `no-array-filter-map`, `no-reduce-accumulator-copy`, and
  `require-readable-spacing`, along with their helpers and licensed
  ESLint Stylistic support files.
- Added the four Effect rules and helper support from the skill bundle.
- Enabled the generic rules, native `oxc/no-accumulating-spread` companion,
  and Effect rules at error severity in the root Oxlint configuration.
- Pinned `oxlint` and `@oxlint/plugins` to the matching catalog version
  `1.82.0`.

## Verification

`CI=true pnpm install --no-frozen-lockfile` succeeded with the strict
release-age and build policies. Oxlint 1.82 loaded both plugins; the
`no-array-filter-map` rule rejected a scratch violation, and a valid `typeof`
existence probe passed. Full lint, typecheck, and workspace checks remain for
Workstream B's final gate.
