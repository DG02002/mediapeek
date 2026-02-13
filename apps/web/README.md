# Frontend Worker

This folder is the target home for the SSR frontend Worker.

Current status:

- Repo is still running from the root Worker entrypoint.
- Split is staged incrementally to keep production stable.

Planned runtime responsibilities:

- Render UI routes and static pages.
- Forward analysis requests to `apps/analyzer` using internal auth/service bindings.
