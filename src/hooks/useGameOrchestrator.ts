// src/hooks/useGameOrchestrator.ts

import { useEffect } from 'react';
import { logDebug } from '@/utils/logger';
import { gameOrchestrator } from '@/orchestration/GameOrchestrator';
import type { GameAction } from '@/types/gameTypes';

/**
 * Hook to access the game orchestrator
 */
export function useGameOrchestrator() {
  // Clean up the orchestrator when component unmounts
  useEffect(() => {
    return () => {
      gameOrchestrator.cleanup();
    };
  }, []);
  
  /**
   * Dispatch an action to the game orchestrator
   */
  const dispatch = (action: GameAction) => {
    logDebug(`Dispatching action from hook: ${action.type}`, 'GameHook');
    gameOrchestrator.dispatch(action);
  };
  
  /**
   * Start a new game
   */
  const startGame = (humanRole: 'developer' | 'community') => {
    dispatch({
      type: 'START_GAME',
      humanRole
    });
  };
  
  /**
   * Reset the game
   */
  const resetGame = () => {
    dispatch({
      type: 'RESET_GAME'
    });
  };
  
  /**
   * Player draws a card
   */
  const drawCard = (playerId: string) => {
    dispatch({
      type: 'DRAW_CARD',
      playerId
    });
  };
  
  /**
   * Player proposes a card
   */
  const proposeCard = (playerId: string, cardId: string) => {
    dispatch({
      type: 'PROPOSE_CARD',
      playerId,
      cardId
    });
  };
  
  /**
   * Player counter-proposes a card
   */
  const counterPropose = (playerId: string, cardId: string) => {
    dispatch({
      type: 'COUNTER_PROPOSE',
      playerId,
      cardId
    });
  };
  
  /**
   * Player accepts a proposal
   */
  const acceptProposal = (playerId: string) => {
    dispatch({
      type: 'ACCEPT_PROPOSAL',
      playerId
    });
  };
  
  /**
   * Player passes on a proposal
   */
  const passProposal = (playerId: string) => {
    dispatch({
      type: 'PASS_PROPOSAL',
      playerId
    });
  };
  
  /**
   * Player uses a recall token
   */
  const useRecallToken = (playerId: string, floorNumber: number) => {
    dispatch({
      type: 'USE_RECALL',
      playerId,
      floorNumber
    });
  };
  
  return {
    dispatch,
    startGame,
    resetGame,
    drawCard,
    proposeCard,
    counterPropose,
    acceptProposal,
    passProposal,
    useRecallToken,
    // Get the current game state (for UI rendering)
    getState: gameOrchestrator.getState.bind(gameOrchestrator)
  };
}