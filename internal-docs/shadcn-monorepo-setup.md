# Shadcn UI + Tailwind CSS v4 Monorepo Setup Guide

## The "Missing Classes" Issue

When using Shadcn UI components in a monorepo with Tailwind CSS v4, you may encounter an issue where utility classes (especially for components like `Button`, `Input`, `Dialog`, etc.) are not generated, resulting in unstyled components.

**Symptoms:**

- Components look unstyled or broken.
- Classes like `bg-primary`, `text-primary-foreground` seem to be ignored.
- Tailwind works fine for classes used directly in your app code but fails for imported components.

## The Cause

Tailwind CSS v4 uses a new detection engine that scans your files to generate CSS. in a monorepo structure, Tailwind might not automatically detect files located in other packages (like `packages/ui` linked to `apps/web`) or might miss them depending on how the workspace is structured.

## The Solution: `@source` Directives

You must explicitly tell Tailwind where to look for your source files using the `@source` directive in your CSS entry point.

**Crucial Rule:** The order of directives matters.
`@source` must come **immediately after** `@import "tailwindcss";`.

### 1. Configure `packages/ui/src/styles/globals.css`

If you have a shared UI package, ensure it knows where its own components are:

```css
@import 'tailwindcss';
@source '../components/**/*.{ts,tsx}'; /* <-- POINT TO YOUR COMPONENT FILES */
@import 'shadcn/tailwind.css'; /* <-- IF USING SHADCN THEME */
@import 'tw-animate-css';
```

### 2. Configure `apps/web/app/app.css` (or main CSS)

Your application needs to scan **both** its own files **and** the shared UI package files:

```css
@import 'tailwindcss';
/* 1. Local Application Files */
@source './**/*.{ts,tsx}';

/* 2. Shared UI Package Files */
@source '../../../packages/ui/src/**/*.{ts,tsx}';

@import 'shadcn/tailwind.css';
/* ... other imports */
```

## Why this works

The `@source` directive explicitly adds paths to the content configuration. By pointing to `packages/ui/src/**/*`, you ensure that even though the UI package is in `node_modules` (or symlinked), Tailwind v4 explicitly scans those files for class names to generate.

---

**References:**

- [Tailwind CSS v4 Documentation - Detecting Classes in Source Files](https://tailwindcss.com/docs/detecting-classes-in-source-files)
- GitHub Issue: [shadcn-ui/ui#6878](https://github.com/shadcn-ui/ui/issues/6878)
