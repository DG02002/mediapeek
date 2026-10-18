# Contributing

## Developer setup

See the [development guide](docs/internals/development.md#first-checkout) for
the first checkout, local secrets, development commands, and verification.

## Read this first

MediaPeek is a focused browser-based media metadata analyzer. We welcome
focused fixes and maintenance work that preserve its product invariants.
Discuss substantial feature requests and changes in direction before
implementation.

Bug reports and pull requests are welcome. Keep changes scoped, tested, and
consistent with the product. Pull requests receive automated size and trust
labels. External contributors remain `vouch:unvouched` until maintainers add
them to [`.github/VOUCHED.td`](.github/VOUCHED.td).

## What we are most likely to accept

- Focused bug fixes.
- Reliability fixes for retries, timeouts, partial responses, and upstream
  failures.
- Measured performance improvements.
- Scoped maintenance that keeps the product's direction intact.

## What we are least likely to accept

- Large pull requests with unrelated changes.
- Drive-by features or opinionated rewrites.
- New product direction without maintainer discussion.
- New heavyweight dependencies without a clear need and prior discussion.

## If you open a pull request

Keep it small. Explain what changed and why, and do not combine unrelated
work. Include focused tests for behavior changes and run the repository's
verification commands before requesting review.

For interface changes, include clear before and after images. For changes that
depend on motion, timing, or interaction details, include a short video.

Use the repository's pull request template. Describe only results visible in
the diff, and complete its `Release Notes:` section.

## Discuss changes first

Open an issue or discussion for non-trivial proposals before starting work.
That gives maintainers a chance to confirm the direction and scope.

## Be realistic

Opening a pull request does not obligate maintainers to review or merge it.
They may ask you to reduce its scope, close it, or implement a different
approach.
