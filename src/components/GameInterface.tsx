// First, update the imports in src/components/GameInterface.tsx
'use client';

import { useState } from 'react';
import { useGameFlowStore, GamePhase } from '@/stores/useGameFlowStore';
import { usePlayersStore, PlayerRole } from '@/stores/usePlayersStore';
import { useUIPopupStore } from '@/stores/useUIPopupStore'; // NEW: Import the popup store
import TowerVisualization from './TowerVisualization';
import NegotiationPanel from './NegotiationPanel';
import FloorTimeline from './FloorTimeline';
import GameOverScreen from './GameOverScreen';
import TitleScreen from './TitleScreen';
import DeckSelectorPopup from './DeckSelectorPopup'; // NEW: Import the popup component
import { logDebug } from '@/utils/logger';
import { MAX_HAND_SIZE } from '@/data/constants'; // NEW: Import for hand size check
import { BookOpen } from 'lucide-react'; // NEW: Import icon for deck button

// Then update the GameInterface component:

const GameInterface = () => {
    // Get necessary state from stores - separated selectors for stability
    const gamePhase = useGameFlowStore(state => state.gamePhase);
    const isAiTurn = useGameFlowStore(state => state.isAiTurn);
    
    // Get the function reference first, then call it outside the selector
    const canAccessDeckSelectorFn = useGameFlowStore(state => state.canAccessDeckSelector);
    
    // NEW: Get player info for deck button - separated selectors
    const humanPlayer = usePlayersStore(state => state.getHumanPlayer());
    const deckSize = usePlayersStore(state => state.deck.length);
    const handSize = humanPlayer?.hand.length || 0;
    
    // NEW: Get popup state - using destructured assignment for separate variables
    const isDeckSelectorOpen = useUIPopupStore(state => state.isDeckSelectorOpen);
    const openDeckSelector = useUIPopupStore(state => state.openDeckSelector);
    const closeDeckSelector = useUIPopupStore(state => state.closeDeckSelector);
    
    // Now call the function after selecting it to avoid re-computation in the selector
    const canDrawFromDeck = canAccessDeckSelectorFn();

    // Render different screens based on game state
    const renderContent = () => {
        logDebug(`[GameInterface] Rendering phase: ${gamePhase}`, 'UI');
        switch (gamePhase) {
            case GamePhase.Title:
                return <TitleScreen />;

            case GamePhase.Playing:
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 h-[calc(100vh-2rem)] p-4 max-w-screen-2xl mx-auto">
                        {/* Left Column: Tower Visualization + Floor Timeline */}
                        <div className="lg:col-span-5 flex flex-col gap-4 md:gap-6 overflow-hidden">
                            <div className="flex-grow bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden min-h-[300px] relative">
                                <TowerVisualization />
                                
                                {/* NEW: Add Draw from Deck button */}
                                {gamePhase === GamePhase.Playing && (
                                    <div className="absolute bottom-4 right-4">
                                        <button
                                            onClick={openDeckSelector}
                                            disabled={!canDrawFromDeck}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium shadow-md transition-all ${
                                                canDrawFromDeck
                                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                                    : 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-70'
                                            }`}
                                            title={!canDrawFromDeck ? (
                                                deckSize === 0 
                                                    ? 'Deck is empty' 
                                                    : handSize >= MAX_HAND_SIZE 
                                                        ? 'Hand is full' 
                                                        : "Not your turn"
                                            ) : 'Draw cards from deck'}
                                        >
                                            <BookOpen size={16} />
                                            <span>Draw ({deckSize})</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-3">
                                <FloorTimeline />
                            </div>
                        </div>

                        {/* Right Column: Negotiation Panel + Optional Log */}
                        <div className="lg:col-span-7 flex flex-col gap-4 md:gap-6 overflow-hidden">
                            <div className="flex-grow min-h-[400px]">
                                <NegotiationPanel />
                            </div>
                        </div>
                        
                        {/* NEW: Render the DeckSelectorPopup when open */}
                        {isDeckSelectorOpen && (
                            <DeckSelectorPopup onClose={closeDeckSelector} />
                        )}
                    </div>
                );

            case GamePhase.GameOver:
                return <GameOverScreen />;

            default:
                logDebug(`[GameInterface] Encountered unknown game phase: ${gamePhase}`, 'UI');
                return (
                    <div className="flex items-center justify-center h-full">
                        Loading or Invalid State...
                    </div>
                );
        }
    };

    // Main container for the interface content
    return (
        <div className="w-full h-screen overflow-hidden">
             {renderContent()}
        </div>
    );
};

export default GameInterface;