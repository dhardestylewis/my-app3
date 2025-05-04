import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

/**
 * -------------------------------------------------------------
 *  Logger Store — Zustand + Immer (with "print‑once" console output)
 * -------------------------------------------------------------
 *  • Batched writes (requestAnimationFrame)
 *  • Per‑message deduping so identical logs hit the console only once
 *  • Pluggable max‑entry cap & debug flag
 *  • Console mirroring (opt‑in via debug)
 *  • Convenience wrapper (logger.xxx)
 * -------------------------------------------------------------
 */

// ───────────────────────────────────────────────────────── Types ──
export enum LogLevel {
  DEBUG   = 'debug',
  INFO    = 'info',
  WARNING = 'warning',
  ERROR   = 'error',
  GAME    = 'game',
}

export interface LogEntry {
  timestamp: number;          // ms since epoch
  message:   string;
  level:     LogLevel;
  category?: string;
}

// ─────────────────────────────────────────────────────── Constants ──
const MAX_ENTRIES   = 1_000;
const DEFAULT_DEBUG = typeof import.meta !== 'undefined'
  ? (import.meta as any).env?.MODE === 'development'
  : process.env.NODE_ENV === 'development';

// ─────────────────────────────────────────── Store ▸ State + Actions ──
interface LoggerState {
  logs:            LogEntry[];
  pending:         LogEntry[];
  batchScheduled:  boolean;
  debug:           boolean;
}

interface LoggerActions {
  log:      (message: string, level?: LogLevel, category?: string) => void;
  logMany:  (entries: Omit<LogEntry, 'timestamp'>[])               => void;
  flush:    ()                                                    => void;
  clear:    ()                                                    => void;
  setDebug: (enabled: boolean)                                    => void;
}

export type LoggerStore = LoggerState & LoggerActions;

// ────────────────────────────────────────────────────────── Factory ──
export const useLoggerStore = create<LoggerStore>()(
  immer((set, get) => ({
    // State --------------------------------------------------------
    logs:           [],
    pending:        [],
    batchScheduled: false,
    debug:          DEFAULT_DEBUG,

    // Actions ------------------------------------------------------
    log: (message, level = LogLevel.INFO, category) => {
      const entry: LogEntry = {
        timestamp: Date.now(),
        message,
        level,
        category,
      };
      set(s => { s.pending.push(entry); });

      if (!get().batchScheduled) {
        set(s => { s.batchScheduled = true; });
        requestAnimationFrame(get().flush);
      }

      if (get().debug) printToConsole(entry);
    },

    logMany: (entries) => {
      const ts = Date.now();
      const batch: LogEntry[] = entries.map(e => ({ timestamp: ts, ...e }));
      set(s => {
        s.logs = [...batch, ...s.logs].slice(0, MAX_ENTRIES);
      });
      if (get().debug) batch.forEach(printToConsole);
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
        console.debug(`[logger] flushed ${pending.length} entr${pending.length === 1 ? 'y' : 'ies'}`);
      }
    },

    clear: () => set(s => {
      s.logs           = [];
      s.pending        = [];
      s.batchScheduled = false;
    }),

    setDebug: (enabled) => set(s => { s.debug = enabled; }),
  }))
);

// ─────────────────────────────────────────────────────── Helpers ──
/** Keeps track of every (level|category|message) triple that has already been printed. */
const onceCache = new Set<string>();

function printToConsole(entry: LogEntry): void {
  // Deterministic key — cheap string concat, good enough even for thousands of msgs.
  const cacheKey = `${entry.level}|${entry.category ?? ''}|${entry.message}`;
  if (onceCache.has(cacheKey)) return; // Already seen — swallow.
  onceCache.add(cacheKey);

  const prefix = `[${entry.category ?? 'Log'}]`;
  switch (entry.level) {
    case LogLevel.DEBUG:   console.debug (prefix, entry.message); break;
    case LogLevel.INFO:    console.info  (prefix, entry.message); break;
    case LogLevel.WARNING: console.warn  (prefix, entry.message); break;
    case LogLevel.ERROR:   console.error(prefix, entry.message); break;
    case LogLevel.GAME:    console.log   (prefix, entry.message); break;
  }
}

/** For unit tests / HMR: clear the dedupe cache so the next identical message will print again. */
export const _resetLoggerOnceCacheForTests = (): void => onceCache.clear();

// ──────────────────────────────────────────────── Public Facade ──
export const logger = {
  debug: (msg: string, cat?: string) =>
    useLoggerStore.getState().log(msg, LogLevel.DEBUG, cat),
  info:  (msg: string, cat?: string) =>
    useLoggerStore.getState().log(msg, LogLevel.INFO, cat),
  warn:  (msg: string, cat?: string) =>
    useLoggerStore.getState().log(msg, LogLevel.WARNING, cat),
  error: (msg: string, err?: Error, cat?: string) => {
    const m = err ? `${msg}: ${err.message}` : msg;
    useLoggerStore.getState().log(m, LogLevel.ERROR, cat);
    if (err?.stack) console.error(err.stack);
  },
  game:   (msg: string, cat?: string) =>
    useLoggerStore.getState().log(msg, LogLevel.GAME, cat),
  events: (msgs: string[], cat?: string) => {
    const entries = msgs.map(message => ({
      level:    LogLevel.GAME,
      message,
      category: cat,
    }));
    useLoggerStore.getState().logMany(entries);
  },
  flush: ()  => useLoggerStore.getState().flush(),
  clear: ()  => useLoggerStore.getState().clear(),
  formatted: (level?: LogLevel): string[] => {
    const { flush, logs } = useLoggerStore.getState();
    flush();
    return logs
      .filter(l => !level || l.level === level)
      .map(({ timestamp, message }) => {
        const t = new Date(timestamp).toLocaleTimeString();
        return `[${t}] ${message}`;
      });
  },
};
