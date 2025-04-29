// hooks/useGameEffects.ts
import { useEffect, useState } from 'react';
import { 
  useGameFlowStore, 
  GamePhase 
} from '../stores/useGameFlowStore';
import { useAIStore } from '../stores/useAIStore';
import { usePlayersStore } from '../stores/usePlayersStore';
import { PROPOSAL_TIMER_MS } from '../data/constants';

/**
 * Hook that manages game side effects, including:
 * - AI turn processing
 * - Proposal timer countdown
 * - Game phase transitions
 */
export function useGameEffects() {
  // Access store states
  const gamePhase = useGameFlowStore(state => state.gamePhase);
  const isAiTurn = useGameFlowStore(state => state.isAiTurn);
  const aiPlayTurn = useAIStore(state => state.aiPlayTurn);
  const negotiationStartTime = useGameFlowStore(state => state.negotiationStartTime);
  const cardsBeingDealt = usePlayersStore(state => state.cardsBeingDealt);
  
  // Local state for timer management
  const [timer, setTimer] = useState<number>(PROPOSAL_TIMER_MS);
  
  // Initialize timer when game starts
  useEffect(() => {
    if (gamePhase === GamePhase.Playing && !cardsBeingDealt) {
      setTimer(PROPOSAL_TIMER_MS);
    }
  }, [gamePhase, cardsBeingDealt]);
  
  // AI turn effect
  useEffect(() => {
    let aiTurnTimeout: number | undefined;
    
    if (gamePhase === GamePhase.Playing && isAiTurn && !cardsBeingDealt) {
      // Add a small delay before AI plays to make it feel more natural
      aiTurnTimeout = window.setTimeout(() => {
        aiPlayTurn();
      }, 1000);
    }
    
    // Cleanup
    return () => {
      if (aiTurnTimeout) {
        window.clearTimeout(aiTurnTimeout);
      }
    };
  }, [isAiTurn, gamePhase, aiPlayTurn, cardsBeingDealt]);
  
  // Proposal timer effect
  useEffect(() => {
    let timerInterval: number | undefined;
    
    // Only start timer if:
    // 1. Game is in playing phase
    // 2. It's not AI's turn (or use negotiationStartTime to sync with game state)
    // 3. Initial card dealing is complete
    if (gamePhase === GamePhase.Playing && !isAiTurn && !cardsBeingDealt) {
      // Reset timer when negotiation starts
      if (negotiationStartTime) {
        setTimer(PROPOSAL_TIMER_MS);
      }
      
      // Start countdown
      timerInterval = window.setInterval(() => {
        setTimer(prevTimer => {
          if (prevTimer <= 0) {
            // Time's up - could trigger auto-pass or other action
            window.clearInterval(timerInterval);
            return 0;
          }
          return prevTimer - 1;
        });
      }, 1000);
    }
    
    // Cleanup
    return () => {
      if (timerInterval) {
        window.clearInterval(timerInterval);
      }
    };
  }, [gamePhase, isAiTurn, negotiationStartTime, cardsBeingDealt]);
  
  // Reset timer when turn changes
  useEffect(() => {
    if (negotiationStartTime && gamePhase === GamePhase.Playing) {
      setTimer(PROPOSAL_TIMER_MS);
    }
  }, [negotiationStartTime, gamePhase]);
  
  // Return values and functions that might be useful to components
  return {
    timer,
    resetTimer: () => setTimer(PROPOSAL_TIMER_MS),
    isTimerActive: timer > 0
  };
}