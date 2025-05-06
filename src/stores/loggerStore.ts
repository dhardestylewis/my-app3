// src/stores/loggerStore.ts
// Zustand + Immer log buffer with safe SSR / browser behaviour.

"use client";

import { create } from "zustand";
import { immer }  from "zustand/middleware/immer";
import { v4 as uuidv4 } from "uuid";
import type { LogEntry as TypesLogEntry } from "../data/types";
import { LogLevel } from "../data/types";

/* ────────────────────────────────────────────────────────────── *
 * 1. Environment helpers                                        *
 * ────────────────────────────────────────────────────────────── */
const isBrowser   = typeof window !== "undefined";
const safeRAF     = isBrowser && window.requestAnimationFrame
  ? window.requestAnimationFrame.bind(window)
  : (cb: () => void) => setTimeout(cb, 0);      // SSR fallback

const DEFAULT_DEBUG =
  process.env.NODE_ENV === "development";       // replaces import.meta check

/* ────────────────────────────────────────────────────────────── *
 * 2. Types & constants                                          *
 * ────────────────────────────────────────────────────────────── */
export interface LogEntry extends TypesLogEntry {} // re-export shape

const MAX_ENTRIES = 1_000;

/* ────────────────────────────────────────────────────────────── *
 * 3. Zustand store                                              *
 * ────────────────────────────────────────────────────────────── */
interface LoggerState {
  logs:           LogEntry[];
  pending:        LogEntry[];
  batchScheduled: boolean;
  debug:          boolean;
}

interface LoggerActions {
  log:      (msg: string, level?: LogLevel, cat?: string) => void;
  logMany:  (entries: Omit<LogEntry, "timestamp" | "id">[]) => void;
  flush:    ()                                                => void;
  clear:    ()                                                => void;
  setDebug: (flag: boolean)                                   => void;
}

export type LoggerStore = LoggerState & LoggerActions;

export const useLoggerStore = create<LoggerStore>()(
  immer((set, get) => ({
    /* ------------ state ------------ */
    logs:           [],
    pending:        [],
    batchScheduled: false,
    debug:          DEFAULT_DEBUG,

    /* ------------ actions ---------- */
    log: (message, level = LogLevel.INFO, category) => {
      const entry: LogEntry = {
        id:         uuidv4(),           // ← generate unique ID
        timestamp: Date.now(),
        message,
        level,
        category,
      };

      set(s => { s.pending.push(entry); });

      if (!get().batchScheduled) {
        set(s => { s.batchScheduled = true; });
        safeRAF(get().flush);                     // ← safe for SSR
      }

      if (get().debug) printOnce({ ...entry });   // plain copy → not wrapped
    },

    logMany: (batch) => {
      const ts = Date.now();
      const entries: LogEntry[] = batch.map(e => ({
        id:         uuidv4(),           // ← unique per batched entry
        timestamp: ts,
        ...e,
      }));
      set(s => {
        s.logs = [...entries, ...s.logs].slice(0, MAX_ENTRIES);
      });
      if (get().debug) entries.forEach(printOnce);
    },

    flush: () => {
      const { pending } = get();
      if (!pending.length) {
        set(s => { s.batchScheduled = false; });
        return;
      }
      set(s => {
        s.logs           = [...pending, ...s.logs].slice(0, MAX_ENTRIES);
        s.pending        = [];
        s.batchScheduled = false;
      });
      if (get().debug) {
        try {
          console.debug(`[logger] flushed ${pending.length} entr${pending.length === 1 ? "y" : "ies"}`);
        } catch (err) {
          // Silent fallback if console call fails
        }
      }
    },

    clear: () => set(s => {
      s.logs = s.pending = [];
      s.batchScheduled = false;
    }),

    setDebug: (flag) => set(s => { s.debug = flag; }),
  }))
);

/* ────────────────────────────────────────────────────────────── *
 * 4. Console mirroring with once-per-message dedupe           *
 * ────────────────────────────────────────────────────────────── */
const printed = new Set<string>();

// REFACTORED FUNCTION
function printOnce(entry: LogEntry) {
  // ☑️ pull these out *before* doing anything else
  const { level, category = "Log", message } = entry;
  const key = `${level}|${category}|${message}`; // Use destructured values for key

  if (printed.has(key)) return;
  printed.add(key);

  const prefix = `[${category}]`;

  try {
    switch (level) {
      case LogLevel.DEBUG  : console.debug (prefix, message); break;
      case LogLevel.INFO   : console.info  (prefix, message); break;
      case LogLevel.WARNING: console.warn  (prefix, message); break;
      case LogLevel.ERROR  : console.error(prefix, message); break;
      default              : console.log   (prefix, message);
    }
  } catch {
    /* swallow any console errors so we don’t crash on revoked proxies */
    // Safely fall back if console call fails (proxy revocation)
    try {
      // Attempt to log the original message, but ensure message is a string
      console.error("Logger error:", String(message));
    } catch {
      // Last resort if even String(message) fails or console.error itself is problematic
    }
  }
}

/* ────────────────────────────────────────────────────────────── *
 * 5. Convenience facade                                         *
 * ────────────────────────────────────────────────────────────── */
export const logger = {
  debug: (m: string, c?: string) =>
    useLoggerStore.getState().log(m, LogLevel.DEBUG,   c),
  info:  (m: string, c?: string) =>
    useLoggerStore.getState().log(m, LogLevel.INFO,    c),
  warn:  (m: string, c?: string) =>
    useLoggerStore.getState().log(m, LogLevel.WARNING, c),
  error: (m: string, err?: Error, c?: string) => {
    const msg = err ? `${m}: ${err.message}` : m;
    try {
      useLoggerStore.getState().log(msg, LogLevel.ERROR, c);
      if (err?.stack) {
        try {
          console.error(err.stack);
        } catch {
          // Silently fail if console call fails
        }
      }
    } catch (storeErr) {
      // Fall back to direct console if store access fails
      try {
        console.error(`[${c ?? 'Error'}]`, msg);
        if (err?.stack) console.error(err.stack);
      } catch {
        // Last resort fallback
        console.error("Logger error:", String(msg));
      }
    }
  },
  clear: () => useLoggerStore.getState().clear(),
};

/* optional helper for tests */
export const _resetPrintOnce = () => printed.clear();