// src/components/GameLog.tsx
// This is based on the version you provided.
// Ensure useLoggerStore, LogLevel, LogEntry, and setDebug action are correctly defined in @/utils/logger.

'use client';
import React, { useEffect, useRef } from 'react';
import { useLoggerStore, LogLevel, LogEntry } from '@/utils/logger'; // Ensure path and exports are correct
import { useGameFlowStore } from '@/stores/useGameFlowStore'; // gameLog from here is not rendered, but kept from original

interface GameLogProps {
  maxHeight?: string;
  showTimestamps?: boolean;
  enableDevMode?: boolean; // This prop controls the view mode
}

const GameLog: React.FC<GameLogProps> = ({ 
  maxHeight = '300px', 
  showTimestamps = false,
  enableDevMode = false
}) => {
  const allLogs = useLoggerStore(state => state.logs);
  // Assuming 'setDebug' is the correct action name in your useLoggerStore
  const setDebugInStore = useLoggerStore(state => state.setDebug); 

  const userFacingLogs = allLogs.filter(log =>
    log.level === LogLevel.INFO || log.level === LogLevel.WARNING || log.level === LogLevel.ERROR
  );

  // gameFlowLogs from useGameFlowStore is fetched but not used in this rendering logic.
  // const gameFlowLogs = useGameFlowStore(state => state.gameLog); 
  
  const logEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [allLogs]);

  useEffect(() => {
    if (setDebugInStore) { // Check if the action exists
        setDebugInStore(enableDevMode);
    }
  }, [enableDevMode, setDebugInStore]);

  return (
    <div className="game-log-container p-2 bg-slate-850 rounded-md border border-slate-700 h-full flex flex-col"> {/* Added styling context */}
      <div 
        className="game-log flex-grow" 
        style={{ 
          maxHeight: `calc(${maxHeight} - 2rem)`, // Adjust if header is present
          overflowY: 'auto',
          // Removed inline border, bg, padding to inherit or use Tailwind from parent
        }}
      >
        {enableDevMode ? (
          <>
            <div className="log-header mb-2 font-semibold text-slate-300 text-sm">
              Developer Log ({allLogs.length})
            </div>
            {allLogs.map((log, index) => (
              <div 
                key={index} 
                className={`log-entry log-level-${LogLevel[log.level]?.toLowerCase()} mb-1 p-1 text-xs border-l-2 ${getLogLevelBorderStyle(log.level)}`}
              >
                {showTimestamps && (
                  <span className="log-timestamp text-slate-500 mr-2">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                )}
                {log.category && (
                  <span className="log-category font-medium mr-1.5" style={{ color: getCategoryColor(log.category) }}>
                    [{log.category}]
                  </span>
                )}
                <span className="log-message" style={{color: getLogLevelTextColor(log.level)}}>
                    {log.message}
                </span>
                {log.data && <pre className="text-xs text-slate-600 bg-slate-900 p-1 mt-1 rounded overflow-x-auto">{JSON.stringify(log.data, null, 2)}</pre>}
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="log-header mb-2 font-semibold text-slate-300 text-sm">
              Game Events
            </div>
            {userFacingLogs.length === 0 && <p className="text-slate-500 italic text-xs">No game events yet.</p>}
            {userFacingLogs.map((log: LogEntry, index: number) => (
              <div
                key={index}
                className="log-entry mb-1 p-1 text-xs"
                style={{ color: getLogLevelTextColor(log.level) }}
              >
                {showTimestamps && (
                  <span className="log-timestamp text-slate-500 mr-2">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
                {log.message}
              </div>
            ))}
          </>
        )}
        <div ref={logEndRef} />
      </div>
      
      {process.env.NODE_ENV === 'development' && (
        <div className="debug-controls mt-2 pt-2 border-t border-slate-700">
          <label className="flex items-center text-xs text-slate-400">
            <input 
              type="checkbox" 
              className="mr-2 accent-sky-500"
              checked={enableDevMode} 
              onChange={(e) => setDebugInStore(e.target.checked)} 
            />
            Show Developer Logs
          </label>
        </div>
      )}
    </div>
  );
};

const getLogLevelBorderStyle = (level: LogLevel): string => {
  switch (level) {
    case LogLevel.DEBUG: return 'border-slate-500';
    case LogLevel.INFO: return 'border-blue-500';
    case LogLevel.WARNING: return 'border-amber-500';
    case LogLevel.ERROR: return 'border-red-500';
    default: return 'border-slate-600';
  }
};
const getLogLevelTextColor = (level: LogLevel): string => {
  switch (level) {
    case LogLevel.DEBUG: return '#94a3b8';  // slate-400
    case LogLevel.INFO: return '#60a5fa';   // blue-400
    case LogLevel.WARNING: return '#facc15'; // yellow-400
    case LogLevel.ERROR: return '#f87171';   // red-400
    default: return '#94a3b8'; 
  }
};

const getCategoryColor = (category: string = ''): string => {
  // Consistent with Lucide icon colors for roles
  switch (category.toLowerCase()) {
    case 'gameflow': return '#38bdf8';   // sky-400
    case 'players': return '#34d399';  // emerald-400
    case 'cards': return '#fb923c';     // orange-400
    case 'floors': return '#a78bfa';    // violet-400
    case 'building': return '#f472b6';  // pink-400
    case 'ai': return '#c084fc';        // purple-400
    default: return '#94a3b8';       // slate-400
  }
};

export default GameLog;