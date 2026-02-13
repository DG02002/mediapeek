# MediaPeek Monorepo Developer Guide

Welcome to the MediaPeek monorepo! This project is organized as a monorepo using [pnpm workspaces](https://pnpm.io/workspaces) and [Turbo](https://turbo.build/).

## 📂 Project Structure

- **`apps/frontend`**: The Remix/React Router application (User Interface).
- **`apps/analyzer`**: The Hono Cloudflare Worker (Media processing logic).
- **`packages/shared`**: Shared TypeScript types, schemas, and utilities used by both apps.
- **`packages/config-*`**: Shared configuration for ESLint, TypeScript, and Tailwind.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v22+ recommended)
- [pnpm](https://pnpm.io/) (v9+)

### Installation

Install all dependencies across the entire monorepo:

```bash
pnpm install
```

### 💻 Development

Start the development servers for both the frontend and analyzer simultaneously:

```bash
pnpm dev
# OR
turbo dev
```

- **Frontend**: http://localhost:5173
- **Analyzer**: http://localhost:8787 (accessed via Service Binding, not directly)

### 🛠️ Building & Testing

To run tasks for **all** packages efficiently (cached by Turbo):

```bash
# Build everything
pnpm build

# Typecheck everything
pnpm typecheck

# Lint everything
pnpm lint
```

### 🧹 Maintenance

If you hit weird caching issues or want a fresh start:

```bash
# Clean all artifacts (dist, node_modules, cache)
pnpm clean

# Reinstall and build
pnpm install && pnpm build
```

## 📦 Dependency Management

To add a dependency:

```bash
# Add to specific app
pnpm add zod --filter mediapeek-analyzer

# Add to shared package
pnpm add zod --filter @mediapeek/shared
```

## 🔒 Security Notes

- The **Analyzer** is a private worker. It does not have a public URL in production.
- Communication happens via **Service Bindings** (verified by Cloudflare runtime).
- Do NOT commit `.env` or `wrangler.toml` with real secrets (use `.dev.vars` locally).
