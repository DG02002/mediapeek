# Release and deployment

GitHub Actions is the production deployment path. Pull requests and pushes to
`main` run verification only. Production runs only for a stable `vX.Y.Z` tag
that points to a commit on `main`; the tag workflow verifies the release before
it enters the `production` GitHub Environment.

## One-time GitHub setup

Create a GitHub Environment named `production` and add these environment
secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Scope the Cloudflare API token to the MediaPeek account and the Worker
deployment and rollback permissions it needs. Keep these values in GitHub and
Cloudflare; they do not belong in the repository.

The web Worker configuration defaults to `TURNSTILE_ENABLED=false`. The
release workflow preserves that setting. If you enable Turnstile, configure
`TURNSTILE_SECRET_KEY` and `TURNSTILE_GRANT_SECRET` as Cloudflare Worker
secrets and `TURNSTILE_SITE_KEY` as a Worker variable before releasing.
The web Worker configuration must also define the `ANALYZE_RATE_LIMITER`
binding with its production namespace ID before a stable release; the release
workflow blocks deployment when that binding is missing.

Protect `main`, require pull requests, and require the successful
`Verify / Repository verification` check before merging. Restrict creation of
the stable `v*.*.*` release tags to maintainers. These GitHub settings are
external to this repository and must be configured in GitHub.

## Plan requirements

Production requires the Workers Paid plan ($5/month) because the analyzer sets
`limits.cpu_ms = 30000`, above Free's 10 ms CPU limit, and MediaInfo WASM
analyses routinely need that headroom.
The Rate Limiting binding works on both plans and counts against ordinary
Workers request limits, so namespace setup does not depend on plan choice.
Until December 1, 2026, Workers Logs include 200,000 events per day with
3-day retention on Free and 20 million events per month with 7-day retention
on Paid; Cloudflare moves to new Observability pricing on that date.
The 10% `LOG_SAMPLE_RATE` keeps free-tier testing under its event allowance,
while error and warning events are always retained.

## Stable release flow

1. Merge a reviewed pull request into `main` after verification passes.
2. Create and push a stable `vX.Y.Z` tag on the approved `main` commit.
3. The tag workflow checks that the tag is stable and points to a commit on
   `main`, then reruns repository verification and both Worker dry-runs.
4. After verification, the workflow enters the `production` environment,
   installs the frozen dependency graph, and builds both Workers.
5. It captures the currently deployed Worker version IDs, then deploys
   `mediapeek-analyzer` followed by `mediapeek`. Both Workers receive the tag
   as `SERVICE_VERSION` and the tagged commit as `COMMIT_HASH`. The web Worker
   keeps the `TURNSTILE_ENABLED` value from its Wrangler configuration.
6. The workflow checks `https://mediapeek.plnk.workers.dev/healthz` until it
   reports `ok: true` and the expected commit and service version.
   The endpoint returns HTTP 503 if production has no
   `ANALYZE_RATE_LIMITER` binding, so the release cannot pass this check.
7. If a deployment succeeded but the health check or a later deploy step
   fails, the workflow rolls back the changed Workers in reverse deployment
   order to their captured prior version IDs.

The first deployment of a Worker has no earlier version to restore. If that
first deployment fails its health check, the job reports the failure for
maintainer action instead of attempting a rollback to a nonexistent version.
Worker rollback restores Worker code; it does not reverse changes to connected
resources, and Cloudflare can reject a rollback when resource or Durable Object
lifecycle changes prevent it. See [Cloudflare's rollback limits](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).

Do not deploy from a development shell or use Wrangler remote commands as a
release shortcut. A local deployment can bypass the verified tag and the
coordinated analyzer-first order.

The release job is in [`.github/workflows/verify.yml`](../../.github/workflows/verify.yml).
Keep its stable-tag gate, verification dependencies, Worker order, release
identity variables, health check, and rollback behavior aligned with this
guide.
