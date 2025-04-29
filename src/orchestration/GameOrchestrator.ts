// src/orchestration/GameOrchestrator.ts

import { GameEngine } from '@/engine/GameEngine';
import { gameEvents } from '@/utils/eventBus';
import { logError } from '@/utils/logger';
import { GameState, GameAction, GameEvent, Player } from '@/types/gameTypes';
import { AI_TURN_DELAY_MS, PROPOSAL_TIMER_MS } from '@/data/constants';

/**
 * Responsible for coordinating game flow, handling timers,
 * and dispatching actions to the pure game engine.
 */
export class GameOrchestrator {
  private engine: GameEngine;
  private state: GameState;
  private timeouts: Map<string, number> = new Map();
  private timerIntervals: Map<string, number> = new Map();
  private clock: () => number;
  
  constructor(
    engine: GameEngine = new GameEngine(),
    initialState?: GameState,
    clock: () => number = Date.now
  ) {
    this.engine = engine;
    this.clock = clock;
    
    // Initialize with default state if none provided
    this.state = initialState || {
      players: [],
      floors: [],
      currentFloor: 0,
      currentPlayerIndex: -1,
      currentScore: 0,
      deck: [],
      gamePhase: 'title'
    };
  }
  
  /**
   * Dispatch an action to the game engine
   */
  dispatch(action: GameAction): void {
    logDebug(`Dispatching action: ${action.type}`, 'Orchestrator');
    
    try {
      // Process the action through the pure engine
      const { newState, events } = this.engine.handleAction(this.state, action);
      
      // Update our local state
      this.state = newState;
      
      // Process events
      events.forEach(event => {
        this.handleEvent(event);
        
        // Forward events to any listeners
        this.emitEvent(event);
      });
    } catch (error) {
      logError(
        `Error dispatching action: ${action.type}`,
        error instanceof Error ? error : new Error(String(error)),
        'Orchestrator'
      );
      
      // Emit error event
      gameEvents.emit('error:game', {
        message: error instanceof Error ? error.message : String(error),
        code: 'ACTION_ERROR'
      });
    }
  }
  
  /**
   * Handle game events and perform side effects
   */
  private handleEvent(event: GameEvent): void {
    switch (event.type) {
      case 'NEXT_TURN':
        this.handleNextTurn(event);
        break;
        
      case 'GAME_OVER':
        this.handleGameOver(event);
        break;
        
      // Add other event handlers as needed
    }
  }
  
  /**
   * Handle next turn event
   */
  private handleNextTurn(event: { type: 'NEXT_TURN'; playerId: string; isAI: boolean }): void {
    // Clear any existing turn timer
    this.clearTimeout('turn_timer');
    this.clearInterval('proposal_timer');
    
    // Start proposal timer
    if (this.state.gamePhase === 'playing') {
      this.startProposalTimer();
    }
    
    // Schedule AI turn if needed
    if (event.isAI) {
      this.scheduleAITurn(event.playerId);
    }
  }
  
  /**
   * Handle game over event
   */
  private handleGameOver(event: { type: 'GAME_OVER'; reason: string; winner: string; finalScore: number }): void {
    // Clear all timers
    this.cleanup();
    
    logDebug(`Game over: ${event.reason}, winner: ${event.winner}`, 'Orchestrator');
  }
  
  /**
   * Schedule AI turn
   */
  private scheduleAITurn(playerId: string): void {
    // Clear any existing AI turn timer
    this.clearTimeout('ai_turn');
    
    // Schedule new AI turn
    const timeoutId = window.setTimeout(() => {
      // Check if it's still AI's turn before proceeding
      if (
        this.state.gamePhase === 'playing' &&
        this.state.players[this.state.currentPlayerIndex]?.id === playerId
      ) {
        logDebug(`Executing scheduled AI turn for ${playerId}`, 'Orchestrator');
        this.triggerAIAction(playerId);
      } else {
        logDebug(`Skipping scheduled AI turn - game state changed`, 'Orchestrator');
      }
    }, AI_TURN_DELAY_MS);
    
    // Store timeout ID for cleanup
    this.timeouts.set('ai_turn', timeoutId);
  }
  
  /**
   * Start the proposal timer
   */
  private startProposalTimer(): void {
    let remainingTime = PROPOSAL_TIMER_MS;
    const startTime = this.clock();
    
    // Emit initial timer event
    gameEvents.emit('turn:timer', {
      remainingTime,
      isExpiring: false
    });
    
    // Set up interval to update timer
    const intervalId = window.setInterval(() => {
      const elapsed = this.clock() - startTime;
      remainingTime = Math.max(0, PROPOSAL_TIMER_MS - elapsed);
      
      // Emit timer update event
      gameEvents.emit('turn:timer', {
        remainingTime,
        isExpiring: remainingTime < 10000 // Consider "expiring" when less than 10 seconds
      });
      
      // Auto-pass if timer expires (for human players only)
      if (
        remainingTime === 0 &&
        this.state.gamePhase === 'playing' &&
        this.state.players[this.state.currentPlayerIndex]?.type !== 'AI'
      ) {
        logDebug('Proposal timer expired - auto-passing', 'Orchestrator');
        this.clearInterval('proposal_timer');
        
        // Dispatch auto-pass action
        const currentPlayerId = this.state.players[this.state.currentPlayerIndex]?.id;
        if (currentPlayerId) {
          this.dispatch({
            type: 'PASS_PROPOSAL',
            playerId: currentPlayerId
          });
        }
      }
    }, 1000); // Update every second
    
    // Store interval ID for cleanup
    this.timerIntervals.set('proposal_timer', intervalId);
  }
  
  /**
   * Trigger AI action based on current game state
   */
  private triggerAIAction(playerId: string): void {
    // Simple AI strategy - will be more sophisticated in real impl
    const player: Player | undefined = this.state.players.find(p => p.id === playerId);
    if (!player || player.hand.length === 0) return;
    
    const currentFloor = this.state.currentFloor;
    const isLeadPlayer = this.isLeadPlayer(playerId, currentFloor);
    
    // Check current floor state
    const floorState = this.state.floors.find((f) => f.floorNumber === currentFloor);
    
    interface Card {
      id: string;
      name: string;
    }
    
    interface Card {
      id: string;
      name: string;
    }
    if (!floorState) return;
    
    // Determine action based on game state
    if (isLeadPlayer && !floorState.proposalA && !floorState.proposalB) {
      // AI is lead player making initial proposal
      const cardToPlay = player.hand[0]; // Simplified - just use first card
      
      this.dispatch({
        type: 'PROPOSE_CARD',
        cardId: cardToPlay.id,
        playerId
      });
    } else if (!isLeadPlayer && ((floorState.proposalA && !floorState.proposalB) || (!floorState.proposalA && floorState.proposalB))) {
      // AI is responding to a proposal
      if (player.hand.length > 0) {
        // 50% chance to counter, 50% to accept
        if (Math.random() > 0.5) {
          const cardToPlay = player.hand[0];
          
          this.dispatch({
            type: 'COUNTER_PROPOSE',
            cardId: cardToPlay.id,
            playerId
          });
        } else {
          this.dispatch({
            type: 'ACCEPT_PROPOSAL',
            playerId
          });
        }
      } else {
        // No cards to counter with, must accept or pass
        this.dispatch({
          type: 'ACCEPT_PROPOSAL',
          playerId
        });
      }
    } else if (isLeadPlayer && floorState.proposalA && floorState.proposalB) {
      // AI is lead player responding to a counter
      // 70% chance to accept counter, 30% to pass (force mediation)
      if (Math.random() > 0.3) {
        this.dispatch({
          type: 'ACCEPT_PROPOSAL',
          playerId
        });
      } else {
        this.dispatch({
          type: 'PASS_PROPOSAL',
          playerId
        });
      }
    } else {
      // Default - just pass
      this.dispatch({
        type: 'PASS_PROPOSAL',
        playerId
      });
    }
  }
  
  /**
   * Check if a player is the lead player for a floor
   */
  private isLeadPlayer(playerId: string, floorNumber: number): boolean {
    // Simplified implementation - in a real app, you'd use your floor assignment logic
    const player = this.state.players.find(p => p.id === playerId);
    const isFloorInFirstGroup = floorNumber <= 5;
    
    return player?.isLeadPlayer === isFloorInFirstGroup;
  }
  
  /**
   * Map game engine events to event bus events
   */
  private emitEvent(event: GameEvent): void {
    switch (event.type) {
      case 'GAME_STARTED':
        gameEvents.emit('game:started', {
          humanRole: event.humanRole,
          aiRole: event.aiRole
        });
        break;
        
      case 'PROPOSAL_MADE':
        gameEvents.emit('proposal:made', {
          playerId: event.playerId,
          cardId: event.cardId,
          floor: event.floor
        });
        break;
        
      case 'COUNTER_MADE':
        gameEvents.emit('proposal:countered', {
          playerId: event.playerId,
          cardId: event.cardId,
          floor: event.floor
        });
        break;
        
      case 'PROPOSAL_ACCEPTED':
        gameEvents.emit('proposal:accepted', {
          playerId: event.acceptedBy,
          cardId: event.cardId,
          floor: event.floor
        });
        break;
        
      case 'PROPOSAL_PASSED':
        gameEvents.emit('proposal:passed', {
          playerId: event.passedBy,
          floor: event.floor
        });
        break;
        
      case 'FLOOR_FINALIZED':
        gameEvents.emit('floor:completed', {
          floor: event.floor,
          cardId: event.card?.id,
          committedBy: event.committedBy
        });
        break;
        
      case 'NEXT_TURN':
        gameEvents.emit('turn:changed', {
          playerId: event.playerId,
          isAI: event.isAI
        });
        break;
        
      case 'CARD_DRAWN':
        gameEvents.emit('card:drawn', {
          playerId: event.playerId,
          cardId: event.cardId,
          cardName: event.cardName
        });
        break;
        
      case 'RECALL_USED':
        gameEvents.emit('floor:recalled', {
          floor: event.floor,
          playerId: event.playerId
        });
        break;
        
      case 'GAME_OVER':
        gameEvents.emit('game:ended', {
          winner: event.winner,
          reason: event.reason,
          finalScore: event.finalScore
        });
        break;
        
      case 'ERROR':
        gameEvents.emit('error:game', {
          message: event.message,
          code: event.code
        });
        break;
    }
  }
  
  /**
   * Get the current game state (for debugging/testing)
   */
  getState(): GameState {
    return this.state;
  }
  
  /**
   * Clear a specific timeout
   */
  private clearTimeout(id: string): void {
    const timeoutId = this.timeouts.get(id);
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
      this.timeouts.delete(id);
    }
  }
  
  /**
   * Clear a specific interval
   */
  private clearInterval(id: string): void {
    const intervalId = this.timerIntervals.get(id);
    if (intervalId !== undefined) {
      window.clearInterval(intervalId);
      this.timerIntervals.delete(id);
    }
  }
  
  /**
   * Clean up all timeouts and intervals
   */
  cleanup(): void {
    // Clear all timeouts
    for (const [id, timeoutId] of this.timeouts.entries()) {
      window.clearTimeout(timeoutId);
      this.timeouts.delete(id);
    }
    
    // Clear all intervals
    for (const [id, intervalId] of this.timerIntervals.entries()) {
      window.clearInterval(intervalId);
      this.timerIntervals.delete(id);
    }
    
    logDebug('All orchestrator timers cleaned up', 'Orchestrator');
  }
}

// Create and export a singleton instance for global use
export const gameOrchestrator = new GameOrchestrator();

// Export a getter function for the orchestrator
export function getGameOrchestrator() {
  return gameOrchestrator;
}
/**
 * Log debug messages with a component prefix
 * @param message The message to log
 * @param component The component name for context
 */
function logDebug(message: string, component: string) {
  // Only log in development environment
  if (process.env.NODE_ENV === 'development') {
    console.log(`[${component}] ${message}`);
  }
}

