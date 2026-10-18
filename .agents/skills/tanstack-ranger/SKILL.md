---
name: tanstack-ranger
description: Headless utilities for building range and multi-range sliders in TS/JS, React, Vue, Solid, Svelte & Angular.
---


## Overview

TanStack Ranger provides headless utilities for building fully accessible range and multi-range slider components. It handles all the complex logic for single value, range, and multi-thumb sliders while giving you complete control over styling and markup.

**Package:** `@tanstack/react-ranger`
**Core:** `@tanstack/ranger-core` (framework-agnostic)
**Status:** Stable

## Installation

```bash
npm install @tanstack/react-ranger
```

## Core Pattern

```tsx
import { useRanger } from '@tanstack/react-ranger'

function RangeSlider() {
  const [values, setValues] = useState([25, 75])

  const rangerInstance = useRanger({
    getRangerElement: () => rangerRef.current,
    values,
    min: 0,
    max: 100,
    stepSize: 1,
    onChange: (instance) => setValues(instance.sortedValues),
  })

  const rangerRef = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={rangerRef}
      style={{
        position: 'relative',
        height: '8px',
        background: '#ddd',
        borderRadius: '4px',
        width: '100%',
      }}
    >
      {/* Track segments */}
      {rangerInstance.getSteps().map(({ left, width }, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: `${left}%`,
            width: `${width}%`,
            height: '100%',
            background: i === 1 ? '#3b82f6' : '#ddd',
            borderRadius: '4px',
          }}
        />
      ))}

      {/* Thumbs */}
      {rangerInstance.handles.map((handle, i) => (
        <button
          key={i}
          {...handle.getHandleProps()}
          style={{
            position: 'absolute',
            left: `${handle.getPercentage()}%`,
            transform: 'translateX(-50%)',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: '#3b82f6',
            border: '2px solid white',
            cursor: 'grab',
          }}
        />
      ))}
    </div>
  )
}
```

## Ranger Options

### Required

| Option | Type | Description |
|--------|------|-------------|
| `getRangerElement` | `() => Element \| null` | Returns the slider track element |
| `values` | `number[]` | Current thumb values |
| `min` | `number` | Minimum value |
| `max` | `number` | Maximum value |
| `onChange` | `(instance) => void` | Called when values change |

### Optional

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `stepSize` | `number` | `1` | Step increment between values |
| `steps` | `number[]` | - | Custom step positions (overrides stepSize) |
| `tickSize` | `number` | - | Size of tick marks |
| `ticks` | `number[]` | - | Custom tick positions |
| `interpolator` | `Interpolator` | linear | Value interpolation function |
| `onDrag` | `(instance) => void` | - | Called during drag operations |

## Ranger Instance API

```typescript
// Get sorted values (always ascending order)
rangerInstance.sortedValues: number[]

// Get handles for rendering thumbs
rangerInstance.handles: Handle[]

// Get track segments between handles
rangerInstance.getSteps(): { left: number; width: number }[]

// Get tick marks
rangerInstance.getTicks(): { value: number; percentage: number }[]

// Programmatically set values
rangerInstance.setValues(newValues: number[])
```

## Handle API

```typescript
interface Handle {
  // Get percentage position on track (0-100)
  getPercentage(): number

  // Get the current value
  getValue(): number

  // Get props to spread on handle element
  getHandleProps(): {
    role: 'slider'
    tabIndex: number
    'aria-valuemin': number
    'aria-valuemax': number
    'aria-valuenow': number
    onKeyDown: (e: KeyboardEvent) => void
    onMouseDown: (e: MouseEvent) => void
    onTouchStart: (e: TouchEvent) => void
  }
}
```

## Single Value Slider

```tsx
function SingleSlider() {
  const [values, setValues] = useState([50])

  const rangerInstance = useRanger({
    getRangerElement: () => rangerRef.current,
    values,
    min: 0,
    max: 100,
    stepSize: 1,
    onChange: (instance) => setValues(instance.sortedValues),
  })

  const rangerRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={rangerRef} className="slider-track">
      {rangerInstance.handles.map((handle, i) => (
        <button key={i} {...handle.getHandleProps()} className="slider-thumb">
          {handle.getValue()}
        </button>
      ))}
    </div>
  )
}
```

## Multi-Range Slider

```tsx
function MultiRangeSlider() {
  const [values, setValues] = useState([10, 40, 60, 90])

  const rangerInstance = useRanger({
    getRangerElement: () => rangerRef.current,
    values,
    min: 0,
    max: 100,
    stepSize: 5,
    onChange: (instance) => setValues(instance.sortedValues),
  })

  const rangerRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={rangerRef} className="slider-track">
      {rangerInstance.getSteps().map(({ left, width }, i) => (
        <div
          key={i}
          className={`segment ${i % 2 === 1 ? 'active' : ''}`}
          style={{ left: `${left}%`, width: `${width}%` }}
        />
      ))}
      {rangerInstance.handles.map((handle, i) => (
        <button key={i} {...handle.getHandleProps()} className="slider-thumb" />
      ))}
    </div>
  )
}
```

## Custom Steps

```tsx
const rangerInstance = useRanger({
  getRangerElement: () => rangerRef.current,
  values,
  min: 0,
  max: 100,
  steps: [0, 10, 25, 50, 75, 100], // Only these values allowed
  onChange: (instance) => setValues(instance.sortedValues),
})
```

## Tick Marks

```tsx
function SliderWithTicks() {
  const rangerInstance = useRanger({
    getRangerElement: () => rangerRef.current,
    values,
    min: 0,
    max: 100,
    stepSize: 10,
    ticks: [0, 25, 50, 75, 100],
    onChange: (instance) => setValues(instance.sortedValues),
  })

  return (
    <div>
      <div ref={rangerRef} className="slider-track">
        {/* Handles */}
      </div>
      <div className="tick-container">
        {rangerInstance.getTicks().map((tick, i) => (
          <div
            key={i}
            style={{ left: `${tick.percentage}%` }}
            className="tick"
          >
            <span className="tick-label">{tick.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

## Logarithmic Scale

```tsx
import { logarithmicInterpolator } from '@tanstack/react-ranger'

const rangerInstance = useRanger({
  getRangerElement: () => rangerRef.current,
  values,
  min: 1,
  max: 1000,
  interpolator: logarithmicInterpolator,
  onChange: (instance) => setValues(instance.sortedValues),
})
```

## Accessibility

TanStack Ranger provides built-in accessibility:

- `role="slider"` on handles
- `aria-valuemin`, `aria-valuemax`, `aria-valuenow` attributes
- Keyboard navigation (Arrow keys, Home, End, Page Up/Down)
- Focus management

```tsx
// Add aria-label for screen readers
<button
  {...handle.getHandleProps()}
  aria-label={`Value: ${handle.getValue()}`}
/>
```

## Controlled vs Uncontrolled

```tsx
// Controlled (recommended)
const [values, setValues] = useState([50])
const ranger = useRanger({
  values,
  onChange: (instance) => setValues(instance.sortedValues),
  // ...
})

// With validation
const handleChange = (instance) => {
  const [min, max] = instance.sortedValues
  // Ensure minimum gap of 10
  if (max - min >= 10) {
    setValues(instance.sortedValues)
  }
}
```

## Styling Tips

```css
/* Track */
.slider-track {
  position: relative;
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  width: 100%;
}

/* Active segment */
.segment.active {
  background: #3b82f6;
}

/* Thumb */
.slider-thumb {
  position: absolute;
  transform: translateX(-50%);
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #3b82f6;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  cursor: grab;
}

.slider-thumb:active {
  cursor: grabbing;
}

.slider-thumb:focus {
  outline: none;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3);
}
```

## Framework Adapters

| Framework | Package | Status |
|-----------|---------|--------|
| React | `@tanstack/react-ranger` | Stable |
| Vue | `@tanstack/vue-ranger` | Stable |
| Solid | `@tanstack/solid-ranger` | Stable |
| Svelte | `@tanstack/svelte-ranger` | Stable |
| Angular | `@tanstack/angular-ranger` | Stable |
| Core | `@tanstack/ranger-core` | Stable |

## Best Practices

1. **Always use `sortedValues`** from onChange - handles may cross during drag
2. **Memoize `getRangerElement`** callback to prevent unnecessary re-renders
3. **Use semantic HTML** - render handles as `<button>` elements for accessibility
4. **Add `aria-label`** to describe each handle's purpose
5. **Use CSS transforms** (`translateX`) for positioning instead of `left` for better performance
6. **Validate in onChange** to enforce constraints (min gap, max range, etc.)
7. **Use `onDrag`** for real-time feedback during drag operations
8. **Consider touch targets** - make handles at least 44x44px on mobile

## Common Pitfalls

- Forgetting `position: relative` on the track container
- Using `values` instead of `sortedValues` (handles can swap positions)
- Not providing `getRangerElement` as a callback
- Setting thumb position with `left` instead of `transform: translateX()`
- Forgetting to handle keyboard navigation (built-in via getHandleProps)
- Not accounting for thumb width when calculating positions
