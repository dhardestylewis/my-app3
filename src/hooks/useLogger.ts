// hooks/useLogger.ts
import { useCallback } from 'react';
import { useLoggerStore } from '@/stores/loggerStore';
import { LogLevel } from '@/stores/loggerStore';

/**
 * Custom hook to provide easy access to logging functions with a specific category
 * @param defaultCategory The default category to use for logs from this component/module
 * @returns Object with logging methods
 */
export const useLogger = (defaultCategory: string) => {
  const { log, logs } = useLoggerStore();
  
  // Create memoized logging functions that use the default category
  const debug = useCallback(
    (message: string, category?: string) => 
      log(message, LogLevel.DEBUG, category || defaultCategory),
    [log, defaultCategory]
  );
  
  const info = useCallback(
    (message: string, category?: string) => 
      log(message, LogLevel.INFO, category || defaultCategory),
    [log, defaultCategory]
  );
  
  const warn = useCallback(
    (message: string, category?: string) => 
      log(message, LogLevel.WARNING, category || defaultCategory),
    [log, defaultCategory]
  );
  
  const error = useCallback(
    (message: string, category?: string) => 
      log(message, LogLevel.ERROR, category || defaultCategory),
    [log, defaultCategory]
  );
  
  // Specific game event logging with automatic INFO level
  const logGameEvent = useCallback(
    (message: string) => log(message, LogLevel.INFO, 'GameFlow'),
    [log]
  );
  
  const logPlayerAction = useCallback(
    (message: string) => log(message, LogLevel.INFO, 'Players'),
    [log]
  );
  
  const logCardAction = useCallback(
    (message: string) => log(message, LogLevel.INFO, 'Cards'),
    [log]
  );
  
  const logFloorAction = useCallback(
    (message: string) => log(message, LogLevel.INFO, 'Floors'),
    [log]
  );
  
  const logBuildingAction = useCallback(
    (message: string) => log(message, LogLevel.INFO, 'Building'),
    [log]
  );
  
  return {
    // Basic logging methods
    debug,
    info,
    warn,
    error,
    
    // Game-specific methods
    logGameEvent,
    logPlayerAction,
    logCardAction,
    logFloorAction,
    logBuildingAction,
    
    // Access to logs
    userFacingLogs: logs,
    allLogs: logs,
    
    // Debug mode control
  };
};

export default useLogger;