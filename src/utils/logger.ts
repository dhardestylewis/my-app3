// src/utils/logger.ts
// Dedicated wrapper: single‑signature helpers + console mirroring.

import { useLoggerStore } from '../stores/loggerStore';
import type { LogEntry }  from '../data/types'; // Assuming LogEntry is also exported or re-exported by loggerStore if needed here
import { LogLevel }       from '../data/types';
// ─────────────────────────────────────────────────────────
// 1) NEW import (put it with the other utils imports)
import { deepCopy } from "./deepCopy";   // ← adjust path if logger.ts lives elsewhere
// ─────────────────────────────────────────────────────────

/* ---------- meta helper ---------- */
export type Meta =
  | Record<string, unknown>
  | Error
  | string
  | unknown           // ← lets you pass raw `unknown` without complaint
  | undefined;

/* ---------- internal funnel ---------- */
function _recordLog(
  level: LogLevel,
  msg: string,
  metaOrCat?: Meta,
  cat?: string,
): void {
  /* smart param shuffle ------------------------------------------------ */
  let meta: Record<string, unknown> | Error | undefined;
  if (typeof metaOrCat === "string" && cat === undefined) {
    cat  = metaOrCat;
    meta = undefined;
  } else {
    meta = metaOrCat as Record<string, unknown> | Error | undefined;
  }

  /* ──────── 🆕 one‑liner guard right here ──────── */
  if (meta && typeof meta === "object" && !(meta instanceof Error)) {
    meta = deepCopy(meta);      // ← strips any leftover Immer proxies
  }
  /* ─────────────────────────────────────────────── */

  let store;
  try {
    store = useLoggerStore.getState();
  } catch (err) {
    // Handle case where store access fails (likely proxy revocation)
    const errPrefix = `[${cat ?? LogLevel[level] ?? 'Log'}]`; // Ensure cat and LogLevel[level] are defined
    const errMsg = msg; // msg is already a string
    console.error('[Logger] Failed to access store:', err);
    // Fall back to direct console logging
    console.log(errPrefix, errMsg, meta instanceof Error ? meta : (meta || ''));
    return;
  }

  /* prepare store‑friendly entry -------------------------------------- */
  let errorPayload: Error | undefined;
  let dataPayload : Record<string, unknown> | undefined;
  let msgForStore = msg; // msg is already a string

  if (meta instanceof Error) {
    errorPayload = meta;
    // Ensure meta.message is defined and msgForStore doesn't already include it
    if (meta.message && !msgForStore.includes(meta.message)) {
        msgForStore += `: ${meta.message}`;
    }
  } else if (typeof meta === 'object' && meta !== null) {
    dataPayload = meta;
  }

  try {
    store.log(msgForStore, level, cat);
  } catch (err) {
    const errPrefix = `[${cat ?? LogLevel[level] ?? 'Log'}]`;
    console.error('[Logger] store.log failed:', err);
    console.error('[Logger Fallback]', errPrefix, msgForStore, meta); // Use errPrefix here too
  }

  /* dev‑console mirror ------------------------------------------------- */
  // Mirror if it's an ERROR or if debug mode is enabled in the store
  if (!(level === LogLevel.ERROR || store.debug)) return;

  // Before printing, capture to locals
  const prefix = `[${cat ?? LogLevel[level] ?? 'Log'}]`; // Use LogLevel[level] as fallback for prefix
  const text = msg; // msg is already a string, use it directly

  const args: any[] = [prefix, text]; // Start with prefix and base message
  if (dataPayload)  args.push(dataPayload); // Add dataPayload if it exists
  if (errorPayload) args.push(errorPayload); // Add errorPayload if it exists (includes stack)


  try {
    switch (level) {
      case LogLevel.ERROR  : console.error(...args); break;
      case LogLevel.WARNING: console.warn (...args); break;
      case LogLevel.INFO   : console.info (...args); break;
      case LogLevel.DEBUG  :
        // Check if console.debug exists, otherwise fallback to console.log
        typeof console.debug === 'function' ? console.debug(...args) : console.log(...args);
        break;
      default              : console.log  (...args);
    }
  } catch {
    /* swallow if the proxy is revoked */
    // Safely fall back if the console call fails (likely proxy revocation)
    try {
      // Convert to simple string format that won't cause additional errors
      // Ensure errorPayload is converted to string if it exists
      const errorString = errorPayload ? String(errorPayload) : '';
      console.error(prefix, text, errorString); // Log the captured text
    } catch {
      // Last resort fallback
      console.error('Logger error with message:', text); // Log the captured text
    }
  }
}


/* ---------- public API (single signature) ---------- */
export const logError = (m: string, meta?: Meta, cat?: string) =>
  _recordLog(LogLevel.ERROR,   m, meta, cat);

export const logWarn  = (m: string, meta?: Meta, cat?: string) =>
  _recordLog(LogLevel.WARNING, m, meta, cat);

export const logInfo  = (m: string, meta?: Meta, cat?: string) =>
  _recordLog(LogLevel.INFO,    m, meta, cat);

export const logDebug = (m: string, meta?: Meta, cat?: string) => {
  /* wrap primitive meta so TS doesn't whine */
  if (meta !== undefined
      && typeof meta !== 'object'
      && !(meta instanceof Error)) {
    meta = { data: meta };
  }
  _recordLog(LogLevel.DEBUG,   m, meta, cat);
};

/* helper for structured game‑event messages -------------------------- */
export const logGameEventDetails = (
  msg: string,
  cat = 'Game',
): void => _recordLog(LogLevel.INFO, msg, undefined, cat);

/* re‑export for legacy imports -------------------------------------- */
export { useLoggerStore } from '../stores/loggerStore';
export type { LogEntry }  from '../data/types';
export { LogLevel }       from '../data/types';   // ← fully re‑export enum