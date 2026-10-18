---
name: tanstack-store
description: Framework-agnostic, immutable reactive data store with framework adapters for React, Vue, Solid, Angular, and Svelte.
---


## Overview

TanStack Store is a lightweight reactive store (signals-like) that powers the internals of TanStack libraries. It provides `Store` for state, `Derived` for computed values, `Effect` for side effects, and `batch` for atomic updates. Framework adapters provide reactive hooks.

**Core:** `@tanstack/store`
**React:** `@tanstack/react-store`

## Installation

```bash
npm install @tanstack/store @tanstack/react-store
```

## Store

### Creating a Store

```typescript
import { Store } from '@tanstack/store'

const countStore = new Store(0)

const userStore = new Store<{ name: string; email: string }>({
  name: 'Alice',
  email: 'alice@example.com',
})
```

### Updating State

```typescript
// Function updater (immutable update)
countStore.setState((prev) => prev + 1)

userStore.setState((prev) => ({ ...prev, name: 'Bob' }))
```

### Subscribing to Changes

```typescript
const unsub = countStore.subscribe(() => {
  console.log('Count:', countStore.state)
})

// Cleanup
unsub()
```

### Store Options

```typescript
const store = new Store(initialState, {
  // Custom update function
  updateFn: (prevValue) => (updater) => {
    return updater(prevValue) // custom logic
  },
  // Callback on subscribe
  onSubscribe: (listener, store) => {
    console.log('New subscriber')
    return () => console.log('Unsubscribed')
  },
  // Callback on every update
  onUpdate: () => {
    console.log('State updated:', store.state)
  },
})
```

### Store Properties

```typescript
store.state      // Current state
store.prevState  // Previous state
store.listeners  // Set of listener callbacks
```

## Derived (Computed Values)

```typescript
import { Store, Derived } from '@tanstack/store'

const count = new Store(5)
const multiplier = new Store(2)

const doubled = new Derived({
  deps: [count, multiplier],
  fn: ({ currDepVals }) => currDepVals[0] * currDepVals[1],
})

// MUST mount to activate
const unmount = doubled.mount()

console.log(doubled.state) // 10

count.setState(() => 10)
console.log(doubled.state) // 20

// Cleanup
unmount()
```

### Derived with Previous Value

```typescript
const accumulated = new Derived({
  deps: [count],
  fn: ({ prevVal, currDepVals }) => {
    return currDepVals[0] + (prevVal ?? 0)
  },
})
```

### Chaining Derived

```typescript
const filtered = new Derived({
  deps: [dataStore, filterStore],
  fn: ({ currDepVals }) => currDepVals[0].filter(matchesFilter(currDepVals[1])),
})

const sorted = new Derived({
  deps: [filtered, sortStore],
  fn: ({ currDepVals }) => [...currDepVals[0]].sort(comparator(currDepVals[1])),
})

const paginated = new Derived({
  deps: [sorted, pageStore],
  fn: ({ currDepVals }) => currDepVals[0].slice(
    currDepVals[1].offset,
    currDepVals[1].offset + currDepVals[1].limit,
  ),
})
```

## Effect (Side Effects)

```typescript
import { Store, Effect } from '@tanstack/store'

const count = new Store(0)

const logger = new Effect({
  deps: [count],
  fn: () => {
    console.log('Count changed:', count.state)
    // Optionally return cleanup function
    return () => console.log('Cleaning up')
  },
  eager: false, // true = run immediately on mount
})

const unmount = logger.mount()

count.setState(() => 1) // logs: "Count changed: 1"

unmount()
```

### Effect with Cleanup

```typescript
const timerEffect = new Effect({
  deps: [intervalStore],
  fn: () => {
    const id = setInterval(() => { /* ... */ }, intervalStore.state)
    return () => clearInterval(id) // cleanup on next run or unmount
  },
})
```

## Batch

Group multiple updates into one notification:

```typescript
import { batch } from '@tanstack/store'

// Subscribers fire only once with final state
batch(() => {
  countStore.setState(() => 1)
  nameStore.setState(() => 'Alice')
  settingsStore.setState((prev) => ({ ...prev, theme: 'dark' }))
})
```

## React Integration

### useStore Hook

```tsx
import { useStore } from '@tanstack/react-store'

// Subscribe to full state
function Counter() {
  const count = useStore(countStore)
  return <button onClick={() => countStore.setState((c) => c + 1)}>{count}</button>
}

// Subscribe with selector (performance optimization)
function UserName() {
  const name = useStore(userStore, (state) => state.name)
  return <span>{name}</span>
}

// Subscribe to Derived
function DoubledDisplay() {
  const value = useStore(doubledDerived)
  return <span>{value}</span>
}
```

### shallow Equality Function

Prevents re-renders when selector returns structurally-equal objects:

```tsx
import { useStore } from '@tanstack/react-store'
import { shallow } from '@tanstack/react-store'

function TodoList() {
  // Without shallow: re-renders on ANY state change (new object ref)
  // With shallow: only re-renders when items actually change
  const items = useStore(todosStore, (state) => state.items, shallow)
  return <ul>{items.map(/* ... */)}</ul>
}
```

### Mounting Derived/Effect in React

```tsx
function MyComponent() {
  useEffect(() => {
    const unmountDerived = myDerived.mount()
    const unmountEffect = myEffect.mount()
    return () => {
      unmountDerived()
      unmountEffect()
    }
  }, [])

  const value = useStore(myDerived)
  return <span>{value}</span>
}
```

## Module-Level Store Pattern

```typescript
// stores/counter.ts
import { Store, Derived } from '@tanstack/store'

export const counterStore = new Store(0)

export const doubledCount = new Derived({
  deps: [counterStore],
  fn: ({ currDepVals }) => currDepVals[0] * 2,
})

// Actions as plain functions
export function increment() {
  counterStore.setState((c) => c + 1)
}

export function reset() {
  counterStore.setState(() => 0)
}
```

## Framework Adapters

| Framework | Package | Hook/Composable |
|-----------|---------|-----------------|
| React | `@tanstack/react-store` | `useStore(store, selector?, equalityFn?)` |
| Vue | `@tanstack/vue-store` | `useStore(store, selector?)` (returns computed ref) |
| Solid | `@tanstack/solid-store` | `useStore(store, selector?)` (returns signal) |
| Angular | `@tanstack/angular-store` | `injectStore(store, selector?)` (returns signal) |
| Svelte | `@tanstack/svelte-store` | `useStore(store, selector?)` (returns $state) |

## Best Practices

1. **Define stores at module level** - they're singletons
2. **Use selectors** in `useStore` to prevent unnecessary re-renders
3. **Use `shallow`** when selectors return objects/arrays
4. **Always call `mount()`** on Derived and Effect instances
5. **Always clean up** unmount functions (especially in React useEffect)
6. **Never mutate state directly** - always use `setState`
7. **Use `batch`** for multiple related updates
8. **Use Derived chains** for data transformations (filter -> sort -> paginate)
9. **Return cleanup functions** from Effect `fn` for timers/listeners
10. **Select primitives** when possible (no equality fn needed)

## Common Pitfalls

- Forgetting to `mount()` Derived/Effect (they won't activate)
- Not cleaning up subscriptions/unmount functions (memory leaks)
- Mutating `store.state` directly instead of using `setState`
- Creating new object references in selectors without `shallow`
- Using `useStore` without a selector (subscribes to everything)
- Forgetting `eager: true` when Effect should run immediately
