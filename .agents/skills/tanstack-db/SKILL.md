---
name: tanstack-db
description: Reactive client-first store for your API with collections, live queries, and optimistic mutations.
---


## Overview

TanStack DB is a client-side embedded database layer built on differential dataflow. It maintains normalized collections, uses incremental computation for live queries, provides automatic optimistic mutations, and integrates with TanStack Query for data fetching. Sub-millisecond updates even with 100k+ rows.

**Package:** `@tanstack/react-db`
**Query Integration:** `@tanstack/query-db-collection`
**Status:** Beta (v0.5)

## Installation

```bash
npm install @tanstack/react-db @tanstack/query-db-collection
```

## Core Concepts

- **Collections**: Normalized data stores wrapping data sources (TanStack Query, Electric, etc.)
- **Live Queries**: Reactive subscriptions with SQL-like query builder
- **Optimistic Mutations**: Automatic instant UI updates with rollback on failure
- **Differential Dataflow**: Only recomputes affected query results on changes

## Collections

### Creating a Collection

```typescript
import { createCollection } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'

const todoCollection = createCollection(
  queryCollectionOptions({
    queryKey: ['todos'],
    queryFn: async () => api.todos.getAll(),
    getKey: (item) => item.id,
    schema: todoSchema,
    onInsert: async ({ transaction }) => {
      await Promise.all(
        transaction.mutations.map((mutation) =>
          api.todos.create(mutation.modified)
        )
      )
    },
    onUpdate: async ({ transaction }) => {
      await Promise.all(
        transaction.mutations.map((mutation) =>
          api.todos.update(mutation.modified)
        )
      )
    },
    onDelete: async ({ transaction }) => {
      await Promise.all(
        transaction.mutations.map((mutation) =>
          api.todos.delete(mutation.original.id)
        )
      )
    },
  })
)
```

### Sync Modes

```typescript
// Eager (default): Load entire collection upfront. Best for <10k rows.
const smallCollection = createCollection(
  queryCollectionOptions({ syncMode: 'eager', /* ... */ })
)

// On-Demand: Load only what queries request. Best for >50k rows, search.
const largeCollection = createCollection(
  queryCollectionOptions({
    syncMode: 'on-demand',
    queryFn: async (ctx) => {
      const params = parseLoadSubsetOptions(ctx.meta?.loadSubsetOptions)
      return api.getProducts(params)
    },
  })
)

// Progressive: Load query subset immediately, full sync in background.
const collaborativeCollection = createCollection(
  queryCollectionOptions({ syncMode: 'progressive', /* ... */ })
)
```

## Live Queries

### Basic Query

```typescript
import { useLiveQuery } from '@tanstack/react-db'
import { eq } from '@tanstack/db'

function TodoList() {
  const { data: todos } = useLiveQuery((query) =>
    query
      .from({ todos: todoCollection })
      .where(({ todos }) => eq(todos.completed, false))
  )

  return <ul>{todos.map(todo => <li key={todo.id}>{todo.text}</li>)}</ul>
}
```

### Query Builder API

```typescript
const { data } = useLiveQuery((q) =>
  q
    .from({ t: todoCollection })
    .where(({ t }) => eq(t.status, 'active'))
    .orderBy(({ t }) => t.createdAt, 'desc')
    .limit(10)
)
```

### Joins

```typescript
const { data } = useLiveQuery((q) =>
  q
    .from({ t: todoCollection })
    .innerJoin(
      { u: userCollection },
      ({ t, u }) => eq(t.userId, u.id)
    )
    .innerJoin(
      { p: projectCollection },
      ({ u, p }) => eq(u.projectId, p.id)
    )
    .where(({ p }) => eq(p.id, currentProject.id))
)
```

### Filter Operators

```typescript
import { eq, lt, and } from '@tanstack/db'

// Equality
eq(field, value)

// Less than
lt(field, value)

// AND
and(eq(product.category, 'electronics'), lt(product.price, 100))
```

### With Ordering and Limits

```typescript
const { data } = useLiveQuery((q) =>
  q
    .from({ product: productsCollection })
    .where(({ product }) =>
      and(eq(product.category, 'electronics'), lt(product.price, 100))
    )
    .orderBy(({ product }) => product.price, 'asc')
    .limit(10)
)
```

## Optimistic Mutations

### Insert

```typescript
todoCollection.insert({
  id: uuid(),
  text: 'New todo',
  completed: false,
})
// Immediately: updates all live queries referencing this collection
// Background: calls onInsert handler to sync with server
// On failure: automatic rollback
```

### No Manual Boilerplate

| Before (TanStack Query only) | After (TanStack DB) |
|-------------------------------|---------------------|
| Manual `onMutate` for optimistic state | Automatic |
| Manual `onError` rollback logic | Automatic |
| Per-mutation cache invalidation | All live queries update automatically |

## Query-Driven Sync (On-Demand)

Live queries automatically generate optimized network requests:

```typescript
// This live query...
useLiveQuery((q) =>
  q.from({ product: productsCollection })
    .where(({ product }) => and(eq(product.category, 'electronics'), lt(product.price, 100)))
    .orderBy(({ product }) => product.price, 'asc')
    .limit(10)
)

// ...automatically generates:
// GET /api/products?category=electronics&price_lt=100&sort=price:asc&limit=10
```

### Predicate Mapping

```typescript
queryFn: async (ctx) => {
  const { filters, sorts, limit } = parseLoadSubsetOptions(ctx.meta?.loadSubsetOptions)

  const params = new URLSearchParams()
  filters.forEach(({ field, operator, value }) => {
    if (operator === 'eq') params.set(field.join('.'), String(value))
    else if (operator === 'lt') params.set(`${field.join('.')}_lt`, String(value))
  })
  if (limit) params.set('limit', String(limit))

  return fetch(`/api/products?${params}`).then(r => r.json())
}
```

## Performance

| Operation | Latency |
|-----------|---------|
| Single row update (100k sorted collection) | ~0.7 ms |
| Subsequent queries (after sync) | <1 ms |
| Join across collections | Sub-millisecond |

## Supported Collection Types

- **Query Collection** - TanStack Query integration
- **Electric Collection** - Electric SQL real-time sync
- **TrailBase Collection** - TrailBase backend
- **RxDB Collection** - RxDB integration
- **PowerSync Collection** - PowerSync sync
- **LocalStorage Collection** - Browser persistence
- **LocalOnly Collection** - In-memory only

## API Summary

```typescript
import { createCollection, useLiveQuery } from '@tanstack/react-db'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { eq, lt, and, parseLoadSubsetOptions } from '@tanstack/db'
```

## Best Practices

1. **Define collections at module level** - they're singletons
2. **Choose the right sync mode**: `eager` (<10k), `on-demand` (>50k), `progressive` (collaborative)
3. **Use joins instead of view-specific APIs** - load normalized collections once
4. **Let TanStack Query handle fetching** - DB augments Query, doesn't replace it
5. **Use `parseLoadSubsetOptions`** to map live query predicates to API params
6. **Rely on automatic optimistic updates** - don't manually manage optimistic state
7. **Use schemas** for runtime validation and TypeScript inference
8. **Leverage incremental computation** - let the engine handle filtering vs manual `.filter()`

## Common Pitfalls

- Creating collections inside components (should be module-level)
- Trying to replace TanStack Query entirely (DB builds on top of it)
- Using manual `.filter()` in render instead of live query `where` clauses
- Not providing `getKey` for proper normalization
- Forgetting mutation handlers (`onInsert`, `onUpdate`, `onDelete`) for server sync
