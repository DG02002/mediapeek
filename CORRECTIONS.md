# Corrections

The route-level lazy-output/unmount test busy-loops during the Options menu interaction in the client test harness; T14 is covered at the session disposal boundary by asserting the pending request's abort signal.
