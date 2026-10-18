# Frontend Worker

This folder is the target home for the SSR frontend Worker.

## Current Status

- The repo still runs from the root Worker entry point.
- Split is staged incrementally to keep production stable.

## Planned Runtime Responsibilities

- Render UI routes and static pages.
- Forward analysis requests to `apps/mediapeek-analyzer` using internal auth/service bindings.
