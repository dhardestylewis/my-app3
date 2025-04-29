'use client';

// components/GameLog.tsx
import React, { useEffect, useRef } from 'react';
import { useLoggerStore, LogLevel, LogEntry } from '@/utils/logger'; // Import LogEntry
import { useGameFlowStore } from '@/stores/useGameFlowStore';

interface GameLogProps {
  maxHeight?: string;
  showTimestamps?: boolean;
  enableDevMode?: boolean;
}

const GameLog: React.FC<GameLogProps> = ({ 
  maxHeight = '300px', 
  showTimestamps = false,
  enableDevMode = false
}) => {
  // Get all logs from the centralized logger
  const allLogs = useLoggerStore(state => state.logs);
  const setDebug = useLoggerStore(state => state.setDebug); // Corrected store action name
  // const debugMode = useLoggerStore(state => state.debugMode); // This seems unused, enableDevMode prop is used instead

  // Filter logs for user-facing view (e.g., INFO level and above)
  const userFacingLogs = allLogs.filter(log =>
    log.level === LogLevel.INFO || log.level === LogLevel.WARNING || log.level === LogLevel.ERROR
  );

  // Also get gameLog from gameFlowStore for backward compatibility (currently unused in rendering logic)
  const gameFlowLogs = useGameFlowStore(state => state.gameLog);
  
  // Reference to auto-scroll container
  const logEndRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when logs update
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [allLogs]); // Scroll only when allLogs update

  // Toggle debug mode in the store based on the prop
  useEffect(() => {
    // Assuming setDebug is now correctly defined in the store
    setDebug(enableDevMode);
  }, [enableDevMode, setDebug]);

  // Note: The error "Property 'setDebugMode' does not exist on type 'LoggerState'" 
  // indicates that the 'setDebugMode' action needs to be defined within your 
  // Zustand store configuration in '@/utils/logger'. You'll need to add 
  // 'setDebugMode: (mode: boolean) => void;' to the state interface and implement 
  // 'setDebugMode: (mode) => set({ debugMode: mode })' in the store creator.

  return (
    <div className="game-log-container">
      <div 
        className="game-log" 
        style={{ 
          maxHeight, 
          overflowY: 'auto',
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '12px',
          backgroundColor: enableDevMode ? '#f8f8f8' : 'white'
        }}
      >
        {enableDevMode ? (
          // Developer mode with detailed logs
          <>
            <div className="log-header" style={{ marginBottom: '8px', fontWeight: 'bold' }}>
              Developer Log ({allLogs.length} entries)
            </div>
            {allLogs.map((log, index) => (
              <div 
                key={index} 
                className={`log-entry log-level-${log.level}`}
                style={{
                  marginBottom: '4px',
                  padding: '4px',
                  borderLeft: `3px solid ${getLogLevelColor(log.level)}`,
                  fontSize: '0.9rem'
                }}
              >
                {showTimestamps && (
                  <span className="log-timestamp" style={{ color: '#888', marginRight: '8px' }}>
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                )}
                <span className="log-category" style={{ 
                  backgroundColor: getCategoryColor(log.category),
                  color: 'white',
                  padding: '2px 4px',
                  marginRight: '6px',
                  fontSize: '0.8rem' // Added font size for consistency
                }}>
                  {log.category || 'General'} {/* Display category */}
                </span>
                {/* Display the message part of the log entry */}
                {log.message}
              </div>
            ))}
          </>
        ) : (
          // User-facing logs (simpler display)
          <>
            <div className="log-header" style={{ marginBottom: '8px', fontWeight: 'bold' }}>
              Game Log
            </div>
            {/* Map over the filtered userFacingLogs */}
            {userFacingLogs.map((log: LogEntry, index: number) => (
              <div
                key={index}
                className="log-entry"
                style={{
                  marginBottom: '4px',
                  padding: '4px',
                }}
              >
                {/* Display the message part of the log entry */}
                {log.message}
              </div>
            ))}
          </>
        )}
        <div ref={logEndRef} /> {/* Scroll target */}
      </div> {/* Close game-log div */}
      
      {/* Optional debug mode toggle for development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="debug-controls" style={{ marginTop: '8px' }}>
          <label>
            <input 
              type="checkbox" 
              checked={enableDevMode} 
              // Assuming setDebug is correctly defined and passed down if needed,
              // but this component receives enableDevMode as a prop and uses useEffect to set it.
              // If direct control via checkbox is desired, a handler prop should be passed down.
              // For now, keeping the direct call, assuming setDebug is available.
              onChange={(e) => setDebug(e.target.checked)} 
            />
            Developer Mode
          </label>
          {/* Add button element */}
          <button
              onClick={() => window.open('/debug-logs', '_blank')}
              style={{
                marginLeft: '12px',
                padding: '4px 8px',
                fontSize: '0.8rem'
              }}
            >
              Open Log Explorer
            </button>
        </div>
      )}
    </div>
  );
};

// Utility functions for log styling
const getLogLevelColor = (level: LogLevel): string => {
  switch (level) {
    case LogLevel.DEBUG: return '#6c757d';  // Gray
    case LogLevel.INFO: return '#17a2b8';   // Teal
    case LogLevel.WARNING: return '#ffc107';   // Yellow
    case LogLevel.ERROR: return '#dc3545';  // Red
    default: return '#6c757d';       // Default gray
  }
};

const getCategoryColor = (category: string = ''): string => {
  switch (category) {
    case 'GameFlow': return '#007bff';  // Blue
    case 'Players': return '#28a745';   // Green
    case 'Cards': return '#fd7e14';     // Orange
    case 'Floors': return '#6f42c1';    // Purple
    case 'Building': return '#e83e8c';  // Pink
    default: return '#6c757d';          // Default gray
  }
};

export default GameLog;