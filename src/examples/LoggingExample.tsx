'use client';

// examples/LoggingExample.tsx
import React, { useEffect } from 'react';
import useLogger from '@/hooks/useLogger';
import { logError, logDebug } from '@/utils/logger';

interface ExampleProps {
  playerName: string;
}

/**
 * This component demonstrates different ways to use the logging system
 */
const LoggingExample: React.FC<ExampleProps> = ({ playerName }) => {
  // Method 1: Use the hook with a default category
  const logger = useLogger('UIComponent');
  
  // Log when component mounts
  useEffect(() => {
    // Using the hook methods
    logger.info(`Player ${playerName} viewed the game screen`);
    logger.debug(`Component mounted with props: ${JSON.stringify({ playerName })}`);
    
    // Using direct imported functions (alternative approach)
    logger.info(`${playerName} entered the game`);
    logDebug(`LoggingExample component initialized for ${playerName}`, 'UIComponent');
    
    return () => {
      logger.debug('Component unmounted');
    };
  }, [playerName, logger]);
  
  // Example functions that use logging
  const handleDrawCard = () => {
    logger.logCardAction(`${playerName} drew a card`);
    logger.debug(`Draw card button clicked by ${playerName}`);
    
    // Game logic would go here
  };
  
  const handleError = () => {
    // Log an error
    logger.error(`Failed to load game data for ${playerName}`);
    
    // You could also show an error UI
  };
  
  return (
    <div className="logging-example">
      <h2>Logging Example</h2>
      <p>Check console and the game log to see logging in action.</p>
      
      <div className="buttons" style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <button 
          onClick={handleDrawCard}
          style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none' }}
        >
          Draw Card (Info Log)
        </button>
        
        <button 
          onClick={() => logger.debug('Debug button clicked')}
          style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none' }}
        >
          Create Debug Log
        </button>
        
        <button 
          onClick={() => logger.warn('This is a warning message')}
          style={{ padding: '8px 16px', backgroundColor: '#ffc107', color: 'black', border: 'none' }}
        >
          Create Warning
        </button>
        
        <button 
          onClick={handleError}
          style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none' }}
        >
          Simulate Error
        </button>
      </div>
      
      {/* Display game logs */}
      <div className="logs-preview" style={{ marginTop: '30px' }}>
        <h3>Game Logs (User-Facing)</h3>
        <div 
          className="log-container" 
          style={{ 
            border: '1px solid #ddd', 
            padding: '10px',
            maxHeight: '200px',
            overflowY: 'auto',
            backgroundColor: '#f8f8f8'
          }}
        >
            {logger.userFacingLogs.map((log: { message: string }, index: number) => (
              <div key={index} className="log-entry" style={{ marginBottom: '5px' }}>
              {log.message}
              </div>
              ))}
          
          {logger.userFacingLogs.length === 0 && (
            <p style={{ color: '#888' }}>No logs yet. Try clicking the buttons above.</p>
          )}
        </div>
        
        {/* For development only - show debug controls */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{ marginTop: '10px' }}>
            <label>
              <input 
                type="checkbox"
                checked={false}
                onChange={(e) => {}}
              />
              Show Debug Logs
            </label>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoggingExample;