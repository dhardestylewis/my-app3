// src/logic/GameEngine.ts
// Refactored implementation incorporating fixes based on the fault-tree analysis.

import {
  GameState,
  GameEvent,
  GameActionResult,
  Player,
  FloorState as Floor, // Renamed import
  ValidationResult,
  CardData,           // Assuming CardData includes instanceId, id, name, netScoreImpact, requiresFloor etc.
  CardInstance,       // Explicitly using CardInstance if it differs significantly from CardData (e.g., has unique state) - Assuming CardData covers it for now.
  PlayerType,
  PlayerRole,
  GamePhase,
  FloorStatus,
  Committer
} from '@/data/types';

import {
  BALANCE_THRESHOLD,
  MAX_STORIES,
  RECALL_SCORE_PENALTY, // Note: Penalty application logic might need explicit addition if required.
  INITIAL_HAND_SIZE,    // Note: Hand/Deck management is primarily external to the engine state.
  INITIAL_RECALL_TOKENS,
  RECALL_MAX_FLOOR
} from '@/data/constants';

import { getCardDefinitionById, getCardDefinitions } from '@/data/deckData'; // May not be needed if engine doesn't manage deck content.
import { shuffle } from '@/utils/shuffle'; // May not be needed if engine doesn't shuffle deck.
import { logDebug, logError, logWarn, LogLevel } from '@/utils/logger'; // Added LogLevel for clarity if needed, ensure logger supports meta objects.

// Define specific Action Types used by the Engine (Consistent with fault-tree notes)
export type GameAction =
  | { type: 'START_GAME'; humanRole: PlayerRole; aiRole: PlayerRole; }
  | { type: 'RESET_GAME'; }
  // Using 'instanceId' consistently where a specific card instance is involved.
  | { type: 'PROPOSE_CARD'; playerId: string; instanceId: string; }
  | { type: 'COUNTER_PROPOSE'; playerId: string; instanceId: string; }
  | { type: 'ACCEPT_PROPOSAL'; playerId: string; }
  | { type: 'PASS_PROPOSAL'; playerId: string; }
  | { type: 'USE_RECALL'; playerId: string; floorNumber: number; }
  | { type: 'DRAW_CARD'; playerId: string; }; // Engine generates event, store handles logic.

/**
* Pure Game Engine with no side effects (like timers, UI updates, or direct store calls).
*
* Contains the core game rules and state transition logic.
* All public methods accept the current state and an action, returning the
* new state and a list of events describing what happened. It does not
* directly mutate the input state.
*/
export class GameEngine {

  /**
   * Creates the initial default state for the game.
   */
  createInitialState(): GameState {
      return {
          phase: GamePhase.Title, // Use correct enum (Bucket 4)
          players: undefined,      // Initialize as undefined, set during START_GAME
          floors: undefined,       // Initialize as undefined, set during START_GAME
          deck: [],                // Engine state doesn't track actual deck cards/instances.
          currentFloor: 0,         // Set during START_GAME
          currentPlayerIndex: -1,  // Set during START_GAME
          gameLog: ["Game Engine Initialized."], // Keep minimal log if needed, rely on external logger mainly.
          isAiTurn: false,         // Set during START_GAME
          // Removed redundant/derived fields (score calculated, phase used instead of gamePhase)
      };
  }

  /**
   * Handles any game action and returns the new state + events.
   * This is the main entry point for processing actions.
   */
  handleAction(state: GameState, action: GameAction): GameActionResult {
      // Using meta object for logging context (Bucket 1 & 9 fix)
      logDebug(`[GameEngine] Handling action: ${action.type}`, { action: action }, 'EngineAction');

      // Clone state *before* any potential modifications to ensure purity,
      // especially crucial if an error occurs during processing.
      const stateBeforeAction = this.cloneState(state);
      let result: GameActionResult = { newState: stateBeforeAction, events: [] }; // Default result pointing to the original state clone

      try {
          // Validate core state requirements for most actions (game started, players/floors exist)
          // START_GAME and RESET_GAME are exceptions.
          if (action.type !== 'START_GAME' && action.type !== 'RESET_GAME') {
               // Bucket 2 Fix: Guard against undefined players/floors before accessing them in handlers
              if (!stateBeforeAction.players || stateBeforeAction.players.length < 2) {
                   logError("[GameEngine] Invalid state: Players array is missing or incomplete.", { state: stateBeforeAction, action });
                   result.events.push({ type: 'ERROR', message: 'Internal Error: Invalid player state.', code: 'STATE_ERROR' });
                   return result; // Return state before action
              }
              if (!stateBeforeAction.floors || stateBeforeAction.floors.length !== MAX_STORIES) {
                  logError("[GameEngine] Invalid state: Floors array is missing or incomplete.", { state: stateBeforeAction, action });
                  result.events.push({ type: 'ERROR', message: 'Internal Error: Invalid floor state.', code: 'STATE_ERROR' });
                  return result; // Return state before action
              }
          }

          // Delegate to specific handlers
          switch (action.type) {
              case 'START_GAME':
                  result = this.handleStartGame(stateBeforeAction, action); break;
              case 'RESET_GAME':
                  result = this.handleResetGame(); break; // Doesn't need state
              case 'PROPOSE_CARD':
                  // Pass the guarded state
                  result = this.handleProposeCard(stateBeforeAction as Required<GameState>, action); break;
              case 'COUNTER_PROPOSE':
                  // Pass the guarded state
                  result = this.handleCounterPropose(stateBeforeAction as Required<GameState>, action); break;
              case 'ACCEPT_PROPOSAL':
                  // Pass the guarded state
                  result = this.handleAcceptProposal(stateBeforeAction as Required<GameState>, action); break;
              case 'PASS_PROPOSAL':
                  // Pass the guarded state
                  result = this.handlePassProposal(stateBeforeAction as Required<GameState>, action); break;
              case 'USE_RECALL':
                  // Pass the guarded state
                  result = this.handleUseRecall(stateBeforeAction as Required<GameState>, action); break;
              case 'DRAW_CARD':
                  // Pass the guarded state
                  result = this.handleDrawCard(stateBeforeAction as Required<GameState>, action); break;
              default:
                  // Exhaustiveness check: Ensures all action types are handled.
                  const unknownAction: never = action;
                  logError(`[GameEngine] Unknown action type received`, { unknownAction }, 'EngineAction');
                  result.events.push({
                      type: 'ERROR', message: `Unknown action type`, code: 'UNKNOWN_ACTION'
                  });
                  // Return the state before the unknown action
                  result.newState = stateBeforeAction;
          }
      } catch (error) {
          logError(`[GameEngine] Error handling action ${action.type}:`, { error, action, state: stateBeforeAction }, 'EngineAction');
          result.events.push({
              type: 'ERROR',
              message: `Critical error during ${action.type}: ${error instanceof Error ? error.message : String(error)}`,
              code: 'ACTION_ERROR'
          });
          // IMPORTANT: Return the state *before* the failed action attempt for safety.
          result.newState = stateBeforeAction;
      }

      logDebug(`[GameEngine] Action ${action.type} processing complete. Events emitted: ${result.events.length}`, undefined, 'EngineAction');
      return result;
  }

  // ========================================================
  // Private Handlers for Specific Actions
  // ========================================================

  // Action type includes aiRole (Bucket 8 fix)
  private handleStartGame(initialState: GameState, action: { type: 'START_GAME'; humanRole: PlayerRole; aiRole: PlayerRole }): GameActionResult {
      const events: GameEvent[] = [];
      // Always start from a fresh initial state structure, ignoring 'initialState' param
      const newState = this.createInitialState();
      newState.gameLog = ["Game Started."]; // Reset log specifically for new game

      // Create Players
      // Decide who is Player A ⇒ lead on floors 1‑5,11‑15,…
      const humanIsPlayerA = Math.random() < 0.5;

      const playerA = humanIsPlayerA
        ? this.createPlayerDefinition('human', PlayerType.Human, action.humanRole, /*isLead*/ true)
        : this.createPlayerDefinition('ai',    PlayerType.AI,    action.aiRole,    /*isLead*/ true);

      const playerB = humanIsPlayerA
        ? this.createPlayerDefinition('ai',    PlayerType.AI,    action.aiRole,    /*isLead*/ false)
        : this.createPlayerDefinition('human', PlayerType.Human, action.humanRole, /*isLead*/ false);

      // Bucket 2 Fix: Initialize players array correctly
      newState.players = [playerA, playerB]; // Player A always at index 0

      // Initialize Floors
      // Bucket 2 Fix: Initialize floors array correctly
      newState.floors = Array.from({ length: MAX_STORIES }, (_, i): Floor => ({
          floorNumber: i + 1,
          status: FloorStatus.Pending,
          proposalA: undefined,
          proposalB: undefined,
          winnerCard: undefined,
          committedBy: null,
          units: 1, // Default units
      }));

      // Set initial game state details
      newState.currentFloor = 1;
      newState.currentPlayerIndex = 0; // Player A (index 0) starts
      newState.phase = GamePhase.Playing; // Use correct enum (Bucket 4)
      newState.isAiTurn = newState.players[0].type === PlayerType.AI; // Based on Player A

      events.push({
          type: 'GAME_STARTED',
          humanRole: action.humanRole,
          aiRole: action.aiRole,
          playerAId: playerA.id,
          playerBId: playerB.id
      });
      // Bucket 3 Fix: Ensure TURN_STARTED event includes required fields
      events.push({
          type: 'TURN_STARTED',
          playerId: playerA.id, // Player A starts
          floor: newState.currentFloor, // Use 'floor' field name
          isAiTurn: newState.isAiTurn   // Include 'isAiTurn'
      });

      return { newState, events };
  }

  // Helper to create player structure (Engine state doesn't hold hand/deck instances)
  private createPlayerDefinition(
    id: string,
    type: PlayerType,
    role: PlayerRole,
    isLead: boolean,             // NEW
  ): Player {
    return {
      id,
      name: `${type === PlayerType.Human ? 'You' : 'AI'} (${role})`,
      type,
      role,
      hand: [],
      recallTokens: INITIAL_RECALL_TOKENS,
      isLeadPlayer: isLead,      // ✅ satisfies Player interface
    };
  }  

  private handleResetGame(): GameActionResult {
      // Return a completely new initial state
      const newState = this.createInitialState();
      return {
          newState,
          events: [{ type: 'GAME_RESET' }]
      };
  }

  // Use Required<GameState> because we guarded against undefined players/floors in handleAction
  private handleProposeCard(state: Required<GameState>, action: { type: 'PROPOSE_CARD'; instanceId: string; playerId: string }): GameActionResult {
      const events: GameEvent[] = [];
      const validation = this.validateSingleCardProposal(state, action);
      if (!validation.isValid) {
          events.push({ type: 'ERROR', message: validation.reason, code: 'INVALID_PROPOSAL' });
          return { newState: state, events }; // Return original state on validation fail
      }

      const newState = this.cloneState(state); // Clone *after* validation passes

      // Bucket 2 Fix: Use non-null assertion '!' as players array is guaranteed by Required<GameState>
      const playerIndex = this.findPlayerIndex(newState, action.playerId);
      // This check should be redundant due to validation, but belt-and-suspenders
      if (playerIndex === -1) {
          logError("[GameEngine] Player not found after validation passed.", { action, state }, 'EngineLogic');
          return { newState: state, events: [...events, { type: 'ERROR', message: 'Internal Error: Player consistency issue.', code: 'INTERNAL_ERROR' }] };
      }
      const player = newState.players![playerIndex];

      // --- Engine State vs. Store State ---
      // WARNING: Engine's `player.hand` might be out of sync with PlayerStore.
      // Validation ideally uses PlayerStore state. Action handling here assumes
      // the instanceId is valid and temporarily removes it from the engine's *copy*
      // of the hand state for internal consistency during this action's resolution.
      // The event emitted ('PROPOSAL_MADE') signals the PlayerStore to *actually* update its hand.
      const cardInstance = player.hand.find(card => card.instanceId === action.instanceId);
      if (!cardInstance) {
          // This indicates a state divergence or invalid action despite validation.
          logError(`[GameEngine] Card instance ${action.instanceId} not found in engine's hand state for player ${action.playerId} after validation. Potential state sync issue.`, { hand: player.hand, action, state }, 'EngineLogic');
          return { newState: state, events: [...events, { type: 'ERROR', message: `Internal Error: Card instance ${action.instanceId} state mismatch.`, code: 'STATE_INCONSISTENCY' }] };
      }
      const cardInstanceCopy = this.cloneState(cardInstance); // Clone card data

      // Update player's hand immutably in the newState
      newState.players![playerIndex] = {
          ...player,
          hand: player.hand.filter(c => c.instanceId !== action.instanceId) // Remove proposed card
      };
      // --- End Engine State vs. Store State ---

      // Bucket 2 Fix: Use non-null assertion '!' as floors array is guaranteed
      const floorIndex = newState.floors!.findIndex(f => f.floorNumber === newState.currentFloor);
      if (floorIndex === -1) { // Should not happen if currentFloor is valid
           logError("[GameEngine] Current floor not found.", { currentFloor: newState.currentFloor, action, state }, 'EngineLogic');
           return { newState: state, events: [...events, { type: 'ERROR', message: 'Internal Error: Floor consistency issue.', code: 'INTERNAL_ERROR' }] };
      }

      const isPlayerA = this.isPlayerA(newState, action.playerId);
      const proposalSlot = isPlayerA ? 'proposalA' : 'proposalB';

      // Update floor immutably
      const originalFloor = newState.floors![floorIndex];
      const updatedFloor: Floor = {
          ...originalFloor,
          [proposalSlot]: [cardInstanceCopy] // Proposal is array with one card
      };
      newState.floors = newState.floors!.map((f, idx) => idx === floorIndex ? updatedFloor : f);

      // Bucket 3 Fix: Ensure PROPOSAL_MADE includes required fields (cardName added for convenience)
      events.push({
          type: 'PROPOSAL_MADE',
          cardInstanceId: cardInstanceCopy.instanceId,
          playerId: action.playerId,
          floor: newState.currentFloor,
          cardId: cardInstanceCopy.id, // Add cardId for reference
          cardName: cardInstanceCopy.name // Add cardName for logging/display
      });

      // Switch turn to the responding player
      const responderId = this.getRespondingPlayerId(newState, newState.currentFloor);
      const responderIndex = this.findPlayerIndex(newState, responderId);
      if (responderIndex === -1) { // Should not happen
          logError("[GameEngine] Responder player not found.", { responderId, action, state }, 'EngineLogic');
          return { newState: state, events: [...events, { type: 'ERROR', message: 'Internal Error: Responder player lookup failed.', code: 'INTERNAL_ERROR' }] };
      }
      newState.currentPlayerIndex = responderIndex;
      newState.isAiTurn = newState.players![responderIndex].type === PlayerType.AI;

      // Bucket 3 Fix: Ensure TURN_STARTED includes required fields
      events.push({
          type: 'TURN_STARTED',
          playerId: responderId,
          floor: newState.currentFloor,
          isAiTurn: newState.isAiTurn
      });

      return { newState, events };
  }

  private handleCounterPropose(state: Required<GameState>, action: { type: 'COUNTER_PROPOSE'; instanceId: string; playerId: string }): GameActionResult {
      const events: GameEvent[] = [];
      const validation = this.validateSingleCardCounter(state, action);
      if (!validation.isValid) {
          events.push({ type: 'ERROR', message: validation.reason, code: 'INVALID_COUNTER' });
          return { newState: state, events };
      }

      const newState = this.cloneState(state);

      // Bucket 2 Fix: Use '!'
      const playerIndex = this.findPlayerIndex(newState, action.playerId);
      if (playerIndex === -1) {
           logError("[GameEngine] Player not found after validation passed.", { action, state }, 'EngineLogic');
           return { newState: state, events: [...events, { type: 'ERROR', message: 'Internal Error: Player consistency issue.', code: 'INTERNAL_ERROR' }] };
      }
      const player = newState.players![playerIndex];

      // --- Engine State vs. Store State --- (See warning in handleProposeCard)
      const cardInstance = player.hand.find(card => card.instanceId === action.instanceId);
      if (!cardInstance) {
          logError(`[GameEngine] Card instance ${action.instanceId} not found in engine's hand state for player ${action.playerId} after validation. Potential state sync issue.`, { hand: player.hand, action, state }, 'EngineLogic');
          return { newState: state, events: [...events, { type: 'ERROR', message: `Internal Error: Card instance ${action.instanceId} state mismatch.`, code: 'STATE_INCONSISTENCY' }] };
      }
      const cardInstanceCopy = this.cloneState(cardInstance);

      newState.players![playerIndex] = {
          ...player,
          hand: player.hand.filter(c => c.instanceId !== action.instanceId)
      };
      // --- End Engine State vs. Store State ---

      // Bucket 2 Fix: Use '!'
      const floorIndex = newState.floors!.findIndex(f => f.floorNumber === newState.currentFloor);
       if (floorIndex === -1) {
           logError("[GameEngine] Current floor not found.", { currentFloor: newState.currentFloor, action, state }, 'EngineLogic');
           return { newState: state, events: [...events, { type: 'ERROR', message: 'Internal Error: Floor consistency issue.', code: 'INTERNAL_ERROR' }] };
      }

      const isPlayerA = this.isPlayerA(newState, action.playerId);
      const proposalSlot = isPlayerA ? 'proposalA' : 'proposalB';

      // Update floor immutably
      const originalFloor = newState.floors![floorIndex];
      const updatedFloor: Floor = {
          ...originalFloor,
          [proposalSlot]: [cardInstanceCopy] // Set proposal as array with one card
      };
      newState.floors = newState.floors!.map((f, idx) => idx === floorIndex ? updatedFloor : f);

      // Bucket 3 Fix: Ensure COUNTER_MADE includes required fields (cardId, cardInstanceId, floor)
      events.push({
          type: 'COUNTER_MADE',
          playerId: action.playerId,
          cardId: cardInstanceCopy.id, // Use definition ID
          cardInstanceId: cardInstanceCopy.instanceId, // Use instance ID
          floor: newState.currentFloor,
          cardName: cardInstanceCopy.name // Add name for convenience
      });

      // Switch turn back to the lead player
      const leadId = this.getLeadPlayerId(newState, newState.currentFloor);
      const leadIndex = this.findPlayerIndex(newState, leadId);
       if (leadIndex === -1) { // Should not happen
          logError("[GameEngine] Lead player not found.", { leadId, action, state }, 'EngineLogic');
          return { newState: state, events: [...events, { type: 'ERROR', message: 'Internal Error: Lead player lookup failed.', code: 'INTERNAL_ERROR' }] };
      }
      newState.currentPlayerIndex = leadIndex;
      newState.isAiTurn = newState.players![leadIndex].type === PlayerType.AI;

      // Bucket 3 Fix: Ensure TURN_STARTED includes required fields
      events.push({
          type: 'TURN_STARTED',
          playerId: leadId,
          floor: newState.currentFloor,
          isAiTurn: newState.isAiTurn
      });

      return { newState, events };
  }

   private handleAcceptProposal(state: Required<GameState>, action: { type: 'ACCEPT_PROPOSAL'; playerId: string }): GameActionResult {
      const events: GameEvent[] = [];
      const validation = this.validateAcceptProposal(state, action);
      if (!validation.isValid) {
          events.push({ type: 'ERROR', message: validation.reason, code: 'INVALID_ACCEPTANCE' });
          return { newState: state, events };
      }

      const newState = this.cloneState(state);
      // Bucket 2 Fix: Use '!'
      const floorIndex = newState.floors!.findIndex(f => f.floorNumber === newState.currentFloor);
       if (floorIndex === -1) {
           logError("[GameEngine] Current floor not found.", { currentFloor: newState.currentFloor, action, state }, 'EngineLogic');
           return { newState: state, events: [...events, { type: 'ERROR', message: 'Internal Error: Floor consistency issue.', code: 'INTERNAL_ERROR' }] };
       }
      const floor = newState.floors![floorIndex];

      // Determine accepted card and committer
      const isCurrentPlayer_A = this.isPlayerA(newState, action.playerId);
      const proposalA = floor.proposalA?.[0]; // Get first card if exists
      const proposalB = floor.proposalB?.[0]; // Get first card if exists

      // Bucket 5 Fix: Declare hasProposalA/B using !!
      const hasProposalA = !!proposalA;
      const hasProposalB = !!proposalB;

      let acceptedCardInstance: CardData | undefined; // Use CardData as it holds the relevant info
      let committer: Committer | null = null;
      const leadId = this.getLeadPlayerId(newState, newState.currentFloor);
      const responderId = this.getRespondingPlayerId(newState, newState.currentFloor);

      // Logic: Who is acting (playerId) and what proposals exist?
      if (hasProposalA && hasProposalB) {
          // Counter-proposal exists. The current player MUST be the lead player (enforced by validation).
          // Lead player accepts the RESPONDER'S counter-proposal.
          if (action.playerId === leadId) {
               acceptedCardInstance = isCurrentPlayer_A ? proposalB : proposalA; // If A is lead, accepts B's; If B is lead, accepts A's
               committer = isCurrentPlayer_A ? Committer.PlayerB : Committer.PlayerA;
          } else {
               // Should be unreachable due to validation
               logError("[GameEngine] Accept error: Non-lead player action during counter-proposal phase.", { floor, action, state }, 'EngineLogic');
               events.push({ type: 'ERROR', message: 'Internal Error: Invalid accept state.', code: 'STATE_INCONSISTENCY' });
               return { newState: state, events };
          }
      } else if (hasProposalA && !hasProposalB) {
          // Only A proposed. Current player must be responder (B). Responder accepts A's proposal.
          if (action.playerId === responderId) {
              acceptedCardInstance = proposalA;
              committer = Committer.PlayerA;
          } else {
               // Should be unreachable due to validation
               logError("[GameEngine] Accept error: Invalid player accepted initial proposal A.", { floor, action, state }, 'EngineLogic');
               events.push({ type: 'ERROR', message: 'Internal Error: Invalid accept state.', code: 'STATE_INCONSISTENCY' });
               return { newState: state, events };
          }
      } else if (hasProposalB && !hasProposalA) {
           // Only B proposed. Current player must be responder (A). Responder accepts B's proposal.
           if (action.playerId === responderId) {
              acceptedCardInstance = proposalB;
              committer = Committer.PlayerB;
           } else {
                // Should be unreachable due to validation
                logError("[GameEngine] Accept error: Invalid player accepted initial proposal B.", { floor, action, state }, 'EngineLogic');
                events.push({ type: 'ERROR', message: 'Internal Error: Invalid accept state.', code: 'STATE_INCONSISTENCY' });
                return { newState: state, events };
           }
      }
      // else: No proposals exist - validation should prevent reaching here.

      if (!acceptedCardInstance || committer === null) {
          logError('[GameEngine] Internal Error: No valid proposal found to accept despite passing validation.', { floorState: floor, action, state }, 'EngineLogic');
          events.push({ type: 'ERROR', message: 'Internal Error: Cannot determine accepted proposal.', code: 'STATE_INCONSISTENCY' });
          return { newState: state, events };
      }

      const acceptedCardCopy = this.cloneState(acceptedCardInstance); // Clone for safety

      // Finalize floor state immutably
      const finalizedFloor: Floor = {
          ...floor,
          status: FloorStatus.Agreed,
          winnerCard: acceptedCardCopy,
          committedBy: committer,
          proposalA: undefined, // Clear proposals
          proposalB: undefined,
          units: acceptedCardCopy.units ?? floor.units // Update units based on card, fallback to original floor units
      };
      newState.floors = newState.floors!.map((f, idx) => idx === floorIndex ? finalizedFloor : f);

      // Bucket 3 Fix: Ensure PROPOSAL_ACCEPTED includes required fields (cardName added)
      events.push({
          type: 'PROPOSAL_ACCEPTED',
          cardInstanceId: acceptedCardCopy.instanceId,
          floor: newState.currentFloor,
          acceptedBy: action.playerId,
          committedBy: committer, // Add who committed the card
          cardId: acceptedCardCopy.id,
          cardName: acceptedCardCopy.name
      });

      // Bucket 3 Fix: Ensure FLOOR_FINALIZED includes required fields (card, committedBy, status)
      events.push({
          type: 'FLOOR_FINALIZED',
          floor: newState.currentFloor,
          card: acceptedCardCopy, // Event gets a copy
          committedBy: committer,
          status: FloorStatus.Agreed,
      });

      // Check game end & potentially advance using the new state
      return this.checkEndOrAdvance(newState, events);
  }


  private handlePassProposal(state: Required<GameState>, action: { type: 'PASS_PROPOSAL'; playerId: string }): GameActionResult {
      const events: GameEvent[] = [];
      const validation = this.validatePassProposal(state, action); // Basic validation (turn, phase)
      if (!validation.isValid) {
          events.push({ type: 'ERROR', message: validation.reason, code: 'INVALID_PASS' });
          return { newState: state, events };
      }

      const newState = this.cloneState(state);
      // Bucket 2 Fix: Use '!'
      const floorIndex = newState.floors!.findIndex(f => f.floorNumber === newState.currentFloor);
       if (floorIndex === -1) {
           logError("[GameEngine] Current floor not found.", { currentFloor: newState.currentFloor, action, state }, 'EngineLogic');
           return { newState: state, events: [...events, { type: 'ERROR', message: 'Internal Error: Floor consistency issue.', code: 'INTERNAL_ERROR' }] };
       }
      const floor = newState.floors![floorIndex];

      // Bucket 3 Fix: PROPOSAL_PASSED event (add passedBy if needed by consumers)
      events.push({ type: 'PROPOSAL_PASSED', floor: newState.currentFloor, passedBy: action.playerId });

      let finalStatus: FloorStatus;
      let finalCardInstance: CardData | undefined = undefined;
      let finalCommitter: Committer | null = null;

      const proposalA = floor.proposalA?.[0];
      const proposalB = floor.proposalB?.[0];
      // Bucket 5 Fix: Declare hasProposalA/B using !!
      const hasProposalA = !!proposalA;
      const hasProposalB = !!proposalB;
      const leadId = this.getLeadPlayerId(newState, newState.currentFloor);
      const responderId = this.getRespondingPlayerId(newState, newState.currentFloor);

      // Determine outcome based on who passed and what proposals exist
      if (hasProposalA && hasProposalB) {
          // Both proposed. Current player MUST be the lead (validation implies this - only lead acts after counter).
          // Lead player passed -> Mediation occurs.
          if (action.playerId === leadId) {
              // Calculate score *based on the current state before this floor*.
              // Need to ensure score calculation is accurate. Assuming calculateCurrentScore uses the passed floor array.
              const scoreBeforeThisFloor = this.calculateCurrentScore(newState.floors!, newState.currentFloor); // Exclude current floor for mediation calc
              finalCardInstance = this.mediateProposals(proposalA, proposalB, scoreBeforeThisFloor);
              finalCommitter = finalCardInstance === proposalA ? Committer.PlayerA : Committer.PlayerB;
              finalStatus = FloorStatus.Agreed; // Mediation results in agreement
              logDebug(`[GameEngine Pass] Mediation required on floor ${newState.currentFloor}. Score before: ${scoreBeforeThisFloor}. Winner: ${finalCardInstance.name} by ${finalCommitter}`, undefined, 'EngineLogic');
          } else {
              // Should be unreachable. Responder passing when counter exists is not a valid game flow state after proposal.
              logError("[GameEngine Pass] Error: Responder passed when both proposals existed.", { floorState: floor, action, state }, 'EngineLogic');
              events.push({ type: 'ERROR', message: 'Internal Error: Invalid pass state (responder passed on counter).', code: 'STATE_INCONSISTENCY' });
              return { newState: state, events };
          }
      } else if (hasProposalA && !hasProposalB) {
           // Only A proposed. Current player must be responder (B). Responder passed -> Auto-Accept A's proposal.
           if (action.playerId === responderId) {
               finalCardInstance = proposalA;
               finalCommitter = Committer.PlayerA;
               finalStatus = FloorStatus.Agreed;
               logDebug(`[GameEngine Pass] Responder (B) passed, auto-accepting Player A's proposal: ${finalCardInstance.name}`, undefined, 'EngineLogic');
          } else {
               // Should be unreachable.
               logError("[GameEngine Pass] Error: Invalid player passed on initial proposal A.", { floorState: floor, action, state }, 'EngineLogic');
               events.push({ type: 'ERROR', message: 'Internal Error: Invalid pass state.', code: 'STATE_INCONSISTENCY' });
               return { newState: state, events };
          }
      } else if (hasProposalB && !hasProposalA) {
          // Only B proposed. Current player must be responder (A). Responder passed -> Auto-Accept B's proposal.
           if (action.playerId === responderId) {
               finalCardInstance = proposalB;
               finalCommitter = Committer.PlayerB;
               finalStatus = FloorStatus.Agreed;
               logDebug(`[GameEngine Pass] Responder (A) passed, auto-accepting Player B's proposal: ${finalCardInstance.name}`, undefined, 'EngineLogic');
           } else {
               // Should be unreachable.
               logError("[GameEngine Pass] Error: Invalid player passed on initial proposal B.", { floorState: floor, action, state }, 'EngineLogic');
               events.push({ type: 'ERROR', message: 'Internal Error: Invalid pass state.', code: 'STATE_INCONSISTENCY' });
               return { newState: state, events };
          }
      } else {
          // No opponent proposal exists (either no proposals at all, or only own proposal).
          // Passing -> Skip Floor.
          finalCardInstance = undefined;
          finalCommitter = Committer.None; // Explicitly None
          finalStatus = FloorStatus.Skipped;
          logDebug(`[GameEngine Pass] Skipping floor ${newState.currentFloor} as player ${action.playerId} passed with no actionable opponent proposal.`, undefined, 'EngineLogic');
      }

      // Update floor state immutably
      const finalCardCopy = finalCardInstance ? this.cloneState(finalCardInstance) : undefined;
      const finalizedFloor: Floor = {
          ...floor,
          status: finalStatus,
          winnerCard: finalCardCopy,
          committedBy: finalCommitter,
          proposalA: undefined, // Clear proposals
          proposalB: undefined,
          units: finalCardCopy ? (finalCardCopy.units ?? floor.units) : floor.units // Use card units if agreed, else keep original (relevant for skipped?)
      };
      newState.floors = newState.floors!.map((f, idx) => idx === floorIndex ? finalizedFloor : f);

      // Bucket 3 Fix: Ensure FLOOR_FINALIZED includes required fields (card, committedBy, status)
      events.push({
          type: 'FLOOR_FINALIZED',
          floor: newState.currentFloor,
          card: finalCardCopy, // Use the copy (or undefined if skipped)
          committedBy: finalCommitter,
          status: finalStatus
      });

      // Check game end & potentially advance using the new state
      return this.checkEndOrAdvance(newState, events);
  }

  private handleUseRecall(state: Required<GameState>, action: { type: 'USE_RECALL'; floorNumber: number; playerId: string }): GameActionResult {
      const events: GameEvent[] = [];
      const validation = this.validateUseRecall(state, action);
      if (!validation.isValid) {
          events.push({ type: 'ERROR', message: validation.reason, code: 'INVALID_RECALL' });
          return { newState: state, events };
      }

      const newState = this.cloneState(state);

      // Bucket 2 Fix: Use '!'
      const playerIndex = this.findPlayerIndex(newState, action.playerId);
      if (playerIndex === -1) {
           logError("[GameEngine Recall] Player not found after validation.", { action, state }, 'EngineLogic');
           return { newState: state, events: [...events, { type: 'ERROR', message: 'Internal Error: Player consistency issue.', code: 'INTERNAL_ERROR' }] };
      }
      const player = newState.players![playerIndex];

      // Bucket 2 Fix: Use '!'
      const floorIndex = newState.floors!.findIndex(f => f.floorNumber === action.floorNumber);
       if (floorIndex === -1) {
           logError(`[GameEngine Recall] Floor ${action.floorNumber} not found.`, { action, state }, 'EngineLogic');
           return { newState: state, events: [...events, { type: 'ERROR', message: 'Internal Error: Floor consistency issue.', code: 'INTERNAL_ERROR' }] };
       }
      const floorToRecall = newState.floors![floorIndex];

      // Store previous state details for the event
      const recalledCardInstance = floorToRecall.winnerCard ? this.cloneState(floorToRecall.winnerCard) : undefined;
      const previousCommitter = floorToRecall.committedBy;
      const previousStatus = floorToRecall.status; // Should be 'Agreed' per validation

      // Apply costs/state changes immutably
      newState.players![playerIndex] = {
          ...player,
          recallTokens: player.recallTokens - 1
      };

      // Reset floor state immutably
      const reopenedFloor: Floor = {
          ...floorToRecall,
          status: FloorStatus.Reopened, // Mark as Reopened
          proposalA: undefined,
          proposalB: undefined,
          winnerCard: undefined,         // Clear winner details
          committedBy: null,
          // Units: 1 // Decide: Reset units to 1 or keep original card's units? Resetting to 1 seems safer.
          units: 1
      };
      newState.floors = newState.floors!.map((f, idx) => idx === floorIndex ? reopenedFloor : f);

      // Set current floor to the recalled floor
      newState.currentFloor = action.floorNumber;

      // Bucket 3 Fix: RECALL_USED event (consider adding more context if needed)
      events.push({
          type: 'RECALL_USED',
          floor: action.floorNumber,
          playerId: action.playerId,
          recalledCard: recalledCardInstance, // Pass the card data that was on the floor
          committedBy: previousCommitter ?? undefined // Pass previous committer
      });

      // Apply score penalty if defined and non-zero
      const penalty: number = RECALL_SCORE_PENALTY;
      if (penalty !== 0) {
           // Note: This score adjustment happens conceptually. The *actual* score state is likely
           // managed externally based on floor states. This event signals the adjustment.
           events.push({ type: 'SCORE_ADJUSTED', amount: -RECALL_SCORE_PENALTY, reason: 'Recall Penalty'});
           logDebug(`[GameEngine Recall] Applying score penalty of ${-RECALL_SCORE_PENALTY}`, undefined, 'EngineLogic');
      }

      // Set next turn: Lead player for the *recalled* floor gets the turn.
      const leadId = this.getLeadPlayerId(newState, action.floorNumber);
      const leadIndex = this.findPlayerIndex(newState, leadId);
      if (leadIndex === -1) {
          logError(`[GameEngine Recall] Lead player (${leadId}) not found for recalled floor ${action.floorNumber}`, { action, state }, 'EngineLogic');
          // This is critical, may need to halt or revert
          return { newState: state, events: [...events, { type: 'ERROR', message: 'Internal Error: Lead player lookup failed for recall.', code: 'INTERNAL_ERROR' }] };
      }
      newState.currentPlayerIndex = leadIndex;
      newState.isAiTurn = newState.players![leadIndex].type === PlayerType.AI;

      // Bucket 3 Fix: Ensure TURN_STARTED includes required fields
      events.push({
          type: 'TURN_STARTED',
          playerId: leadId,
          floor: newState.currentFloor, // Current floor is now the recalled floor
          isAiTurn: newState.isAiTurn
      });

      return { newState, events };
  }

   private handleDrawCard(state: Required<GameState>, action: { type: 'DRAW_CARD'; playerId: string }): GameActionResult {
      const events: GameEvent[] = [];
      const validation = this.validateDrawCard(state, action); // Basic turn/phase check
      if (!validation.isValid) {
          events.push({ type: 'ERROR', message: validation.reason, code: 'INVALID_DRAW' });
          return { newState: state, events };
      }

      // Engine does *not* modify deck or hand state directly.
      // It emits an event for the responsible store (e.g., PlayerStore, GameFlow) to handle.
      logDebug("[GameEngine] Generating DRAW_REQUESTED event for external handling.", { action }, 'EngineAction');

      // Bucket 3 Fix: Ensure DRAW_REQUESTED event shape is correct
      events.push({ type: 'DRAW_REQUESTED', playerId: action.playerId });

      // Return the state unchanged as the engine itself doesn't perform the draw.
      // Cloning ensures we don't accidentally return the original state reference if validation failed earlier.
      return { newState: this.cloneState(state), events };
  }


  // ========================================================
  // Private Validation Methods
  // ========================================================
  // These methods check if an action is *legal* given the current state.
  // They do NOT modify the state.

  // Use Required<GameState> as these are called after the guard in handleAction
  private validateSingleCardProposal(state: Required<GameState>, action: { type: 'PROPOSE_CARD'; instanceId: string; playerId: string }): ValidationResult {
      if (state.phase !== GamePhase.Playing) return { isValid: false, reason: 'Game not in Playing phase' };

      const playerIndex = this.findPlayerIndex(state, action.playerId);
      if (playerIndex === -1) return { isValid: false, reason: `Player ${action.playerId} not found` };
      if (state.currentPlayerIndex !== playerIndex) return { isValid: false, reason: "Not player's turn" };

      const player = state.players![playerIndex];
      // WARNING: Engine hand state check is unreliable. Real validation might need external state.
      const card = player.hand.find(c => c.instanceId === action.instanceId);
      if (!card) return { isValid: false, reason: `Card instance ${action.instanceId} not found in (engine's) hand state` };

      // Bucket 2 Fix: Use '!'
      const floor = state.floors!.find(f => f.floorNumber === state.currentFloor);
      if (!floor) return { isValid: false, reason: `Current floor ${state.currentFloor} not found` };
      if (floor.status !== FloorStatus.Pending && floor.status !== FloorStatus.Reopened) {
          return { isValid: false, reason: `Floor ${state.currentFloor} not open for proposals (Status: ${floor.status})` };
      }

      // Check if the acting player is the lead player for this floor
      const leadPlayerId = this.getLeadPlayerId(state, state.currentFloor);
      if (action.playerId !== leadPlayerId) return { isValid: false, reason: "Only the lead player can make the initial proposal" };

      // Check if *any* proposal slot is already filled (initial proposal requires both empty)
      if (floor.proposalA?.length || floor.proposalB?.length) {
          return { isValid: false, reason: "Cannot make initial proposal if any proposal already exists" };
      }

      // Check Floor Restrictions based on card data
      if (!this.checkFloorRestriction(card, state.currentFloor)) {
          const reqStr = card.requiresFloor?.map(String).join(', ') || 'Any';
          return { isValid: false, reason: `Card '${card.name}' cannot be played on floor ${state.currentFloor}. Requires: ${reqStr}` };
      }

      return { isValid: true, reason: "" };
  }

  private validateSingleCardCounter(state: Required<GameState>, action: { type: 'COUNTER_PROPOSE'; instanceId: string; playerId: string }): ValidationResult {
      if (state.phase !== GamePhase.Playing) return { isValid: false, reason: 'Game not in Playing phase' };

      const playerIndex = this.findPlayerIndex(state, action.playerId);
      if (playerIndex === -1) return { isValid: false, reason: `Player ${action.playerId} not found` };
      if (state.currentPlayerIndex !== playerIndex) return { isValid: false, reason: "Not player's turn" };

      const player = state.players![playerIndex];
      // WARNING: Engine hand state check is unreliable.
      const card = player.hand.find(c => c.instanceId === action.instanceId);
      if (!card) return { isValid: false, reason: `Card instance ${action.instanceId} not found in (engine's) hand state` };

      // Bucket 2 Fix: Use '!'
      const floor = state.floors!.find(f => f.floorNumber === state.currentFloor);
      if (!floor) return { isValid: false, reason: `Current floor ${state.currentFloor} not found` };
      if (floor.status !== FloorStatus.Pending && floor.status !== FloorStatus.Reopened) {
          return { isValid: false, reason: `Floor ${state.currentFloor} not open for proposals (Status: ${floor.status})` };
      }

      // Check if the acting player is the responder for this floor
      const responderId = this.getRespondingPlayerId(state, state.currentFloor);
      if (action.playerId !== responderId) return { isValid: false, reason: "Only the responding player can counter-propose" };

      // Check if the opponent (lead) has made a proposal AND this player (responder) hasn't countered yet
      const isPlayerA = this.isPlayerA(state, action.playerId); // True if current player (responder) is A
      const opponentHasProposed = (!isPlayerA && !!floor.proposalA?.length) || (isPlayerA && !!floor.proposalB?.length); // Opponent = Lead
      const selfHasProposed = (isPlayerA && !!floor.proposalA?.length) || (!isPlayerA && !!floor.proposalB?.length); // Self = Responder

      if (!opponentHasProposed) {
          return { isValid: false, reason: "No initial proposal exists to counter" };
      }
      if (selfHasProposed) {
          return { isValid: false, reason: "Cannot counter-propose again" };
      }

      // Check Floor Restrictions
      if (!this.checkFloorRestriction(card, state.currentFloor)) {
           const reqStr = card.requiresFloor?.map(String).join(', ') || 'Any';
           return { isValid: false, reason: `Card '${card.name}' cannot be played on floor ${state.currentFloor}. Requires: ${reqStr}` };
      }

      return { isValid: true, reason: "" };
  }

  private validateAcceptProposal(state: Required<GameState>, action: { type: 'ACCEPT_PROPOSAL'; playerId: string }): ValidationResult {
      if (state.phase !== GamePhase.Playing) return { isValid: false, reason: 'Game not in Playing phase' };
      const playerIndex = this.findPlayerIndex(state, action.playerId);
      if (playerIndex === -1) return { isValid: false, reason: `Player ${action.playerId} not found` };
      if (state.currentPlayerIndex !== playerIndex) return { isValid: false, reason: "Not player's turn" };

      // Bucket 2 Fix: Use '!'
      const floor = state.floors!.find(f => f.floorNumber === state.currentFloor);
      if (!floor) return { isValid: false, reason: `Current floor ${state.currentFloor} not found` };
      if (floor.status !== FloorStatus.Pending && floor.status !== FloorStatus.Reopened) {
          return { isValid: false, reason: `Floor ${state.currentFloor} not ready for acceptance (Status: ${floor.status})` };
      }

      // Bucket 5 Fix: Declare hasProposalA/B using !!
      const hasProposalA = !!floor.proposalA?.length;
      const hasProposalB = !!floor.proposalB?.length;
      const leadId = this.getLeadPlayerId(state, state.currentFloor);
      const responderId = this.getRespondingPlayerId(state, state.currentFloor);

      // Case 1: Counter-proposal exists (both have proposed). Only the lead player can accept/pass.
      if (hasProposalA && hasProposalB) {
          if (action.playerId === leadId) {
              return { isValid: true, reason: "" }; // Lead player deciding on counter-offer
          } else {
              return { isValid: false, reason: "Only the lead player can act on a counter-proposal" };
          }
      }
      // Case 2: Only initial proposal exists. Only the responder can accept/pass/counter.
      else if (hasProposalA !== hasProposalB) { // XOR: exactly one proposal exists
          if (action.playerId === responderId) {
              return { isValid: true, reason: "" }; // Responder acting on initial proposal
          } else {
              return { isValid: false, reason: "Only the responding player can act on the initial proposal" };
          }
      }
      // Case 3: No proposals exist. Cannot accept.
      else {
          return { isValid: false, reason: "No proposal exists to accept" };
      }
  }

  private validatePassProposal(state: Required<GameState>, action: { type: 'PASS_PROPOSAL'; playerId: string }): ValidationResult {
      if (state.phase !== GamePhase.Playing) return { isValid: false, reason: 'Game not in Playing phase' };
      const playerIndex = this.findPlayerIndex(state, action.playerId);
      if (playerIndex === -1) return { isValid: false, reason: `Player ${action.playerId} not found` };
      if (state.currentPlayerIndex !== playerIndex) return { isValid: false, reason: "Not player's turn" };

      // Bucket 2 Fix: Use '!'
      const floor = state.floors!.find(f => f.floorNumber === state.currentFloor);
       if (!floor) return { isValid: false, reason: `Current floor ${state.currentFloor} not found` };
      if (floor.status !== FloorStatus.Pending && floor.status !== FloorStatus.Reopened) {
           return { isValid: false, reason: `Cannot pass on floor ${state.currentFloor} (Status: ${floor.status})` };
       }

      // Passing is generally always allowed on your turn during negotiation.
      // Specific game rules might add constraints (e.g., cannot pass if hand is empty and must draw),
      // but basic validation passes here.
      return { isValid: true, reason: "" };
  }

  private validateUseRecall(state: Required<GameState>, action: { type: 'USE_RECALL'; floorNumber: number; playerId: string }): ValidationResult {
      if (state.phase !== GamePhase.Playing) return { isValid: false, reason: 'Game not in Playing phase' };

      const playerIndex = this.findPlayerIndex(state, action.playerId);
      if (playerIndex === -1) return { isValid: false, reason: `Player ${action.playerId} not found` };
      if (state.currentPlayerIndex !== playerIndex) return { isValid: false, reason: "Cannot recall when it's not your turn" };

      const player = state.players![playerIndex];
      if (player.recallTokens <= 0) return { isValid: false, reason: "No recall tokens remaining" };

      // Floor number must be valid and *strictly less than* the current lowest pending/reopened floor.
      // Cannot recall the current floor or floors above it.
      const lowestUnresolvedFloor = this.findLowestUnresolvedFloor(state);
      if (action.floorNumber < 1 || action.floorNumber >= lowestUnresolvedFloor) {
           return { isValid: false, reason: `Can only recall completed floors strictly below floor ${lowestUnresolvedFloor}` };
      }

      // Check recall floor limit constant
      if (RECALL_MAX_FLOOR !== undefined && action.floorNumber > RECALL_MAX_FLOOR) {
          // Allow recalling *up to* RECALL_MAX_FLOOR, but not above it.
          return { isValid: false, reason: `Cannot recall floor ${action.floorNumber} (limit: ${RECALL_MAX_FLOOR}).` };
      }

      // Bucket 2 Fix: Use '!'
      const floor = state.floors!.find(f => f.floorNumber === action.floorNumber);
      if (!floor) return { isValid: false, reason: `Target floor ${action.floorNumber} not found` };
      // Can only recall floors that were successfully completed ('Agreed').
      if (floor.status !== FloorStatus.Agreed) return { isValid: false, reason: `Cannot recall floor ${action.floorNumber} (Status: ${floor.status}, must be Agreed)` };

      return { isValid: true, reason: "" };
  }

   private validateDrawCard(state: Required<GameState>, action: { type: 'DRAW_CARD'; playerId: string }): ValidationResult {
      if (state.phase !== GamePhase.Playing) return { isValid: false, reason: 'Game not in Playing phase' };
      const playerIndex = this.findPlayerIndex(state, action.playerId);
      if (playerIndex === -1) return { isValid: false, reason: `Player ${action.playerId} not found` };
      if (state.currentPlayerIndex !== playerIndex) return { isValid: false, reason: "Not player's turn" };

      // Engine only validates basic turn/phase.
      // Actual validation (deck not empty, hand size limit) is external (PlayerStore/GameFlow).
      // The engine *allows* the request event to be generated.
      return { isValid: true, reason: "" };
  }


  // ========================================================
  // Private Helper Methods
  // ========================================================

  /** Checks game end conditions AFTER a floor is finalized, and advances floor or ends game. */
  private checkEndOrAdvance(state: Required<GameState>, currentEvents: GameEvent[]): GameActionResult {
      // Calculate score based *only* on finalized (Agreed) floors in the potentially updated state.
      const currentScore = this.calculateCurrentScore(state.floors!);
      const gameEndResult = this.checkGameEnd(state, currentScore);

      if (gameEndResult.isOver) {
          const finalState = this.cloneState(state); // Clone before final modification
          finalState.phase = GamePhase.GameOver;
          currentEvents.push({
              type: 'GAME_OVER',
              reason: gameEndResult.reason!,
              winner: gameEndResult.winner!,
              finalScore: currentScore // Include final calculated score
          });
          logDebug(`[GameEngine] Game Over detected. Reason: ${gameEndResult.reason}. Winner: ${gameEndResult.winner}. Score: ${currentScore}`, undefined, 'EngineFlow');
          return { newState: finalState, events: currentEvents };
      } else {
          // Game continues: Advance to the next floor that needs resolution.
          // Pass the *current potentially modified state* to advance function.
          logDebug(`[GameEngine] Floor ${state.currentFloor} finalized. Advancing turn...`, undefined, 'EngineFlow');
          const nextResult = this.advanceToNextFloor(state); // advanceToNextFloor handles cloning internally
          // Combine events from floor finalization + turn start
          const combinedEvents = [...currentEvents, ...nextResult.events];
          return { newState: nextResult.newState, events: combinedEvents };
      }
  }

  /** Finds the next unresolved floor, updates state, and sets the turn. */
  private advanceToNextFloor(currentState: Required<GameState>): GameActionResult {
      // Clone state to work on, ensuring the input state is not mutated.
      const newState = this.cloneState(currentState);
      const events: GameEvent[] = [];

      const nextFloorNumber = this.findLowestUnresolvedFloor(newState);

      // If nextFloorNumber is beyond MAX_STORIES, the game should have ended, but checkGameEnd said no.
      // This indicates a potential state inconsistency.
      if (nextFloorNumber > MAX_STORIES) {
          logError("[GameEngine Advance] No pending floors found, but checkGameEnd returned false. State inconsistency?", { state: newState }, 'EngineFlow');
          // Force Game Over as a safety measure.
          newState.phase = GamePhase.GameOver;
          const score = this.calculateCurrentScore(newState.floors!);
          const winner = this.determineWinner(score);
          events.push({ type: 'ERROR', code: 'STATE_INCONSISTENCY', message: 'Floor advancement error: No next floor found after completion.' });
          events.push({ type: 'GAME_OVER', reason: 'State Error during floor advance', winner: winner, finalScore: score });
          return { newState, events };
      }

      // Set the next floor as the current one
      newState.currentFloor = nextFloorNumber;

      // Determine lead player for the *new* current floor and set turn
      const leadId = this.getLeadPlayerId(newState, nextFloorNumber);
      const leadIndex = this.findPlayerIndex(newState, leadId);

      if (leadIndex === -1) {
          logError(`[GameEngine Advance] Critical: Could not find player index for lead player ID: ${leadId} on floor ${nextFloorNumber}.`, { players: newState.players, state: newState }, 'EngineFlow');
          // Force Game Over on critical error
          newState.phase = GamePhase.GameOver;
          const score = this.calculateCurrentScore(newState.floors!);
           events.push({ type: 'ERROR', code: 'PLAYER_NOT_FOUND', message: `Internal error: Lead player ${leadId} lookup failed during advance.` });
          events.push({ type: 'GAME_OVER', reason: 'State Error during turn assignment', winner: 'developer', finalScore: score }); // Assign winner arbitrarily or based on context
          return { newState, events };
      }

      newState.currentPlayerIndex = leadIndex;
      newState.isAiTurn = newState.players![leadIndex].type === PlayerType.AI;

      logDebug(`[GameEngine Advance] Advancing to Floor ${nextFloorNumber}. Turn: Player ${leadId} (${newState.isAiTurn ? 'AI' : 'Human'})`, undefined, 'EngineFlow');

      // Bucket 3 Fix: Ensure TURN_STARTED includes required fields
      events.push({
          type: 'TURN_STARTED',
          playerId: leadId,
          floor: nextFloorNumber,
          isAiTurn: newState.isAiTurn
      });

      return { newState, events }; // Return the modified new state + turn start event
  }

  /** Checks if a card's floor restrictions allow it to be played on the given floor number. */
  private checkFloorRestriction(card: CardData, floorNum: number): boolean {
      const requirements = card.requiresFloor;
      if (!requirements || requirements.length === 0) {
          return true; // No restrictions
      }
      return requirements.some(req => {
          if (typeof req === 'string') {
              // Handle string keywords
              if (req.toLowerCase() === 'ground') return floorNum === 1;
              if (req.toLowerCase() === 'roof') return floorNum === MAX_STORIES;
              if (req.toLowerCase() === 'odd') return floorNum % 2 !== 0;
              if (req.toLowerCase() === 'even') return floorNum % 2 === 0;
               if (req.toLowerCase() === 'non-roof') return floorNum !== MAX_STORIES;
              // Add more string rules as needed
               logWarn(`[GameEngine] Unknown string floor restriction '${req}' on card '${card.name}'. Treating as invalid.`, undefined, 'EngineRules');
              return false; // Unknown string requirement fails
          } else if (typeof req === 'number') {
              // Handle specific floor number
              return req === floorNum;
          }
          logWarn(`[GameEngine] Invalid type for floor restriction '${req}' on card '${card.name}'. Treating as invalid.`, undefined, 'EngineRules');
          return false; // Invalid type in requirements array
      });
  }

  /** Finds the lowest floor number that is still Pending or Reopened. */
  private findLowestUnresolvedFloor(state: Required<GameState>): number {
       // Bucket 2 Fix: Use '!'
      for (let i = 0; i < state.floors!.length; i++) {
          const floor = state.floors![i];
          if (floor.status === FloorStatus.Pending || floor.status === FloorStatus.Reopened) {
              return floor.floorNumber;
          }
      }
      // If no pending/reopened floors are found, return value > MAX_STORIES
      return MAX_STORIES + 1;
  }

  /** Calculates score purely from the finalized ('Agreed') floors array. Optionally excludes a floor. */
  private calculateCurrentScore(floors: Floor[], excludeFloorNumber?: number): number {
      return floors.reduce((score, floor) => {
          if (floor.floorNumber === excludeFloorNumber) {
              return score; // Skip excluded floor
          }
          if (floor.status === FloorStatus.Agreed && floor.winnerCard) {
              // Use netScoreImpact, default to 0 if undefined/null
              return score + (floor.winnerCard.netScoreImpact ?? 0);
          }
          // Add penalties for skipped floors? Not currently implemented.
          // Add penalties for recalled floors? Handled via SCORE_ADJUSTED event.
          return score;
      }, 0); // Start score at 0
  }

  /** Determines the winner in a mediation scenario based on minimizing score deviation from zero. */
  private mediateProposals(proposalA: CardData, proposalB: CardData, scoreBeforeFloor: number): CardData {
      // Default impact to 0 if not defined
      const impactA = proposalA.netScoreImpact ?? 0;
      const impactB = proposalB.netScoreImpact ?? 0;

      const scoreWithA = scoreBeforeFloor + impactA;
      const scoreWithB = scoreBeforeFloor + impactB;

      const absDevA = Math.abs(scoreWithA);
      const absDevB = Math.abs(scoreWithB);

      logDebug(`[GameEngine Mediation] Score=${scoreBeforeFloor}. A (${proposalA.name}, ${impactA}) -> ${scoreWithA} (Dev: ${absDevA}). B (${proposalB.name}, ${impactB}) -> ${scoreWithB} (Dev: ${absDevB})`, undefined, 'EngineRules');

      // Choose card resulting in score with smaller absolute value (closer to zero).
      // Tie-breaking: Favor proposal A (or implement other tie-break logic, e.g., lower impact card).
      if (absDevA <= absDevB) {
          return proposalA;
      } else {
          return proposalB;
      }
  }

  /** Determines the game winner based on the final score and threshold. */
  private determineWinner(finalScore: number): 'developer' | 'community' | 'balanced' {
      if (Math.abs(finalScore) <= BALANCE_THRESHOLD) {
          return 'balanced';
      }
      // Positive score -> Community wins; Negative score -> Developer wins
      return finalScore > 0 ? 'community' : 'developer';
  }

  /** Checks if the game has ended based on the current state and score. */
  private checkGameEnd(state: Required<GameState>, currentScore: number): { isOver: boolean; reason?: string; winner?: 'developer' | 'community' | 'balanced' } {

      // Condition 1: All floors are finalized (Agreed or Skipped).
      // Check if the 'lowest unresolved floor' is beyond the max number of stories.
      const lowestUnresolved = this.findLowestUnresolvedFloor(state);
      if (lowestUnresolved > MAX_STORIES) {
          const winner = this.determineWinner(currentScore);
          return { isOver: true, reason: `Building complete (${MAX_STORIES} floors resolved)`, winner };
      }

      // Condition 2: Impossible to finish? (e.g., deck empty, players cannot play/draw?)
      // This requires more complex state checks, likely involving deck/hand state managed externally.
      // if (this.checkImpossibleFinish(state)) {
      //     const winner = this.determineWinner(currentScore); // Or maybe based on who got stuck?
      //     return { isOver: true, reason: `Game stalled (e.g., deck empty, no valid moves)`, winner };
      // }

      // Condition 3: Score threshold breached irreversibly? (Advanced check)
      // Requires analyzing remaining cards/potential score swings.
      // if (this.checkScoreThresholdBreached(state, currentScore)) {
      //     const winner = this.determineWinner(currentScore);
      //     return { isOver: true, reason: `Score threshold irreversibly breached`, winner };
      // }


      return { isOver: false }; // Game continues
  }

  // --- Placeholder complex checks (require more state/logic) ---

  private checkImpossibleFinish(state: GameState): boolean {
      // Placeholder: Needs access to deck count, hand sizes, maybe card playability checks.
      // Example: return state.deck.length === 0 && state.players.every(p => p.hand.length === 0);
      return false;
  }

  private checkScoreThresholdBreached(state: GameState, currentScore: number): boolean {
      // Placeholder: Needs analysis of remaining cards in deck/hands.
      // const remainingCards = this.getAllRemainingCards(state);
      // const { maxPositiveImpact, maxNegativeImpact } = this.analyzeRemainingCards(remainingCards);
      // if (currentScore > 0 && currentScore + maxNegativeImpact > BALANCE_THRESHOLD) return true; // Community win certain
      // if (currentScore < 0 && currentScore + maxPositiveImpact < -BALANCE_THRESHOLD) return true; // Developer win certain
      return false;
  }

  private analyzeRemainingCards(cards: CardData[]): { maxPositiveImpact: number; maxNegativeImpact: number } {
      // Placeholder analysis
      let maxPos = 0;
      let maxNeg = 0;
      cards.forEach(card => {
          const impact = card.netScoreImpact ?? 0;
          if (impact > 0) maxPos += impact;
          if (impact < 0) maxNeg += impact;
      });
      return { maxPositiveImpact: maxPos, maxNegativeImpact: maxNeg };
  }

  private getAllRemainingCards(state: GameState): CardData[] {
       // Placeholder: Needs access to actual deck/hand state, likely from external stores.
      logWarn("[GameEngine] getAllRemainingCards called, but engine doesn't manage full deck/hand state.", undefined, 'EngineState');
      return [];
  }

  // --- Player Helpers ---

  /** Determines the lead player ID for a given floor number based on blocks of 5. */
  private getLeadPlayerId(state: Required<GameState>, floorNumber: number): string {
      // Bucket 2 Fix: Use '!' as players array is guaranteed.
      // Determine 0-indexed block number (floors 1-5 -> block 0, 6-10 -> block 1, etc.)
      const floorBlock = Math.floor((floorNumber - 1) / 5);
      // Player A (index 0) leads on even blocks (0, 2, ...), Player B (index 1) leads on odd blocks (1, 3, ...)
      const isPlayerALead = floorBlock % 2 === 0;

      // Player A is always index 0, Player B is index 1
      return isPlayerALead ? state.players![0].id : state.players![1].id;
  }

  /** Determines the responding player ID for a given floor number. */
  private getRespondingPlayerId(state: Required<GameState>, floorNumber: number): string {
      // Bucket 2 Fix: Use '!'
      const leadId = this.getLeadPlayerId(state, floorNumber);
      // Find the player whose ID is not the lead ID. Assumes exactly 2 players.
      const responder = state.players!.find(p => p.id !== leadId);
      if (!responder) {
          // This should be impossible with 2 players but handle defensively.
          logError("[GameEngine Helper] Could not find responder ID.", { leadId, players: state.players, floorNumber }, 'EngineLogic');
          // Fallback: return the ID that isn't the lead, assuming standard indices
          return state.players![0].id === leadId ? state.players![1].id : state.players![0].id;
      }
      return responder.id;
  }

  /** Checks if the given playerId corresponds to Player A (index 0). */
  private isPlayerA(state: Required<GameState>, playerId: string): boolean {
      // Bucket 2 Fix: Use '!'
      // Player A is always at index 0 by convention established in handleStartGame
      return state.players![0].id === playerId;
  }

  /** Finds the index of a player by their ID. Returns -1 if not found. */
  private findPlayerIndex(state: Required<GameState>, playerId: string): number {
      // Bucket 2 Fix: Use '!'
      return state.players!.findIndex(p => p.id === playerId);
  }

  /** Performs a deep clone of the state using JSON methods. Caution with complex types (Dates, Functions, Maps, Sets). */
  private cloneState<T>(state: T): T {
      if (state === null || state === undefined) {
          return state;
      }
      try {
          // Using structuredClone for a more robust deep copy if available (Node >= 17, modern browsers)
          // Fallback to JSON.stringify/parse if not.
          if (typeof structuredClone === 'function') {
              return structuredClone(state);
          } else {
               return JSON.parse(JSON.stringify(state));
          }
      } catch (e) {
          logError("[GameEngine] Failed to clone game state:", { error: e, state }, 'EngineUtil');
          // Throwing here might be too disruptive; depends on desired error handling.
          // Consider returning the original state or a default state if cloning is critical failure.
          // For now, re-throw to indicate a serious issue.
          throw new Error("Failed to clone game state, potential data corruption.");
      }
  }
}

// Optional: Export default instance if used as a singleton pattern across the app
// export const gameEngine = new GameEngine();