'use client';

// src/components/GameBoard.tsx
import React, { useEffect } from 'react';
import { useGameFlowStore } from '@/stores/useGameFlowStore';
import { usePlayersStore } from '@/stores/usePlayersStore';
import { useAIStore } from '@/stores/useAIStore';
import { logDebug } from '@/utils/logger';
import { AI_TURN_DELAY_MS, PROPOSAL_TIMER_MS } from '@/data/constants';
import { GamePhase, PlayerType } from "@/data/types"

/**
 * Proper AI turn management with React useEffect
 * This moves timeout handling from the store to React's lifecycle
 */
function GameBoard() {
  // Only subscribe to the state we need
  const gamePhase = useGameFlowStore(state => state.gamePhase);
  const isAiTurn = useGameFlowStore(state => state.isAiTurn);
  const proposalTimer = useGameFlowStore(state => state.proposalTimer);
  
  // Get current player ID for dependencies
  const currentPlayerId = usePlayersStore(state => {
    const currentPlayerIndex = state.currentPlayerIndex;
    return state.players[currentPlayerIndex]?.id;
  });
  
  // AI Turn Effect
  useEffect(() => {
    let timeoutId: number | null = null;
    
    // Only schedule AI turn if we're playing and it's AI's turn
    if (gamePhase === GamePhase.Playing && isAiTurn) {
      logDebug(`Scheduling AI turn for player ${currentPlayerId}`, 'GameEffects');
      
      timeoutId = window.setTimeout(() => {
        // Double-check it's still AI's turn before triggering
        if (useGameFlowStore.getState().isAiTurn && 
            useGameFlowStore.getState().gamePhase === GamePhase.Playing) {
          logDebug(`Executing scheduled AI turn for player ${currentPlayerId}`, 'GameEffects');
          useAIStore.getState().aiPlayTurn();
        } else {
          logDebug(`Skipping scheduled AI turn - game state changed`, 'GameEffects');
        }
      }, AI_TURN_DELAY_MS);
    }
    
    // Cleanup function to cancel timeout if component unmounts or dependencies change
    return () => {
      if (timeoutId !== null) {
        logDebug(`Cleaning up AI turn timeout`, 'GameEffects');
        window.clearTimeout(timeoutId);
      }
    };
  }, [gamePhase, isAiTurn, currentPlayerId]);
  
  // Proposal Timer Effect - handles auto-pass when timer expires
  useEffect(() => {
    let timerTimeoutId: number | null = null;
    
    // Only start timer during gameplay when a timer value is set
    if (gamePhase === GamePhase.Playing && proposalTimer && proposalTimer > 0) {
      logDebug(`Starting proposal timer for ${proposalTimer}ms`, 'GameEffects');
      
      timerTimeoutId = window.setTimeout(() => {
        // Only auto-pass if we're still in the same game state
        if (useGameFlowStore.getState().gamePhase === GamePhase.Playing) {
          logDebug(`Proposal timer expired - auto-passing`, 'GameEffects');
          
          // For human players, automatically pass when timer expires
          // For AI, the AI store handles its own logic
          if (!useGameFlowStore.getState().isAiTurn) {
            useGameFlowStore.getState().passProposal();
          }
        }
      }, proposalTimer);
    }
    
    // Clean up timer
    return () => {
      if (timerTimeoutId !== null) {
        logDebug(`Cleaning up proposal timer`, 'GameEffects');
        window.clearTimeout(timerTimeoutId);
      }
    };
  }, [gamePhase, proposalTimer]);
  
  // Render the game based on current phase
  // ... existing render logic ...
  
  return (
    <div className="game-board">
      {/* Your existing game board UI */}
    </div>
  );
}

export default GameBoard;

