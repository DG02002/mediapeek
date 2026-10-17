# Architecture

MediaPeek has a browser app and two Cloudflare Workers. The browser calls the
web Worker on the same origin. The web Worker applies request policy and sends
analysis requests to the analyzer Worker through a service binding. The
analyzer fetches the remote media and runs MediaInfo.

```text
Browser
   │ same-origin request
   ▼
apps/mediapeek web Worker ── service binding ──▶ apps/mediapeek-analyzer
   │                                                │
   └──────── packages/shared contracts ────────────┘
                                                    │ range requests
                                                    ▼
                                             public media source
```

## Worker boundary

The web Worker owns the public analysis route, input validation, rate limiting,
runtime configuration, and the browser-facing response. The analyzer Worker
owns outbound media fetching and MediaInfo execution. Shared request,
response, progress, and runtime contracts belong in `packages/shared` so both
Workers use the same boundary.

There is no account service, application database, server-side report store,
or server queue. The browser runs queued requests one at a time and keeps
reports in IndexedDB. A visitor can export or share a report explicitly.

## Range-based analysis

The analyzer probes a public source and reads the byte ranges MediaInfo needs.
This keeps ordinary analysis bounded and avoids downloading a complete media
file when the source supports range requests. Sources without range support
follow the controlled fallback path; they do not turn analysis into an
unbounded download.

Keep outbound-target validation, cancellation, response limits, and range
handling together when changing the fetch path. Progress events cross the
Worker boundary using the shared contract, and the browser presents them while
the request is active.

## Reports

A Media Report contains the requested output formats for one completed
analysis. The browser library owns persistence, import, export, and deletion.
Reports render on the app page: the list of stored reports, an opened report,
and the compare mode all live beside the analysis form.

Compare takes two stored reports and diffs the visitor-chosen JSON or text
output line by line, in the style of a git diff. It works only on outputs the
reports actually contain, never on rendered views.
