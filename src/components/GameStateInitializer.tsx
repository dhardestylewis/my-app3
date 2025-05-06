"use client";

import { useEffect, useState } from 'react';
import { usePlayersStore } from '@/stores/usePlayersStore';
import { useGameFlowStore } from '@/stores/useGameFlowStore';
import { useFloorStore } from '@/stores/useFloorStore';
import { useBuildingStore } from '@/stores/useBuildingStore';
import { PlayerRole, PlayerType } from '@/data/types';

// This component ensures proper game state initialization
export default function GameStateInitializer() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Only run once
    if (initialized) return;
    
    console.log("🔄 GameStateInitializer running...");
    
    // Wait for stores to be available
    setTimeout(() => {
      // Check if we have an active game by looking at game phase
      const gamePhase = useGameFlowStore.getState().gamePhase;
      const players = usePlayersStore.getState().players;
      
      // Check if players array exists and first player is defined
      const hasValidPlayers = players && 
        players.length > 0 && 
        players[0] !== undefined && 
        players[0] !== null &&
        typeof players[0].id === 'string';
      
      console.log("Current game state:", { 
        gamePhase,
        playerCount: players?.length || 0,
        hasValidPlayers
      });
      
      // If game is in title phase or players aren't initialized properly
      if (gamePhase === 'title' || !hasValidPlayers) {
        console.log("Game needs initialization. Starting fresh game...");
        
        // Reset all stores to clean state
        useGameFlowStore.getState().resetGame();
        
        // Force clean start with developer role (or whatever default you prefer)
        setTimeout(() => {
          useGameFlowStore.getState().startGame(PlayerRole.Developer);
          
          // Verify initialization worked
          setTimeout(() => {
            const newPlayers = usePlayersStore.getState().players;
            console.log("Players after initialization:", newPlayers);
            
            if (newPlayers && newPlayers.length > 0 && newPlayers[0] !== undefined) {
              console.log("✅ Game initialized successfully!");
            } else {
              console.error("❌ Game initialization failed. Players still undefined.");
            }
            
            // Add debugging helper to global scope for console access
            if (typeof window !== 'undefined') {
              (window as any).debugGame = {
                players: usePlayersStore.getState,
                gameFlow: useGameFlowStore.getState,
                floors: useFloorStore.getState,
                building: useBuildingStore.getState,
                fixPlayers: () => {
                  // Emergency function to fix player data
                  const fixedPlayers = [
                    {
                      id: 'human',
                      name: 'You (developer)',
                      type: PlayerType.Human,
                      role: PlayerRole.Developer,
                      hand: [],
                      recallTokens: 2,
                      isLeadPlayer: true
                    },
                    {
                      id: 'ai',
                      name: 'AI (community)',
                      type: PlayerType.AI,
                      role: PlayerRole.Community,
                      hand: [],
                      recallTokens: 2,
                      isLeadPlayer: false
                    }
                  ];
                  usePlayersStore.setState({ players: fixedPlayers, currentPlayerIndex: 0 });
                  console.log("Manual player fix applied!");
                  return fixedPlayers;
                }
              };
              console.log("Debug helpers added to window.debugGame");
            }
            
            setInitialized(true);
          }, 500);
        }, 100);
      } else {
        console.log("Game already initialized, verifying player data...");
        
        // Check if current player is defined
        const currentPlayer = usePlayersStore.getState().getCurrentPlayer();
        if (!currentPlayer) {
          console.warn("⚠️ Current player is undefined despite initialized game!");
          
          // Try to fix by resetting player index
          if (players && players.length > 0) {
            usePlayersStore.getState().setCurrentPlayerIndex(0);
            console.log("Attempted to fix current player by resetting to index 0");
          }
        } else {
          console.log("Current player verified:", currentPlayer.name);
        }
        
        setInitialized(true);
      }
    }, 200); // Give time for stores to initialize
  }, [initialized]);
  
  return null; // This component doesn't render anything
}