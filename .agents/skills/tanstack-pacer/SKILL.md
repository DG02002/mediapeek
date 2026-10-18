---
name: tanstack-pacer
description: Framework-agnostic debouncing, throttling, rate limiting, queuing, and batching utilities.
---


## Overview

TanStack Pacer provides a unified, type-safe toolkit for controlling function execution timing. It offers class-based APIs, factory functions, and React hooks for debouncing, throttling, rate limiting, queuing, and batching.

**Core:** `@tanstack/pacer`
**React:** `@tanstack/react-pacer`
**Status:** Beta

## Installation

```bash
npm install @tanstack/pacer
npm install @tanstack/react-pacer  # React hooks
```

## Debouncing

Delays execution until after a period of inactivity.

### Class API

```typescript
import { Debouncer } from '@tanstack/pacer'

const debouncer = new Debouncer(
  (query: string) => fetchSearchResults(query),
  {
    wait: 300,            // ms of inactivity before execution
    leading: false,       // Execute on leading edge (default: false)
    trailing: true,       // Execute on trailing edge (default: true)
    maxWait: 1000,        // Force execution after 1s of continuous calls
    enabled: true,
    onExecute: (result) => console.log(result),
  }
)

debouncer.maybeExecute('search term')
debouncer.cancel()
debouncer.getExecutionCount()
debouncer.setOptions({ wait: 500 }) // Dynamic reconfiguration
```

### Factory Function

```typescript
import { debounce } from '@tanstack/pacer'

const debouncedSearch = debounce(
  (query: string) => fetchResults(query),
  { wait: 300 }
)

debouncedSearch('term')
debouncedSearch.cancel()
```

### React Hooks

```typescript
import {
  useDebouncer,
  useDebouncedCallback,
  useDebouncedState,
  useDebouncedValue,
} from '@tanstack/react-pacer'

// Full debouncer instance
const debouncer = useDebouncer(fn, { wait: 300 })

// Simple debounced function
const debouncedFn = useDebouncedCallback(fn, { wait: 300 })

// Debounced state management
const [debouncedValue, setValue] = useDebouncedState(initialValue, { wait: 300 })

// Debounced reactive value
const debouncedValue = useDebouncedValue(reactiveValue, { wait: 300 })
```

## Throttling

Limits execution to at most once per interval.

### Class API

```typescript
import { Throttler } from '@tanstack/pacer'

const throttler = new Throttler(
  (position: { x: number; y: number }) => updatePosition(position),
  {
    wait: 100,            // Minimum interval between executions
    leading: true,        // Execute immediately on first call (default: true)
    trailing: true,       // Execute after interval with last args (default: true)
    enabled: true,
    onExecute: (result) => console.log(result),
  }
)

throttler.maybeExecute({ x: 100, y: 200 })
throttler.cancel()
```

### React Hooks

```typescript
import {
  useThrottler,
  useThrottledCallback,
  useThrottledState,
  useThrottledValue,
} from '@tanstack/react-pacer'

const throttledFn = useThrottledCallback(handleScroll, { wait: 100 })
const [throttledPos, setPos] = useThrottledState({ x: 0, y: 0 }, { wait: 100 })
```

## Rate Limiting

Controls execution with a maximum count within a time window.

### Class API

```typescript
import { RateLimiter } from '@tanstack/pacer'

const limiter = new RateLimiter(
  async (endpoint: string) => fetch(endpoint).then(r => r.json()),
  {
    limit: 10,            // Max executions per window
    window: 60000,        // Time window in ms (60s)
    enabled: true,
    onExecute: (result) => console.log(result),
    onReject: (...args) => console.warn('Rate limited:', args),
  }
)

limiter.maybeExecute('/api/data')  // Rejected if limit exceeded
limiter.getExecutionCount()
limiter.getRejectionCount()
```

### React Hooks

```typescript
import {
  useRateLimiter,
  useRateLimitedCallback,
  useRateLimitedState,
  useRateLimitedValue,
} from '@tanstack/react-pacer'

const rateLimitedFn = useRateLimitedCallback(apiCall, { limit: 5, window: 1000 })
```

## Queuing

Sequential execution with configurable concurrency.

```typescript
import { Queue } from '@tanstack/pacer'

const queue = new Queue({
  concurrency: 1,         // Max concurrent tasks
  started: true,          // Start processing immediately
})

queue.add(() => uploadFile(file1))
queue.add(() => uploadFile(file2))

queue.start()
queue.pause()
queue.clear()
queue.getSize()           // Pending count
queue.getPending()        // Currently executing count
```

## Batching

Groups calls for combined processing.

```typescript
import { Batcher } from '@tanstack/pacer'

const batcher = new Batcher(
  (items: LogEntry[]) => sendBatchToServer(items),
  {
    maxSize: 50,          // Auto-flush at 50 items
    wait: 1000,           // Auto-flush after 1s
  }
)

batcher.add(logEntry)    // Accumulates
batcher.flush()          // Manual flush
batcher.getSize()        // Current batch size
batcher.clear()          // Discard batch
```

## Async Variants

```typescript
import { AsyncDebouncer, asyncDebounce, AsyncThrottler, asyncThrottle } from '@tanstack/pacer'

const asyncDebouncer = new AsyncDebouncer(
  async (query: string) => {
    const response = await fetch(`/api/search?q=${query}`)
    return response.json()
  },
  { wait: 300 }
)

// React async hooks
import { useAsyncDebouncer, useAsyncThrottler } from '@tanstack/react-pacer'
```

## Choosing the Right Utility

| Scenario | Utility | Why |
|----------|---------|-----|
| Search input | Debouncer | Wait for user to stop typing |
| Scroll events | Throttler | Periodic updates during activity |
| API protection | RateLimiter | Hard limit on call frequency |
| File uploads | Queue | Sequential processing |
| Analytics events | Batcher | Group for efficiency |
| Network requests | AsyncDebouncer | Handle abort/retry |

## Leading vs Trailing Edge

- **Leading** (`leading: true`): Execute immediately, suppress until wait expires. Good for button clicks.
- **Trailing** (`trailing: true`): Execute after activity stops. Good for search inputs.
- **Both**: Execute immediately AND after final wait. Good for scroll throttling.

## Best Practices

1. **Use `maxWait` with debouncing** to guarantee execution during continuous activity
2. **Use async variants** for network requests (handle abort/cancellation)
3. **React hooks handle cleanup automatically** - no manual teardown needed
4. **Use `setOptions`** for dynamic reconfiguration (e.g., reducing wait for power users)
5. **Compose utilities** for complex scenarios (rate-limited queue)
6. **Use `onReject`** on RateLimiter to inform users when they're rate limited

## Common Pitfalls

- Using debounce when you need throttle (debounce waits for inactivity, throttle guarantees periodic execution)
- Not using `maxWait` with debounce for long-running continuous events
- Creating new instances on every render (use hooks or module-level)
- Forgetting cleanup in non-React environments (call `cancel()`)
