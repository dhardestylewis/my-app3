"use client";
import React, { useMemo } from 'react';
import { useGameStore } from "@/store/useGameStore";
import Card from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { Layers, Users, Bot, Info, Clock } from 'lucide-react';

// Import new components for floor-by-floor negotiation
import TowerVisualization from './TowerVisualization';
import NegotiationPanel from './NegotiationPanel';
import FloorTimeline from './FloorTimeline';

// Game info bar at the top of the screen
function GameInfoBar() {
  // Use individual selectors for each piece of state to prevent infinite loops
  const currentNetScore = useGameStore(state => state.building.currentNetScore);
  const players = useGameStore(state => state.players);
  const currentPlayerIndex = useGameStore(state => state.currentPlayerIndex);
  const deckLength = useGameStore(state => state.deck.length);
  const currentFloor = useGameStore(state => state.currentFloor);
  const gameLog = useGameStore(state => state.gameLog);
  
  // Compute derived state with useMemo
  const latestLog = useMemo(() => gameLog[0] ?? "Game Ready", [gameLog]);
  const currentPlayer = useMemo(() => players?.[currentPlayerIndex], [players, currentPlayerIndex]);
  const currentPlayerName = useMemo(() => currentPlayer?.name ?? 'Loading...', [currentPlayer]);

  // Format net score display
  const scoreDisplay = useMemo(() => {
    let balanceText = "";
    let balanceColor = "text-slate-300";
    
    if (currentNetScore > 0) {
      balanceText = `+${currentNetScore} Developer`;
      balanceColor = "text-amber-400";
    } else if (currentNetScore < 0) {
      balanceText = `${currentNetScore} Community`; // Negative shown implicitly
      balanceColor = "text-lime-400";
    } else {
      balanceText = "Balanced (0)";
    }
    
    return { balanceText, balanceColor };
  }, [currentNetScore]);

  return (
    <div className="w-full bg-slate-800/80 backdrop-blur text-sm p-2 border-b border-slate-700 flex justify-between items-center z-40 fixed top-0 left-0 right-0 h-[56px]">
      {/* Left Side: Turn Info & Deck */}
      <div className="flex items-center gap-4">
        <div className="pl-2">
          <p className="text-slate-400 text-xs">Floor</p>
          <p className="text-slate-100 font-semibold">{currentFloor}</p>
        </div>
        <div className="pl-2">
          <p className="text-slate-400 text-xs">Turn</p>
          <p className="text-slate-100 font-semibold truncate max-w-[150px]">{currentPlayerName}</p>
        </div>
        {/* Deck Display */}
        <div className="pl-4 border-l border-slate-600 text-center" title={`${deckLength} cards left`}>
          <Layers size={18} className="text-slate-400 mx-auto" />
          <p className="text-xs text-slate-300">{deckLength}</p>
        </div>
      </div>

      {/* Center: Balance Score */}
      <div className="flex-grow text-center px-4">
        <p className="text-xs text-slate-400">Project Balance</p>
        <p className={`text-lg font-bold ${scoreDisplay.balanceColor}`}>{scoreDisplay.balanceText}</p>
      </div>

      {/* Right Side: Log */}
      <div className="text-right text-slate-400 max-w-xs md:max-w-sm lg:max-w-md truncate pr-2" title={latestLog}>
        <Info size={14} className="inline mr-1 flex-shrink-0" /> <span>{latestLog}</span>
      </div>
    </div>
  );
}

function OpponentInfo() {
  // Use individual selectors to avoid circular dependencies
  const players = useGameStore(state => state.players);
  const currentPlayerIndex = useGameStore(state => state.currentPlayerIndex);

  // Compute opponent information with useMemo
  const opponentInfo = useMemo(() => {
    const opponent = players.find((p) => p.type === 'ai');
    const currentPlayerId = players[currentPlayerIndex]?.id;
    
    if (!opponent) return null;
    
    const isCurrentTurn = opponent.id === currentPlayerId;
    
    return {
      opponent,
      isCurrentTurn
    };
  }, [players, currentPlayerIndex]);

  if (!opponentInfo) return null;

  const { opponent, isCurrentTurn } = opponentInfo;

  return (
    <div className="absolute top-[64px] right-4 z-20">
      <div className={`bg-slate-700/70 backdrop-blur-sm p-2 rounded border border-slate-600 text-xs text-slate-300 shadow-lg transition-all duration-300 ${isCurrentTurn ? 'ring-2 ring-blue-400 scale-105' : 'opacity-80'}`}>
        <p className="font-semibold text-white">
          <Bot size={12} className="inline mr-1" /> {opponent.name}
        </p>
        <p>Role: {opponent.role}</p>
        <p>Hand: {opponent.hand?.length ?? 0} cards</p>
        <p>Recall Tokens: {opponent.recallTokens ?? 0}</p>
      </div>
    </div>
  );
}

function GameLog() {
  const gameLog = useGameStore(state => state.gameLog);
  
  return (
    <div className="bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-700 p-4 max-h-72 overflow-y-auto">
      <h3 className="font-bold mb-2 text-slate-300">Game Log</h3>
      <div className="space-y-1 text-sm">
        {gameLog.map((log, index) => (
          <p key={`log-${index}`} className="py-1 border-b border-slate-700/50 text-slate-400">{log}</p>
        ))}
      </div>
    </div>
  );
}

// Main Game Screen Component
export default function GameScreen() {
  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-black text-slate-200 relative overflow-hidden">
      <GameInfoBar />
      <OpponentInfo />
      
      {/* Main area with negotiation components - Added fixed padding for smaller screens */}
      <main className="flex-grow pt-[64px] pb-4 overflow-y-auto">
        <div className="container mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-[calc(100vh-68px)]">
          {/* Left Column: Tower + Floor Timeline */}
          <div className="lg:col-span-5 flex flex-col gap-4 h-full min-h-[50vh] lg:min-h-0 pb-4">
            <div className="flex-grow bg-slate-800/30 backdrop-blur-sm border border-slate-700 rounded-lg overflow-hidden">
              <TowerVisualization />
            </div>
            <div className="min-h-[180px] sticky bottom-4 z-10">
              <FloorTimeline />
            </div>
          </div>
          
          {/* Right Column: Negotiation + Log */}
          <div className="lg:col-span-7 flex flex-col gap-4 h-full min-h-[50vh] lg:min-h-0 pb-4">
            <div className="flex-grow min-h-[400px]">
              <NegotiationPanel />
            </div>
            <div className="min-h-[150px]">
              <GameLog />
            </div>
          </div>
        </div>
      </main>
      
      {/* Responsive message for small screens */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur text-center p-2 text-xs text-slate-400 lg:hidden">
        Rotate device for better experience
      </div>
    </div>
  );
}