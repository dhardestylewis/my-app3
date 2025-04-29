// src/utils/logger.ts
import { useLoggerStore } from '../stores/loggerStore';
import { LogLevel } from '../stores/loggerStore';

/**
 * A single log entry record.
 */
export interface LogEntry {
  /** Milliseconds since epoch */
  timestamp: number;
  /** The log message */
  message:   string;
  /** Severity level */
  level:     LogLevel;
  /** Optional category/tag */
  category?: string;
}

/**
 * logError overloads:
 *  • logError(msg, category?)
 *  • logError(msg, Error, category?)
 */
export function logError(
  message: string,
  errorOrCategory?: Error | string,
  category?: string,
): void {
  const store = useLoggerStore.getState();

  if (errorOrCategory instanceof Error) {
    // Called as logError(msg, err, cat?)
    const err = errorOrCategory;
    store.log(
      `${message}: ${err.message}`,
      LogLevel.ERROR,
      category ?? 'Error'
    );
    console.error(err.stack ?? err);
  } else {
    // Called as logError(msg, category?)
    const cat = errorOrCategory ?? 'Error';
    store.log(message, LogLevel.ERROR, cat);
    console.error(`[${cat}] ${message}`);
  }
}

/**
 * Logs a game event with standardized formatting.
 */
export function logGameEventDetails(
  message: string,
  category = 'Game'
): void {
  const store = useLoggerStore.getState();
  store.log(message, LogLevel.INFO, category);
  console.info(`[${category}] ${message}`);
}

// ───────────────────────────────────────── Shim for named imports ───────

/**
 * Low-overhead alias for DEBUG-level logging.
 */
export const logDebug = (
  message: string,
  category?: string
): void => {
  const { log, debug } = useLoggerStore.getState();
  log(message, LogLevel.DEBUG, category);
  if (debug) {
    console.debug(`[${category ?? 'Log'}] ${message}`);
  }
};

/**
 * Convenience alias for INFO-level logging.
 */
export const logInfo = (
  message: string,
  category?: string
): void => {
  const { log, debug } = useLoggerStore.getState();
  log(message, LogLevel.INFO, category);
  if (debug) {
    console.info(`[${category ?? 'Log'}] ${message}`);
  }
};

/**
 * Convenience alias for WARNING-level logging.
 */
export const logWarn = (
  message: string,
  category?: string
): void => {
  const { log, debug } = useLoggerStore.getState();
  log(message, LogLevel.WARNING, category);
  if (debug) {
    console.warn(`[${category ?? 'Log'}] ${message}`);
  }
};

// ───────────────────────────────────────── Exports ───────

export { LogLevel, useLoggerStore };
