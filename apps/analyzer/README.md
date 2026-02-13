# Analyzer Worker

This folder is the target home for the analysis API Worker (`/resource/analyze` and `/resources/proxy`).

Current status:

- Analyze implementation still runs in the root app during migration.
- Shared contracts now live in `packages/shared`.

Planned runtime responsibilities:

- Validate/authenticate analyze traffic.
- Fetch media chunks and run MediaInfo analysis.
- Emit structured diagnostics for CPU and upstream failures.
