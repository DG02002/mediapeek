# Corrections

The route-level lazy-output/unmount test busy-loops during the Options menu interaction in the client test harness; T14 is covered at the session disposal boundary by asserting the pending request's abort signal.

Workerd canonicalizes `010.010.010.010` to `8.8.8.8`, so T15 pins the observed runtime behavior instead of the plan's `10.10.10.10` expectation.

T17 is blocked: removing `@standard-schema/spec` makes analyzer declaration emit fail because `createAnalyzerApp` and `route` expose its `Issue` type; the plan gives no approved type-boundary change, so its dependency and export edits were restored.
