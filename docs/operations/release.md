# Release and deployment

GitHub Actions owns production. A push to `main` verifies the repository but
does not deploy. Production deploys only for a verified stable `vX.Y.Z` tag
that points to a commit on `main`.

## One-time GitHub setup

Create a GitHub Environment named `production` and add the environment secrets
`CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN`. These account-level values
are maintained in GitHub and Cloudflare; they do not belong in the repository.

## Stable release flow

1. Merge a reviewed pull request into `main` after verification passes.
2. Create and push a stable version tag on the approved `main` commit.
3. The tag workflow verifies the commit and builds both Workers.
4. The workflow deploys `apps/mediapeek-analyzer` first, then
   `apps/mediapeek`.
5. The web Worker `/healthz` check confirms the expected commit after deploy.

The workflow passes the release identity to both Workers and keeps Turnstile
disabled unless the production configuration explicitly enables it. If the
post-deploy health check fails, the workflow restores the prior Cloudflare
Worker versions. Do not deploy from a development shell or use Wrangler's
remote commands as a release shortcut.

Keep this guide aligned with `.github/workflows/verify.yml`. Workflow changes
must preserve the verified-tag gate, analyzer-first deployment order, and
post-deploy health check.
