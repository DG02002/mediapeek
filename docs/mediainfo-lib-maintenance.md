# MediaInfo.js Maintenance & Update Guide

**Last Updated:** October 2026
**Library Version:** `mediainfo.js` v0.3.8

## Overview

We use a **vendored and patched** version of `mediainfo.js` in this project. This is necessary because the default library implementation is incompatible with Cloudflare Workers' security model, which disallows runtime WebAssembly compilation ("Wasm code generation disallowed").

We have implemented a workaround that loads a **pre-compiled** WebAssembly module (built by Vite/Cloudflare) and forces the library to use it synchronously.

## Files Involved

The application and analyzer Worker each use the same vendored package and
Cloudflare WASM patches:

1. **`apps/mediapeek/app/lib/mediainfo-bundle.js`** and **`apps/mediapeek-analyzer/src/lib/mediainfo-bundle.js`**: The vendored (and patched) library code, copied from `dist/esm-bundle/index.js` in the npm package.
2. **`apps/mediapeek/app/services/MediaInfoModule.wasm`** and **`apps/mediapeek-analyzer/src/services/MediaInfoModule.wasm`**: The precompiled WASM binaries imported by the app and analyzer factories.
3. **`apps/mediapeek/app/services/mediainfo-factory.server.ts`** and **`apps/mediapeek-analyzer/src/services/mediainfo-factory.server.ts`**: Factories that initialize the library using the patched bundles and imported WASM modules.

## Why Patching is Required

Cloudflare Workers require `WebAssembly.instantiate(module, imports)` where `module` is an already-compiled `WebAssembly.Module` object.
However, `mediainfo.js` (asm.js/emscripten output) has two blocking issues:

1. **Wrapper Filter**: The outer `mediaInfoFactory` function filters out unknown options, so if we pass `wasmModule`, it gets stripped before reaching the core logic.
2. **Fetch Priority**: The internal `instantiateAsync` logic prioritizes `fetch`ing the `.wasm` file over using a provided module instance, leading to a "Wasm code generation disallowed" runtime error.

## How to Update `mediainfo.js`

When you need to update the library to a newer version, you cannot just run `pnpm update`. You must manually update the vendored files and re-apply the patches.

### Step 1: Get the New Files

1. Install the selected version locally or in a temp folder: `pnpm i mediainfo.js@<version>`.
2. Copy `node_modules/mediainfo.js/dist/MediaInfoModule.wasm` to both app service directories listed above.
3. Copy `node_modules/mediainfo.js/dist/esm-bundle/index.js` to both bundle paths listed above.

### Step 2: Apply Patch 1 (The Factory Wrapper)

Open `app/lib/mediainfo-bundle.js` and go to the very bottom, close to the `mediaInfoFactory` function.

**Locate this block:**

```javascript
// Options passed to the Emscripten module loader
const mediaInfoModuleFactoryOpts = {
  // Silence all print in module
  print: noopPrint,
  printErr: noopPrint,
  locateFile: locateFile ?? defaultLocateFile,
  onAbort: (err) => {
    // ...
  },
}
```

**Change it to:**

```javascript
// Options passed to the Emscripten module loader
const mediaInfoModuleFactoryOpts = {
  // Silence all print in module
  print: noopPrint,
  printErr: noopPrint,
  locateFile: locateFile ?? defaultLocateFile,
  // Pass custom WASM module if provided (critical for Cloudflare/Vite)
  wasmModule: options.wasmModule,
  onAbort: (err) => {
    // ...
  },
}
```

### Step 3: Apply Patch 2 (The Instantiation Logic)

In `app/lib/mediainfo-bundle.js`, search for the function `async function instantiateAsync`. It is usually in the middle of the "Module" closure.

**Locate:**

```javascript
  async function instantiateAsync(binary, binaryFile, imports) {
    {
      try {
        var response = fetch(binaryFile, { credentials: 'same-origin' });
        // ...
```

**Insert this check at the very top of the function:**

```javascript
  async function instantiateAsync(binary, binaryFile, imports) {
    // Use pre-compiled module if provided
    if (Module['wasmModule']) {
      try {
        var instance = await WebAssembly.instantiate(Module['wasmModule'], imports);
        return { instance: instance, module: Module['wasmModule'] };
      } catch (e) {
        // err/abort are internal logging variables in this scope
        if (typeof err !== 'undefined') err(`wasm instantiation failed: ${e}`);
        if (typeof abort !== 'undefined') abort(e);
        console.error(e);
        throw e;
      }
    }
    // ... rest of the function (original fetch logic)
    {
      try {
        // ...
```

### Step 4: Verify

Run `pnpm build` and verify that the application (specifically the `resource.analyze` route) works correctly in the Cloudflare environment. The build should succeed, and runtime analysis should return metadata without "Code generation disallowed" errors.

## Type Safety & Directives

In `app/services/mediainfo-factory.server.ts`, you will notice the following directive:

```typescript
// @ts-expect-error - Import collocated WASM module for bundling
import wasmModule from "./MediaInfoModule.wasm"
```

**Reasoning:**

- We import a `.wasm` file directly so that Vite/Rollup can process it as an asset/module.
- TypeScript does not natively understand `.wasm` imports without extensive global type augmentation (e.g., `declare module '*.wasm'`).
- Adding global wildcards can be fragile and may conflict with other environment types.
- **Decision**: We explicitly use `@ts-expect-error` as a directive. This is better than `eslint-disable` because it acknowledges a specific TypeScript limitation in this environment while keeping the rest of the file strict. DO NOT remove this unless you have implemented a robust global type declaration that works across `pnpm type-check` and the build system.

## Known Incompatibilities

### Prerendering

**DO NOT enable `prerender()` in `react-router.config.ts`.**

Prerendering runs server code at build time in a Node.js/Vite environment, which triggers WASM loading via the direct `.wasm` import. This environment cannot handle WASM imports the same way Cloudflare Workers can, resulting in build errors like:

```text
Cannot find package 'a' imported from .../MediaInfoModule-*.wasm
```

If you need static pages (like `/privacy` or `/terms`), serve them dynamically via SSR rather than prerendering.
