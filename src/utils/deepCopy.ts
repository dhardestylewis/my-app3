/**
 * utils/deepCopy.ts
 * ---------------------------------------------------------------------------
 * A tiny helper that returns a **completely detached** clone of any JSON-like
 * value.  It prefers the native `structuredClone` API (Node ≥ 17, modern
 * browsers) and gracefully falls back to a JSON serialise/parse cycle when the
 * API is missing or the value cannot be cloned that way (e.g. non-serialisable
 * prototypes, functions, DOM nodes). As a last resort, it performs a shallow copy
 * to avoid crashing on revoked proxies.
 *
 * Why we need it
 * --------------
 * Zustand + Immer wrap every object that flows through a `set(state => {…})`
 * callback in a *draft* (a Proxy).  As soon as Immer finalises that callback
 * those proxies are **revoked**; touching them later crashes with the infamous
 * «Cannot perform 'get' on a proxy that has been revoked».  Cloning a value
 * *before* moving it across store boundaries (or before logging) guarantees
 * you only ever hand around plain, immutable JS data.
 *
 * Caveats of the fallback paths
 * ----------------------------
 * 1. Functions, Symbols, undefined, BigInt, RegExp, Map/Set, Date, class
 *    instances & circular references are either dropped or stringified.
 * 2. The last-resort shallow copy only copies top-level properties. Use only
 *    for simple objects when structuredClone & JSON fail.
 *
 * Usage
 * -----
 * ```ts
 * import { deepCopy } from "@/utils/deepCopy";
 * const safeCard = deepCopy(cardFromOtherStore);
 * ```
 */

/* eslint @typescript-eslint/explicit-module-boundary-types: 0 */
/* global structuredClone */

export function deepCopy<T>(value: T): T {
  // Fast path for primitives (string, number, boolean, bigint, symbol) & null
  if (value === null || typeof value !== "object") return value;

  // 1) Attempt native structuredClone
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Fall through to fallback
    }
  }

  // 2) JSON round-trip for JSON-serialisable objects
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    // Fall through to shallow copy
  }

  // 3) Last-resort shallow copy (top-level only)
  if (Array.isArray(value)) {
    return (value.map(item => deepCopy(item)) as unknown) as T;
  }
  if (value && typeof value === "object") {
    return ({ ...(value as Record<string, unknown>) } as T);
  }

  // Should not reach here for primitives
  return value;
}
