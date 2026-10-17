/**
 * Type guard utilities for safely accessing dynamic data structures.
 * Used primarily for MediaInfo's dynamic `extra` fields and structure rendering.
 *
 * @module type-guards
 */

/**
 * Check if a value is a non-null object (not an array)
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Check if a value is an array
 */
export function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Check if a value is a string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Check if a value is a number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

/**
 * Check if a value is a boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Check if a value is a primitive (string, number, boolean)
 */
export function isPrimitive(
  value: unknown,
): value is string | number | boolean {
  return isString(value) || isNumber(value) || isBoolean(value);
}

/**
 * Safely get a string property from an object
 */
export function getString(obj: unknown, key: string): string | undefined {
  if (isRecord(obj) && isString(obj[key])) {
    return obj[key];
  }
  return undefined;
}

/**
 * Safely get a number property from an object
 */
export function getNumber(obj: unknown, key: string): number | undefined {
  if (isRecord(obj) && isNumber(obj[key])) {
    return obj[key];
  }
  return undefined;
}

/**
 * Safely get any property with a type guard
 */
export function getProperty<T>(
  obj: unknown,
  key: string,
  guard: (v: unknown) => v is T,
): T | undefined {
  if (isRecord(obj) && guard(obj[key])) {
    return obj[key];
  }
  return undefined;
}

/**
 * Safely get a nested property path from an object
 * Example: getNestedProperty(obj, ['foo', 'bar', 'baz'])
 */
export function getNestedProperty(obj: unknown, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[key];
  }
  return current;
}

/**
 * Safe stringification of unknown values
 * Handles objects, arrays, and primitives gracefully
 */
export function safeString(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (isString(value)) {
    return value;
  }
  if (isNumber(value) || isBoolean(value)) {
    return String(value);
  }
  if (isArray(value)) {
    return value.map(safeString).join(', ');
  }
  if (isRecord(value)) {
    // Don't stringify objects - return empty or a placeholder
    return '[Object]';
  }
  // Safe fallback for unknown types
  return Object.prototype.toString.call(value);
}

/**
 * Check if a value is truthy and not an empty string/array/object
 */
export function hasValue(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (isString(value)) {
    return value.trim().length > 0;
  }
  if (isArray(value)) {
    return value.length > 0;
  }
  if (isRecord(value)) {
    return Object.keys(value).length > 0;
  }
  return true;
}

/**
 * Type-safe Object.entries for unknown objects
 */
export function safeEntries(obj: unknown): [string, unknown][] {
  if (!isRecord(obj)) {
    return [];
  }
  return Object.entries(obj);
}

/**
 * Filter entries into primitives and complex objects
 */
export function partitionEntries(obj: unknown): {
  primitives: [string, string | number | boolean][];
  complex: [string, unknown][];
} {
  const entries = safeEntries(obj);
  const primitives: [string, string | number | boolean][] = [];
  const complex: [string, unknown][] = [];

  for (const [key, value] of entries) {
    if (isPrimitive(value)) {
      primitives.push([key, value]);
    } else if (value !== null && value !== undefined) {
      complex.push([key, value]);
    }
  }

  return { primitives, complex };
}
