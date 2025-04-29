'use client';

// src/components/GameInterface.tsx

import { useState } from 'react';
import { useGameFlowStore, GamePhase } from '@/stores/useGameFlowStore';
import { usePlayersStore, PlayerRole } from '@/stores/usePlayersStore';
// No longer need telemetry or building store directly here unless displaying more specific info
// import { useTelemetryStore } from '@/stores/useTelemetryStore';
// import { useBuildingStore } from '@/stores/useBuildingStore';
import TowerVisualization from './TowerVisualization';
import NegotiationPanel from './NegotiationPanel';
import FloorTimeline from './FloorTimeline';
import GameOverScreen from './GameOverScreen'; // Assume GameOver details are in a separate component
import TitleScreen from './TitleScreen'; // Assume Title Screen details are in a separate component
import { logDebug } from '@/utils/logger';

const GameInterface = () => {
    // Get necessary state from stores
    const gamePhase = useGameFlowStore(state => state.gamePhase);
    // const gameLog = useGameFlowStore(state => state.gameLog); // Kept for potential log display

    // Render different screens based on game state
    const renderContent = () => {
        logDebug(`[GameInterface] Rendering phase: ${gamePhase}`, 'UI');
        switch (gamePhase) {
            case GamePhase.Title:
                // TitleScreen component handles role selection and starting the game
                return <TitleScreen />;

            case GamePhase.Playing:
                return (
                    // Main game layout (using CSS Grid for structure)
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6 h-[calc(100vh-2rem)] p-4 max-w-screen-2xl mx-auto">
                        {/* Left Column: Tower Visualization + Floor Timeline */}
                        <div className="lg:col-span-5 flex flex-col gap-4 md:gap-6 overflow-hidden">
                            <div className="flex-grow bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden min-h-[300px]">
                                <TowerVisualization />
                            </div>
                            <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-3">
                                <FloorTimeline />
                            </div>
                        </div>

                        {/* Right Column: Negotiation Panel + Optional Log */}
                        <div className="lg:col-span-7 flex flex-col gap-4 md:gap-6 overflow-hidden">
                            <div className="flex-grow min-h-[400px]">
                                {/* Negotiation Panel handles the core interaction */}
                                <NegotiationPanel />
                            </div>

                            {/* Optional: Display simple game log (can be removed/replaced) */}
                            {/* <div className="bg-slate-800/50 rounded-lg border border-slate-700 p-4 max-h-60 overflow-y-auto text-sm">
                                <h3 className="font-semibold text-slate-300 mb-2 sticky top-0 bg-slate-800/80 backdrop-blur-sm py-1">Game Log</h3>
                                <div className="space-y-1">
                                    {gameLog.slice(0, 15).map((log, index) => ( // Show limited log entries
                                        <p key={`log-${index}`} className="py-1 border-b border-slate-700/50 last:border-b-0 text-slate-400">{log}</p>
                                    ))}
                                </div>
                            </div> */}
                        </div>
                    </div>
                );

            case GamePhase.GameOver:
                // GameOverScreen component handles displaying results and play again options
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
        <div className="w-full h-screen overflow-hidden"> {/* Prevent body scroll */}
             {renderContent()}
        </div>
    );
};

export default GameInterface;