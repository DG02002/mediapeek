# Tailwind CSS v4+ Internal Documentation

This document serves as the authoritative guide for using Tailwind CSS v4.0 and v4.1+ in our projects. It covers setup, configuration, migration from v3, new features, and coding best practices that all agents and developers must follow.

## 1. Overview & Key Changes

Tailwind CSS v4 is a complete rewrite focused on performance and modern CSS features.

- **Performance**: A new engine rewritten in Rust/Lightning CSS delivers vastly improved build times.
- **CSS-First Configuration**: `tailwind.config.js` is replaced by native CSS directives (`@theme`, `@utility`).
- **Modern Standards**: targets modern browsers (Chrome 111+, Safari 16.4+, Firefox 128+) leveraging `@property`, `color-mix()`, and native cascade layers.
- **No specialized plugins**: Core plugins are now dedicated packages (`@tailwindcss/vite`, `@tailwindcss/postcss`, `@tailwindcss/cli`).

## 2. Setup & Tooling

### Preferred Integration: Vite

For Vite-based projects, use the dedicated Vite plugin. `postcss-import` and `autoprefixer` are **not required**.

```ts
// vite.config.ts
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss()],
});
```

### CSS Entry Point

The `@tailwind` directives are removed. Use a single import:

```css
/* app/globals.css */
@import 'tailwindcss';
```

## 3. CSS-First Configuration

Configuration now lives in your CSS file.

### Defining Theme Variables

Use `@theme` to define design tokens. These become available as utility classes and CSS variables.

```css
@theme {
  /* Overrides or extends the default theme */
  --font-display: 'Satoshi', 'sans-serif';
  --color-brand-500: oklch(0.72 0.18 255);
  --breakpoint-3xl: 120rem;

  /* To clear default colors and start fresh: */
  /* --color-*: initial; */
}
```

### Custom Utilities

Use `@utility` instead of `@layer utilities`.

```css
@utility tab-4 {
  tab-size: 4;
}

@utility btn-primary {
  @apply bg-brand-500 rounded px-4 py-2 text-white;
}
```

### Safelisting & Ignoring

Use `@source` for controlling content scanning.

```css
/* Safelist specific classes */
@source inline({hover: , }bg-red-{500, 600});

/* Ignore specific files/folders */
@source not '../legacy/**/*';
```

## 4. New Features (v4.0 & v4.1)

### 3D Transforms (v4.0)

Native utilities for 3D transforms.

```html
<div class="perspective-distant">
  <div class="scale-z-100 rotate-x-45 rotate-y-12 transform-3d"></div>
</div>
```

### Extended Gradients (v4.0)

- **Angles**: `bg-linear-45`, `bg-linear-to-r`.
- **Interpolation**: `bg-linear-to-r/oklch` (smoother gradients).
- **Conic & Radial**: `bg-conic-180`, `bg-radial`.

```html
<div class="bg-linear-45 from-indigo-500 via-purple-500 to-pink-500"></div>
<div class="bg-radial from-white to-black"></div>
```

### Text Shadows (v4.1)

Native text shadow utilities.

```html
<p class="text-shadow-sm">Subtle Shadow</p>
<p class="text-shadow-blue-500/50 text-shadow-lg">Colored Large Shadow</p>
```

### Masks (v4.1)

Composable mask utilities for gradients and images.

```html
<div class="mask-linear-to-b mask-from-black mask-to-transparent">
  <!-- Content fades out at the bottom -->
</div>
```

### Native Container Queries (v4.0)

No plugin needed.

```html
<div class="@container">
  <div class="grid grid-cols-1 @sm:grid-cols-3 @lg:grid-cols-4"></div>
</div>
```

### Starting Styles (v4.0)

Animate entry without JS using `@starting-style`.

```html
<div class="opacity-100 transition-opacity duration-300 starting:opacity-0">
  Fade In on Load
</div>
```

### New Variants

- `starting:`: Applied when element is first displayed.
- `not-*`: Negation, e.g., `not-hover:opacity-100`.
- `user-valid` / `user-invalid`: Form validation states that respect user interaction (v4.1).
- `noscript`: Styles applied when JS is disabled.
- `inverted-colors`: System inverted colors mode.
- `details-content`: Styling for accordion content.

## 5. Migration Guide (Breaking Changes)

### Renamed Utilities

| v3 Class       | v4 Class         | Reason                                              |
| :------------- | :--------------- | :-------------------------------------------------- |
| `shadow-sm`    | `shadow-xs`      | Scale consistency                                   |
| `shadow`       | `shadow-sm`      | Scale consistency                                   |
| `rounded-sm`   | `rounded-xs`     | Scale consistency                                   |
| `rounded`      | `rounded-sm`     | Scale consistency                                   |
| `blur-sm`      | `blur-xs`        | Scale consistency                                   |
| `blur`         | `blur-sm`        | Scale consistency                                   |
| `outline-none` | `outline-hidden` | `outline-none` now truly sets `outline-style: none` |
| `ring`         | `ring-3`         | Default ring width changed from 3px to 1px          |

### Syntax & Behavior Changes

1.  **Important Modifier**:
    - **v3**: `!bg-red-500` or `hover:!bg-red-500`
    - **v4**: `bg-red-500!` or `hover:bg-red-500!` (Always at the end)

2.  **Opacity Modifiers**:
    - **Removed**: `bg-opacity-*`, `text-opacity-*`
    - **Use**: Slash syntax `bg-black/50`, `text-white/20`

3.  **Arbitrary Values**:
    - **Variables**: Use parentheses `bg-(--brand-color)` instead of `bg-[--brand-color]`.
    - **Spaces**: Use underscores `grid-cols-[1fr_2fr]`.

4.  **Hover on Mobile**:
    - `hover:` strictly uses `@media (hover: hover)`.
    - It **will not** trigger on touch devices.

### Changed Defaults

- **Border Color**: Defaults to `currentColor` (was `gray-200`). Explicitly set `border-gray-200` if needed.
- **Ring**: Defaults to `1px` width and `currentColor`. Use `ring-3 ring-blue-500` to match v3.
- **Space/Divide**: `space-x/y` and `divide-x/y` implemented differently for performance. **Prefer Flex/Grid `gap`**.

## 6. Coding Best Practices

### Mobile-First Design

Always write styles for mobile first, then layer on breakpoints.

- **Correct**: `class="p-4 md:p-6 lg:p-8"`
- **Incorrect**: `class="sm:p-4"` (Don't use `sm:` for the default state).

### using `cn` (Classnames Utility)

Use `cn` for dynamic logic, avoid for static strings.

```tsx
// ✅ Good
<div className="flex p-4" />
<div className={cn("flex p-4", isActive && "bg-blue-500")} />
```

### Z-Index

**Never use arbitrary z-index values** (e.g., `z-[100]`). Use defined theme values.

### CSS Modules

Avoid if possible. requires `@reference "#tailwind";` at the top of the file.

## 7. Guidelines for AI Agents

When generating code:

1.  **Check Version**: Assume **Tailwind v4.1** syntax.
2.  **Verify Breaking Changes**: distinctively check for `shadow-sm`, `ring-3`, `outline-hidden`.
3.  **Use Modern Syntax**: `bg-linear-to-r`, `bg-black/50`, `py-2!`.
4.  **Use New Utilities**: Prefer `text-shadow-*` and `mask-*` over custom CSS.
5.  **Avoid Config Files**: Do not suggest `tailwind.config.js`. Use `@theme`.
6.  **Explicit Colors**: Add explicit color classes for borders/rings if not inheriting.
7.  **Hover Caution**: Be aware `hover:` does not apply on touch.

---

_Reference: [Tailwind CSS Upgrade Guide](https://tailwindcss.com/docs/upgrade-guide), [v4.0 Launch](https://tailwindcss.com/blog/tailwindcss-v4), [v4.1 Update](https://tailwindcss.com/blog/tailwindcss-v4-1)_
