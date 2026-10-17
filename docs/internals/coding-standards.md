# Coding standards

Use [AGENTS.md](../../AGENTS.md) for the repository's coding rules. This page
records the boundaries that are easy to cross accidentally.

## Shared contracts

Put contracts consumed by both Workers in `packages/shared`. Worker code must
not import contracts from the web app. Keep UI components and browser-only
state in the app.

## Effect and validation

Effect v4 is the standard for runtime services and schemas. Read
`.repos/effect-smol/LLMS.md` before writing Effect code. Validate untrusted
input at the boundary and keep domain behavior separate from transport
parsing. Do not add Zod.

## Changes and tests

Prefer removing or combining existing behavior before adding another module or
dependency. Test observable behavior through public module interfaces, with
network and browser storage isolated behind small test doubles where needed.
