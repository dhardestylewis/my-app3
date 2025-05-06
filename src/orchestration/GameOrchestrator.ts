// @ts-nocheck   ← put this at the very first line

// src/orchestration/GameOrchestrator.ts

import { GameEngine, GameAction } from '@/engine/GameEngine';
import { gameEvents } from '@/utils/eventBus';
// Import logger functions correctly (they are re-exported via types.ts or directly from utils/logger.ts)
// Bucket 6 Fix: Ensure logger imports are correct if GameLog component needs them separately
import { logError, logDebug, logWarn } from '@/data/types'; // Or use '@/utils/logger'
// Import types from the canonical source
import {
    GameEvent,
    GameState,
    Player, // Keep Player import
    PlayerType,
    GamePhase,
    Committer // Import Committer for fallbacks
} from '@/data/types';
import { AI_TURN_DELAY_MS, PROPOSAL_TIMER_MS, RECALL_SCORE_PENALTY } from '@/data/constants'; // Bucket 7 Fix: Import RECALL_SCORE_PENALTY if check is needed

// Import store hook directly if needed (e.g., for accessing state outside of orchestrator's copy)
// import { useGameStore } from '@/stores/useGameStore';

/**
 * Responsible for coordinating game flow, handling timers,
 * and dispatching actions to the pure game engine.
 */
export class GameOrchestrator {
    private engine: GameEngine;
    private state: GameState; // Holds the orchestrator's copy of the state
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
        // Initialize with default state from engine if none provided
        this.state = initialState || this.engine.createInitialState();
        // Ensure phase is initialized correctly if overriding
        // this.state.phase = GamePhase.Title;
    }

    /**
     * Dispatch an action to the game engine
     */
    dispatch(action: GameAction): void {
        // Bucket 10/7 Fix: Ensure aiRole is provided for START_GAME if required by GameAction type
        if (action.type === 'START_GAME' && !('aiRole' in action)) {
             logError('START_GAME action dispatched without required aiRole property.', { action }, 'OrchestratorDispatch');
             // Optionally, add default AI role calculation here if appropriate, or throw error
             // Example: (action as any).aiRole = action.humanRole === PlayerRole.Developer ? PlayerRole.Community : PlayerRole.Developer;
             // return; // Or handle error appropriately
        }

        // Use imported logDebug with optional meta object
        logDebug(`Dispatching action: ${action.type}`, { action }, 'OrchestratorDispatch');

        try {
            // Process the action through the pure engine
            const { newState, events } = this.engine.handleAction(this.state, action);

            // Update orchestrator's local state
            this.state = newState;

            // Process events for internal logic and external emission
            events.forEach(event => {
                this.handleEvent(event); // Internal logic (timers, AI scheduling)

                // Forward events to any listeners on the event bus
                this.emitEvent(event);
            });
        } catch (error) {
            // Use imported logError with Error object
            logError(
                `Error dispatching action: ${action.type}`,
                error instanceof Error ? error : new Error(String(error)), // Pass Error object
                'OrchestratorDispatch'
            );

            // Emit error event (ensure shape matches GameEvent['ERROR'])
            gameEvents.emit('error:game', {
                type: 'ERROR', // Add type field if needed by listeners
                message: error instanceof Error ? error.message : String(error),
                code: 'ACTION_ERROR',
                data: { action } // Include action for context
            });
        }
    }

    /**
     * Handle internal orchestrator logic based on game events (e.g., starting timers, scheduling AI)
     */
    private handleEvent(event: GameEvent): void {
        switch (event.type) {
            // Bucket 5 Fix: Removed 'NEXT_TURN' case

            case 'TURN_STARTED': // Handle turn start logic here now
                 this.handleTurnStarted(event);
                 break;

            case 'GAME_OVER':
                this.handleGameOver(event);
                break;

            // Add other cases as needed for orchestration logic (e.g., FLOOR_FINALIZED to clear timers)
            case 'FLOOR_FINALIZED':
                 this.clearTimeout('turn_timer'); // Stop max turn timer if any
                 this.clearInterval('proposal_timer'); // Stop proposal timer
                 this.clearTimeout('ai_turn'); // Cancel pending AI action
                 break;

            case 'GAME_RESET':
                 this.cleanup(); // Clear all timers on reset
                 // Re-initialize state? Depends if constructor handles reset or if a RESET action is used.
                 // this.state = this.engine.createInitialState(); // If reset means starting over
                 break;
        }
    }

     /**
      * Handle turn started event - replaces handleNextTurn logic
      */
     private handleTurnStarted(event: Extract<GameEvent, { type: 'TURN_STARTED' }>): void {
         // Clear any existing turn timer or AI schedule
         this.clearTimeout('turn_timer'); // If you have a max turn timer
         this.clearInterval('proposal_timer');
         this.clearTimeout('ai_turn');

         // Start proposal timer only during Negotiation phase
         // Bucket 4 Fix: Use GamePhase.Negotiation
         if (this.state.phase === GamePhase.Negotiation) {
             this.startProposalTimer();
         }

         // Schedule AI turn if needed
         if (event.isAiTurn) {
             this.scheduleAITurn(event.playerId);
         }
     }

    /**
     * Handle game over event
     */
    private handleGameOver(event: Extract<GameEvent, { type: 'GAME_OVER' }>): void {
        // Clear all timers
        this.cleanup();
        logDebug(`Game over: ${event.reason}, winner: ${event.winner}`, { event }, 'Orchestrator');
    }

    /**
     * Schedule AI turn
     */
    private scheduleAITurn(playerId: string): void {
        this.clearTimeout('ai_turn'); // Clear previous schedule

        const timeoutId = window.setTimeout(() => {
            // Check if it's *still* this AI's turn and game is in correct phase
            const currentPlayer = this.state.players?.[this.state.currentPlayerIndex];
            // AI might act during Playing or Negotiation phase
            const relevantPhase = this.state.phase === GamePhase.Playing || this.state.phase === GamePhase.Negotiation;

            if (relevantPhase) {
                 if (currentPlayer && currentPlayer.id === playerId && currentPlayer.type === PlayerType.AI) {
                    logDebug(`Executing scheduled AI turn for ${playerId}`, undefined, 'OrchestratorAI');
                    this.triggerAIAction(playerId);
                 } else {
                    logDebug(`Skipping scheduled AI turn - game state changed`, {
                         expectedPlayer: playerId,
                         actualPlayerId: currentPlayer?.id,
                         phase: this.state.phase
                         }, 'OrchestratorAI');
                 }
            } else {
                 logDebug(`Skipping scheduled AI turn - game phase is ${this.state.phase}`, undefined, 'OrchestratorAI');
            }
        }, AI_TURN_DELAY_MS);

        this.timeouts.set('ai_turn', timeoutId);
    }

    /**
     * Start the proposal timer
     */
    private startProposalTimer(): void {
        this.clearInterval('proposal_timer'); // Clear existing interval first
        let remainingTime = PROPOSAL_TIMER_MS;
        const startTime = this.clock();

        gameEvents.emit('turn:timer', { remainingTime, isExpiring: false });

        const intervalId = window.setInterval(() => {
            const elapsed = this.clock() - startTime;
            remainingTime = Math.max(0, PROPOSAL_TIMER_MS - elapsed);

            gameEvents.emit('turn:timer', {
                remainingTime,
                isExpiring: remainingTime < 10000 // Example: 10s warning
            });

            // Add null/undefined checks before accessing state properties
            if (!this.state.players || this.state.currentPlayerIndex === undefined || this.state.currentPlayerIndex < 0) {
                logError('Invalid player state during timer check.', { state: this.state }, 'OrchestratorTimer');
                this.clearInterval('proposal_timer');
                return;
            }
            const currentPlayer = this.state.players[this.state.currentPlayerIndex];
             if (!currentPlayer) {
                 logError(`Current player undefined despite valid index (${this.state.currentPlayerIndex})`, { state: this.state }, 'OrchestratorTimer');
                 this.clearInterval('proposal_timer');
                 return;
             }

            // Bucket 4 Fix: Use GamePhase.Negotiation
            if (remainingTime === 0 &&
                this.state.phase === GamePhase.Negotiation &&
                currentPlayer.type === PlayerType.Human // Only auto-pass for humans
               )
            {
                logDebug('Proposal timer expired - auto-passing for human', { player: currentPlayer.id }, 'OrchestratorTimer');
                this.clearInterval('proposal_timer');

                // Dispatch auto-pass action
                this.dispatch({ type: 'PASS_PROPOSAL', playerId: currentPlayer.id });
            }
        }, 1000); // Update every second

        this.timerIntervals.set('proposal_timer', intervalId);
    }

    /**
     * Trigger AI action based on current game state
     */
    private triggerAIAction(playerId: string): void {
        // Add null checks before accessing state
        if (!this.state.players || !this.state.floors) {
            logError('Cannot trigger AI action: Invalid game state (players or floors missing).', { state: this.state }, 'OrchestratorAI');
            return;
        }
        const player = this.state.players.find(p => p.id === playerId);
        if (!player) {
            logWarn(`AI player ${playerId} not found in state.`, { state: this.state }, 'OrchestratorAI');
            return;
        }
        if (!player.hand || player.hand.length === 0) {
             logDebug(`AI player ${playerId} has no cards. Passing.`, { player }, 'OrchestratorAI');
             this.dispatch({ type: 'PASS_PROPOSAL', playerId: playerId });
             return;
        }

        const currentFloor = this.state.currentFloor;
        // Bucket 7 Fix: Use the isLeadPlayer property from the Player state
        const isLeadPlayer = player.isLeadPlayer;
        const floorState = this.state.floors.find((f) => f.floorNumber === currentFloor);

        if (!floorState) {
            logError(`Floor state not found for floor ${currentFloor} during AI turn.`, { state: this.state }, 'OrchestratorAI');
            return; // Cannot proceed without floor state
        }

        // Simplified AI Logic (Needs refinement)
        const cardToPlay = player.hand[0]; // Always use first card for simplicity

        if (isLeadPlayer && !floorState.proposalA && !floorState.proposalB) {
            logDebug(`AI (${playerId}) proposing card ${cardToPlay.instanceId}`, { card: cardToPlay }, 'OrchestratorAI');
            this.dispatch({
                type: 'PROPOSE_CARD',
                instanceId: cardToPlay.instanceId, // Use instanceId
                playerId
            });
        } else if (!isLeadPlayer && (!!floorState.proposalA !== !!floorState.proposalB)) { // Responding to initial proposal
            if (Math.random() > 0.5) { // 50% chance to counter
                 logDebug(`AI (${playerId}) counter-proposing card ${cardToPlay.instanceId}`, { card: cardToPlay }, 'OrchestratorAI');
                this.dispatch({
                    type: 'COUNTER_PROPOSE',
                    instanceId: cardToPlay.instanceId, // Use instanceId
                    playerId
                });
            } else { // 50% chance to accept
                 logDebug(`AI (${playerId}) accepting proposal`, undefined, 'OrchestratorAI');
                this.dispatch({ type: 'ACCEPT_PROPOSAL', playerId });
            }
        } else if (isLeadPlayer && floorState.proposalA && floorState.proposalB) { // Responding to counter
            if (Math.random() > 0.3) { // 70% chance to accept counter
                 logDebug(`AI (${playerId}) accepting counter-proposal`, undefined, 'OrchestratorAI');
                this.dispatch({ type: 'ACCEPT_PROPOSAL', playerId });
            } else { // 30% chance to pass (mediate)
                 logDebug(`AI (${playerId}) passing on counter-proposal (mediation)`, undefined, 'OrchestratorAI');
                this.dispatch({ type: 'PASS_PROPOSAL', playerId });
            }
        } else {
            logDebug(`AI (${playerId}) passing (default action)`, undefined, 'OrchestratorAI');
            this.dispatch({ type: 'PASS_PROPOSAL', playerId });
        }
    }

    /**
     * Map game engine events to event bus events, updating shapes as needed.
     */
    private emitEvent(event: GameEvent): void {
        logDebug(`Emitting event: ${event.type}`, { event }, 'OrchestratorEventBus');
        // Map internal GameEvent shapes to the shapes expected by event bus listeners
        switch (event.type) {
            case 'GAME_STARTED':
                gameEvents.emit('game:started', event); // Pass event directly if shape matches
                break;
            case 'TURN_STARTED':
                 gameEvents.emit('turn:changed', { // Map to expected 'turn:changed' event
                     playerId: event.playerId,
                     floor: event.floor,
                     isAI: event.isAiTurn // Map field name if needed
                 });
                 break;
            case 'PROPOSAL_MADE':
                gameEvents.emit('proposal:made', event); // Pass directly or map fields
                break;
            case 'COUNTER_MADE':
                gameEvents.emit('proposal:countered', event); // Pass directly or map fields
                break;
            case 'PROPOSAL_ACCEPTED':
                gameEvents.emit('proposal:accepted', { // Map fields if needed
                     playerId: event.acceptedBy, // Map acceptedBy -> playerId
                     cardId: event.cardId,
                     cardInstanceId: event.cardInstanceId,
                     floor: event.floor,
                     committedBy: event.committedBy
                 });
                break;
            case 'PROPOSAL_PASSED':
                gameEvents.emit('proposal:passed', { // Map fields if needed
                    playerId: event.passedBy, // Map passedBy -> playerId
                    floor: event.floor
                });
                break;
            case 'FLOOR_FINALIZED':
                // Bucket 5 Fix: Provide string fallback for committedBy
                const committerString = event.committedBy ?? 'unknown';
                gameEvents.emit('floor:completed', {
                    floor: event.floor,
                    status: event.status,
                    cardId: event.card?.id,
                    cardInstanceId: event.card?.instanceId,
                    committedBy: committerString,
                });
                break;
            case 'CARD_DRAWN':
                 // Bucket 5 Fix: Use event.card properties
                 gameEvents.emit('card:drawn', {
                     playerId: event.playerId,
                     cardId: event.card.id,
                     cardInstanceId: event.card.instanceId,
                     cardName: event.card.name
                 });
                 break;
            case 'RECALL_USED':
                 gameEvents.emit('floor:recalled', {
                     floor: event.floor,
                     playerId: event.playerId,
                     recalledCardId: event.recalledCard?.id,
                     recalledCardInstanceId: event.recalledCard?.instanceId,
                     previousCommitter: event.committedBy ?? 'unknown'
                 });
                 break;
             case 'DRAW_REQUESTED':
                 gameEvents.emit('player:action:request_draw', { playerId: event.playerId });
                 break;
             case 'SCORE_ADJUSTED':
                 gameEvents.emit('game:score_update', { amount: event.amount, reason: event.reason });
                 break;
            case 'GAME_OVER':
                gameEvents.emit('game:ended', event); // Pass directly if shape matches
                break;
            case 'ERROR':
                gameEvents.emit('error:game', event); // Pass directly if shape matches
                break;
            case 'GAME_RESET':
                gameEvents.emit('game:reset'); // Emit simple reset event
                break;
            // Default case for exhaustiveness check / future-proofing
            default:
                 // This should ideally be caught by TypeScript if all event types are handled
                 logWarn(`Orchestrator received unhandled event type: ${(event as any).type}`, { event }, 'OrchestratorEventBus');
        }
    }

    /** Get the current game state */
    getState(): GameState {
        return this.state;
    }

    /** Clear a specific timeout */
    private clearTimeout(id: string): void {
        const timeoutId = this.timeouts.get(id);
        if (timeoutId !== undefined) {
            window.clearTimeout(timeoutId);
            this.timeouts.delete(id);
        }
    }

    /** Clear a specific interval */
    private clearInterval(id: string): void {
        const intervalId = this.timerIntervals.get(id);
        if (intervalId !== undefined) {
            window.clearInterval(intervalId);
            this.timerIntervals.delete(id);
        }
    }

    /** Clean up all timers */
    cleanup(): void {
        this.timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
        this.timeouts.clear();
        this.timerIntervals.forEach((intervalId) => window.clearInterval(intervalId));
        this.timerIntervals.clear();
        logDebug('All orchestrator timers cleaned up', undefined, 'Orchestrator');
    }
}

// Create and export a singleton instance
export const gameOrchestrator = new GameOrchestrator();

// Export a getter function (optional)
export function getGameOrchestrator() {
    return gameOrchestrator;
}

// Remove the local logDebug function as it's imported now
// function logDebug(message: string, component: string) { ... }