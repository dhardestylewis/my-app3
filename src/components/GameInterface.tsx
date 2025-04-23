import { useState } from 'react';
import { useGameStore } from '@/store/useGameStore';
import TowerVisualization from './TowerVisualization';
import NegotiationPanel from './NegotiationPanel';
import FloorTimeline from './FloorTimeline';

const GameInterface = () => {
  const { 
    gameState, 
    gameLog, 
    players, 
    currentPlayerIndex,
    building,
    startGame,
    resetGame,
    winnerMessage,
    gameOverReason,
    telemetry,
  } = useGameStore(state => state);
  
  const [selectedRole, setSelectedRole] = useState<'community' | 'developer'>('community');
  
  // Render different screens based on game state
  const renderContent = () => {
    switch (gameState) {
      case 'title':
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <h1 className="text-3xl font-bold mb-6">Urban Balance</h1>
            <h2 className="text-xl mb-8">Floor-by-Floor Negotiation Game</h2>
            
            <div className="mb-6">
              <p className="mb-2 text-center">Choose your role:</p>
              <div className="flex gap-4">
                <button
                  className={`px-4 py-2 rounded ${selectedRole === 'community' ? 'bg-green-600 text-white' : 'bg-gray-200'}`}
                  onClick={() => setSelectedRole('community')}
                >
                  Community
                </button>
                <button
                  className={`px-4 py-2 rounded ${selectedRole === 'developer' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                  onClick={() => setSelectedRole('developer')}
                >
                  Developer
                </button>
              </div>
            </div>
            
            <button
              className="px-6 py-3 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
              onClick={() => startGame(selectedRole)}
            >
              Start Game
            </button>
          </div>
        );
        
      case 'playing':
        return (
          <div className="grid grid-cols-12 gap-4 h-full">
            {/* Left Column: Tower + Floor Timeline */}
            <div className="col-span-5 flex flex-col gap-4">
              <div className="flex-grow">
                <TowerVisualization />
              </div>
              <div>
                <FloorTimeline />
              </div>
            </div>
            
            {/* Right Column: Negotiation + Log */}
            <div className="col-span-7 flex flex-col gap-4">
              <div className="flex-grow">
                <NegotiationPanel />
              </div>
              <div className="bg-white rounded-lg shadow p-4 max-h-72 overflow-y-auto">
                <h3 className="font-bold mb-2">Game Log</h3>
                <div className="space-y-1 text-sm">
                  {gameLog.map((log, index) => (
                    <p key={`log-${index}`} className="py-1 border-b border-gray-100">{log}</p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
        
      case 'gameOver':
        return (
          <div className="flex flex-col items-center justify-center h-full">
            <h1 className="text-3xl font-bold mb-4">Game Over</h1>
            <h2 className="text-2xl mb-8">{winnerMessage}</h2>
            <p className="mb-4 text-gray-700">{gameOverReason}</p>
            
            <div className="mb-8 bg-white p-6 rounded-lg shadow w-full max-w-md">
              <h3 className="font-bold mb-2">Game Analytics</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold">Average Negotiation Time:</p>
                  <p>{
                    Object.values(telemetry.negotiationTimes).length > 0 ?
                    (Object.values(telemetry.negotiationTimes).reduce((a, b) => a + b, 0) / 
                    Object.values(telemetry.negotiationTimes).length).toFixed(1) + 's' :
                    'N/A'
                  }</p>
                </div>
                <div>
                  <p className="font-semibold">Recall Tokens Used:</p>
                  <p>Community: {telemetry.recallsUsed.community}</p>
                  <p>Developer: {telemetry.recallsUsed.developer}</p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-4">
              <button
                className="px-6 py-3 bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                onClick={resetGame}
              >
                Back to Title
              </button>
              <button
                className="px-6 py-3 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition"
                onClick={() => startGame(selectedRole)}
              >
                Play Again
              </button>
            </div>
          </div>
        );
        
      default:
        return <div>Loading...</div>;
    }
  };
  
  return (
    <div className="container mx-auto p-4 h-screen bg-gray-100">
      {renderContent()}
    </div>
  );
};

export default GameInterface;