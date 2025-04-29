// src/stores/useGameFlowStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { CardData } from "@/data/types";
import { BALANCE_THRESHOLD, RECALL_SCORE_PENALTY, MAX_STORIES, PROPOSAL_TIMER_MS as PROPOSAL_TIMER, AI_TURN_DELAY_MS } from '@/data/constants';
import { usePlayersStore, PlayerRole, PlayerType } from './usePlayersStore';
import { useFloorStore, FloorStatus, Committer } from './useFloorStore';
import { useBuildingStore } from './useBuildingStore';
import { useTelemetryStore } from './useTelemetryStore';
import { useAIStore } from './useAIStore';
// Imports for logging and validation
import { logDebug, logError } from '@/utils/logger';
import { validationFailed, validateAll, validateGamePhase, validateNotDealing } from '@/utils/validation';

// Import the game engine
import { GameEngine } from '@/engine/GameEngine';

// Create a single instance of the engine to use throughout the store
const gameEngine = new GameEngine();

export enum GamePhase {
  Title = 'title',
  Playing = 'playing',
  GameOver = 'gameOver',
}

export interface GameWinResult {
  isOver: boolean;
  reason?: string;
  winner?: 'developer' | 'community' | 'balanced';
}

interface GameFlowStoreState {
  // State
  gamePhase: GamePhase;
  isAiTurn: boolean;
  gameLog: string[];
  gameOverReason: string | null;
  winnerMessage: string | null;
  negotiationStartTime: number | null;
  proposalTimer: number | null;

  // Actions
  startGame: (humanPlayerRole: PlayerRole) => void;
  resetGame: () => void;
  logAction: (message: string) => void;
  proposeCard: () => void;
  counterPropose: () => void;
  acceptProposal: () => void;
  passProposal: () => void;
  useRecallToken: (floorNumber: number) => void;
  advanceToNextFloor: () => void;
  mediateProposals: (floorNumber: number) => CardData | undefined;
  drawCard: () => void;
  toggleAiTurn: () => void;

  // Evaluation
  evaluateGameEnd: () => GameWinResult;
  determineWinner: (finalScore: number) => 'developer' | 'community' | 'balanced';
  checkImpossibleFinish: () => boolean;
  analyzeRemainingCards: (cards: CardData[]) => {
    maxPositiveImpact: number;
    maxNegativeImpact: number;
    topPositiveCards: CardData[];
    topNegativeCards: CardData[];
  };
}

export const useGameFlowStore = create<GameFlowStoreState>()(
  immer((set, get) => ({
    // State
    gamePhase: GamePhase.Title,
    isAiTurn: false,
    gameLog: ["Welcome to Urban Balance"],
    gameOverReason: null,
    winnerMessage: null,
    negotiationStartTime: null,
    proposalTimer: PROPOSAL_TIMER,

    // Actions
    startGame: (humanPlayerRole) => {
      logDebug(`Starting new game: Player selected ${humanPlayerRole} role`, 'GameFlow');
      logDebug(`Game initialization beginning`, 'GameFlow');

      // Reset all relevant stores
      const { initializePlayers, getCurrentPlayer } = usePlayersStore.getState();
      const { initializeFloors } = useFloorStore.getState();
      const { resetBuilding } = useBuildingStore.getState();
      const { resetTelemetry } = useTelemetryStore.getState();

      // Initialize stores
      initializePlayers(humanPlayerRole);
      initializeFloors();
      resetBuilding();
      resetTelemetry();

      // Get fresh state after initializations
      const currentPlayer = usePlayersStore.getState().getCurrentPlayer();
      const isAiTurn = currentPlayer?.type === PlayerType.AI;
      const aiRole = humanPlayerRole === PlayerRole.Developer ? PlayerRole.Community : PlayerRole.Developer;

      // Log initial game state info
      const startMessages = [
        `Game started. You: ${humanPlayerRole}. AI: ${aiRole}.`,
        `Starting score: ${useBuildingStore.getState().building.baselineScore} (city climate requirements).`,
        `You are Player ${currentPlayer?.isLeadPlayer ? 'A' : 'B'}. Player A leads floors 1-5, Player B leads floors 6-10, etc.`,
        `Each player has ${usePlayersStore.getState().players[0]?.recallTokens} recall tokens to reopen floors.`,
        `Goal: Keep final score within ±${BALANCE_THRESHOLD} for a balanced project.`,
        `--- Floor 1: ${currentPlayer?.name}'s Turn to Propose ---`
      ];
      startMessages.forEach(msg => logDebug(msg, 'GameFlow'));

      // Initialize game state
      set(state => {
        state.gamePhase = GamePhase.Playing;
        state.isAiTurn = isAiTurn;
        state.gameLog = startMessages;
        state.gameOverReason = null;
        state.winnerMessage = null;
        state.negotiationStartTime = Date.now();
        state.proposalTimer = PROPOSAL_TIMER;
      });

      // Trigger AI turn if AI starts
      if (isAiTurn) {
        logDebug(`AI starts the game. Preparing AI turn...`, 'GameFlow');
        setTimeout(() => {
          // Make sure we're still in playing state before triggering AI
          if (get().gamePhase === GamePhase.Playing && get().isAiTurn) {
            logDebug(`Triggering AI turn after startup delay`, 'GameFlow');
            useAIStore.getState().aiPlayTurn();
          }
        }, 1000);
      }
    },

    resetGame: () => {
      logDebug(`Game reset requested`, 'GameFlow');
      // Reset logger state if the clear method exists
      const telemetryState = useTelemetryStore.getState() as { clear?: () => void };
      if (typeof telemetryState.clear === 'function') {
        telemetryState.clear();
      }

      // Using proper immer pattern
      set(state => {
        state.gamePhase = GamePhase.Title;
        state.isAiTurn = false;
        state.gameLog = ["Welcome to Urban Balance"];
        state.gameOverReason = null;
        state.winnerMessage = null;
        state.negotiationStartTime = null;
        state.proposalTimer = null;
      });

      logDebug(`Game reset complete`, 'GameFlow');
    },

    logAction: (message) => {
      // Call the centralized logger
      logDebug(message, 'GameEvent');

      // Also update the local gameLog for backward compatibility
      set(state => {
        state.gameLog = [message, ...state.gameLog.slice(0, 49)];  // Keep last 50 messages
      });
    },

    drawCard: () => {
      // Only proceed if game is playing and it's not AI's turn
      if (get().gamePhase !== GamePhase.Playing || get().isAiTurn) {
        logDebug(`Draw card rejected: gamePhase=${get().gamePhase}, isAiTurn=${get().isAiTurn}`, 'GameFlow');
        return;
      }

      // Always get fresh state
      const playersState = usePlayersStore.getState();
      
      // Check if cards are still being dealt
      if (playersState.cardsBeingDealt) {
        get().logAction('Please wait for initial cards to be dealt.');
        logDebug(`Draw card rejected: Initial dealing in progress`, 'GameFlow');
        return;
      }

      const drawnCard = playersState.drawCard();
      const currentPlayer = playersState.getCurrentPlayer();

      if (drawnCard) {
        get().logAction(`${currentPlayer?.name} drew ${drawnCard.name}`);
        logDebug(`Card drawn successfully: ${drawnCard.id} by player ${currentPlayer?.id}`, 'GameFlow');
      } else {
        get().logAction('Cannot draw: deck is empty or hand is full.');
        logDebug(`Draw card failed: deck empty or hand full by player ${currentPlayer?.id}`, 'GameFlow');
      }
    },

    proposeCard: () => {
      // Step 1: Get FRESH state from stores (not stored in closure)
      const playersState = usePlayersStore.getState(); 
      const floorState = useFloorStore.getState();
      
      // Extract what we need from current state
      const selectedHandCardId = playersState.selectedHandCardId;
      const currentFloor = floorState.currentFloor;
      const { getCurrentPlayer, playCardFromHand, getLeadPlayer, currentPlayerIndex, cardsBeingDealt } = playersState;
      const { setProposal } = floorState;

      // Debug log current state
      logDebug(`proposeCard called: selectedHandCardId=${selectedHandCardId}, currentFloor=${currentFloor}, isAiTurn=${get().isAiTurn}`, 'GameFlow');

      // Improved validation to identify exact issues
      if (get().gamePhase !== GamePhase.Playing) {
        logDebug(`Propose card rejected: incorrect game phase ${get().gamePhase}`, 'GameFlow');
        return;
      }

      if (!selectedHandCardId) {
        logDebug(`Propose card rejected: no card selected`, 'GameFlow');
        return;
      }

      if (cardsBeingDealt) {
        logDebug(`Propose card rejected: cards are being dealt`, 'GameFlow');
        return;
      }

      const currentPlayer = getCurrentPlayer();
      if (!currentPlayer) {
        logDebug(`Propose card rejected: no current player found`, 'GameFlow');
        return;
      }

      const leadPlayer = getLeadPlayer(currentFloor);
      if (!leadPlayer) {
        logDebug(`Propose card rejected: no lead player identified for floor ${currentFloor}`, 'GameFlow');
        return;
      }

      if (currentPlayer.id !== leadPlayer.id) {
        logDebug(`Propose card rejected: current player ${currentPlayer.id} is not lead player ${leadPlayer.id}`, 'GameFlow');
        return;
      }

      // Check if the card exists in the player's hand
      const cardExists = currentPlayer.hand.some(card => card.id === selectedHandCardId);
      if (!cardExists) {
        logDebug(`Propose card rejected: selected card ${selectedHandCardId} not found in player's hand`, 'GameFlow');
        return;
      }

      // Step 2: First get the card data BEFORE removing it from hand
      // This ensures we have a proper card object that won't be revoked
      const isPlayerA = playersState.isPlayerA(currentPlayer);
      
      // Create a shallow copy of the card object to avoid revoked proxy issues
      // (This is critical for fixing the error!)
      const cardToPlay = {...currentPlayer.hand.find(card => card.id === selectedHandCardId)!};
      
      if (!cardToPlay) {
        logDebug(`Propose card rejected: failed to find card ${selectedHandCardId} in hand`, 'GameFlow');
        return;
      }
      
      // Step 3: AFTER we have a safe copy, now remove it from the hand
      const playedCard = playCardFromHand(currentPlayerIndex, selectedHandCardId);

      if (!playedCard) {
        logDebug(`Propose card rejected: failed to play card ${selectedHandCardId} from hand`, 'GameFlow');
        return;
      }

      // Step 4: Update floor state with our copy to avoid proxy issues
      setProposal(isPlayerA, cardToPlay);

      // Verify proposal was set correctly
      const verifyFloorState = useFloorStore.getState().getCurrentFloorState();
      const proposalSet = isPlayerA ? verifyFloorState?.proposalA : verifyFloorState?.proposalB;

      if (!proposalSet) {
        logDebug(`Warning: Proposal may not have been set correctly. Attempted to set ${isPlayerA ? 'proposalA' : 'proposalB'} but verification failed.`, 'GameFlow');
      } else {
        logDebug(`Proposal verification successful: ${proposalSet.name} set as ${isPlayerA ? 'proposalA' : 'proposalB'}`, 'GameFlow');
      }

      // Log the action
      get().logAction(
        `${currentPlayer.name} proposes ${playedCard.name} for floor ${currentFloor}.`
      );
      logDebug(`Card proposed: player=${currentPlayer.id}, card=${playedCard.id}, isPlayerA=${isPlayerA}, floor=${currentFloor}`, 'GameFlow');

      // Step 5: Switch to responding player
      // Always get fresh state again
      const respondingPlayer = usePlayersStore.getState().getRespondingPlayer(currentFloor);
      if (!respondingPlayer) {
        logDebug(`Error: No responding player found for floor ${currentFloor}`, 'GameFlow');
        return;
      }

      const nextPlayerIndex = usePlayersStore.getState().players.findIndex(
        p => p.id === respondingPlayer.id
      );

      usePlayersStore.getState().setCurrentPlayerIndex(nextPlayerIndex);
      usePlayersStore.getState().selectHandCard(null); // Clear selection

      set(state => {
        state.isAiTurn = respondingPlayer.type === PlayerType.AI;
        state.negotiationStartTime = Date.now();
        state.proposalTimer = PROPOSAL_TIMER; // Reset timer when switching turns
      });

      get().logAction(`${respondingPlayer.name} to accept, counter, or pass.`);
      logDebug(`Turn passed to responding player: player=${respondingPlayer.id}, isAI=${respondingPlayer.type === PlayerType.AI}`, 'GameFlow');

      // Increased delay for AI turn to ensure UI updates properly
      if (respondingPlayer.type === PlayerType.AI) {
        logDebug(`AI turn required. Scheduling AI response with increased delay...`, 'GameFlow');
        setTimeout(() => {
          // Safety check - make sure we're still in playing state
          if (get().gamePhase === GamePhase.Playing && get().isAiTurn) {
            logDebug(`Triggering scheduled AI turn for response`, 'GameFlow');
            useAIStore.getState().aiPlayTurn();
          }
        }, 1500); // Increased from 1000ms to 1500ms for better UI sync
      }
    },

    counterPropose: () => {
      // Always get fresh state instead of capturing in closure
      const playersState = usePlayersStore.getState();
      const floorState = useFloorStore.getState();
      
      const {
        currentPlayerIndex,
        selectedCounterCardId,
        getCurrentPlayer,
        playCardFromHand,
        getRespondingPlayer,
        cardsBeingDealt
      } = playersState;

      const { currentFloor, setProposal } = floorState;

      // Debug logging
      logDebug(`counterPropose called: selectedCounterCardId=${selectedCounterCardId}, currentFloor=${currentFloor}, isAiTurn=${get().isAiTurn}`, 'GameFlow');

      // Validation
      const currentPlayer = getCurrentPlayer();
      const respondingPlayer = getRespondingPlayer(currentFloor);
      
      if (get().gamePhase !== GamePhase.Playing || 
          get().isAiTurn || 
          !selectedCounterCardId || 
          cardsBeingDealt || 
          !currentPlayer || 
          currentPlayer.id !== respondingPlayer?.id) {
        logDebug(`Counter-propose rejected: validation failed (phase=${get().gamePhase}, isAiTurn=${get().isAiTurn}, cardSelected=${!!selectedCounterCardId}, dealing=${cardsBeingDealt}, isResponder=${currentPlayer?.id === respondingPlayer?.id})`, 'GameFlow');
        return;
      }

      // Create a safe copy of the card before removing it from hand
      const cardToPlay = {...currentPlayer.hand.find(card => card.id === selectedCounterCardId)!};
      
      if (!cardToPlay) {
        logDebug(`Counter-propose rejected: failed to find card ${selectedCounterCardId} in hand`, 'GameFlow');
        return;
      }
      
      const isPlayerA = playersState.isPlayerA(currentPlayer);
      const playedCard = playCardFromHand(currentPlayerIndex, selectedCounterCardId);

      if (!playedCard) {
        logDebug(`Counter-propose rejected: card ${selectedCounterCardId} not found in hand for player ${currentPlayer.id}`, 'GameFlow');
        return;
      }

      // Update floor state with counter-proposal (using our safe copy)
      setProposal(isPlayerA, cardToPlay);

      // Log the action
      get().logAction(
        `${currentPlayer.name} counter-proposes ${playedCard.name} for floor ${currentFloor}.`
      );
      logDebug(`Counter-proposal made: player=${currentPlayer.id}, card=${playedCard.id}, isPlayerA=${isPlayerA}, floor=${currentFloor}`, 'GameFlow');

      // Switch back to lead player - get fresh state again
      const leadPlayer = usePlayersStore.getState().getLeadPlayer(currentFloor);
      if (!leadPlayer) {
        logDebug(`Error: No lead player found for floor ${currentFloor}`, 'GameFlow');
        return;
      }

      const nextPlayerIndex = usePlayersStore.getState().players.findIndex(
        p => p.id === leadPlayer.id
      );

      usePlayersStore.getState().setCurrentPlayerIndex(nextPlayerIndex);
      usePlayersStore.getState().selectCounterCard(null); // Clear selection

      set(state => {
        state.isAiTurn = leadPlayer.type === PlayerType.AI;
        state.negotiationStartTime = Date.now();
        state.proposalTimer = PROPOSAL_TIMER; // Reset timer when switching turns
      });

      get().logAction(`${leadPlayer.name} to accept counter-offer or let AI mediate.`);
      logDebug(`Turn passed back to lead player: player=${leadPlayer.id}, isAI=${leadPlayer.type === PlayerType.AI}`, 'GameFlow');

      // Trigger AI turn if needed
      if (leadPlayer.type === PlayerType.AI) {
        logDebug(`AI turn required for counter-response. Scheduling AI action...`, 'GameFlow');
        setTimeout(() => {
          // Safety check - make sure we're still in playing state
          if (get().gamePhase === GamePhase.Playing && get().isAiTurn) {
            logDebug(`Triggering scheduled AI turn for counter-response`, 'GameFlow');
            useAIStore.getState().aiPlayTurn();
          }
        }, 1000);
      }
    },

    acceptProposal: () => {
      // Always get fresh state
      const playersState = usePlayersStore.getState();
      const floorState = useFloorStore.getState();
      
      const {
        getCurrentPlayer,
        isPlayerA,
        cardsBeingDealt
      } = playersState;

      const {
        currentFloor,
        getCurrentFloorState,
        finalizeFloor
      } = floorState;

      logDebug(`acceptProposal called: currentFloor=${currentFloor}, isAiTurn=${get().isAiTurn}`, 'GameFlow');

      // Validation
      if (get().gamePhase !== GamePhase.Playing || get().isAiTurn || cardsBeingDealt) {
        logDebug(`Accept proposal rejected: validation failed (phase=${get().gamePhase}, isAiTurn=${get().isAiTurn}, dealing=${cardsBeingDealt})`, 'GameFlow');
        return;
      }

      const currentPlayer = getCurrentPlayer();
      if (!currentPlayer) {
        logDebug(`Accept proposal rejected: no current player`, 'GameFlow');
        return;
      }

      const floorStateObj = getCurrentFloorState();
      if (!floorStateObj) {
        logDebug(`Accept proposal rejected: no current floor state`, 'GameFlow');
        return;
      }

      const isLeadPlayer = currentPlayer.id === usePlayersStore.getState().getLeadPlayer(currentFloor)?.id;
      const isAcceptingCounter = isLeadPlayer && !!floorStateObj.proposalA && !!floorStateObj.proposalB;

      // Log decision context
      logDebug(`Player accepting: player=${currentPlayer.id}, isLeadPlayer=${isLeadPlayer}, isAcceptingCounter=${isAcceptingCounter}`, 'GameFlow');

      // Determine which proposal is being accepted (and make a safe copy)
      let acceptedProposal: CardData;
      
      if (isAcceptingCounter) {
        // Lead accepting responder's counter proposal
        acceptedProposal = isPlayerA(currentPlayer) ? 
          {...floorStateObj.proposalB!} as CardData : 
          {...floorStateObj.proposalA!} as CardData;
      } else {
        // Responder accepting initial proposal
        acceptedProposal = isPlayerA(currentPlayer) ? 
          {...floorStateObj.proposalA!} as CardData : 
          {...floorStateObj.proposalB!} as CardData;
      }

      if (!acceptedProposal) {
        logDebug(`Accept proposal rejected: no proposal found to accept (acceptingCounter=${isAcceptingCounter}, proposalA=${!!floorStateObj.proposalA}, proposalB=${!!floorStateObj.proposalB})`, 'GameFlow');
        return;
      }

      // Determine who committed based on who accepted what
      const committedBy = isAcceptingCounter
        ? (isPlayerA(currentPlayer) ? Committer.PlayerB : Committer.PlayerA) // Lead accepts responder's card
        : (isPlayerA(currentPlayer) ? Committer.PlayerA : Committer.PlayerB); // Responder accepts lead's card

      // Log the action
      get().logAction(
        `${currentPlayer.name} accepted ${acceptedProposal.name} for floor ${currentFloor}.`
      );
      logDebug(`Proposal accepted: player=${currentPlayer.id}, card=${acceptedProposal.id}, committedBy=${committedBy}, floor=${currentFloor}`, 'GameFlow');

      // Finalize the floor
      finalizeFloor(
        currentFloor,
        FloorStatus.Agreed,
        acceptedProposal,  // Using our safe copy
        committedBy
      );

      // Record end of negotiation time for telemetry
      if (get().negotiationStartTime) {
        const endTime = Date.now();
        const negotiationTime = Math.round((endTime - get().negotiationStartTime!) / 1000);
        useTelemetryStore.getState().recordNegotiationTime(currentFloor, negotiationTime);
        logDebug(`Negotiation completed in ${negotiationTime}s`, 'GameFlow');
      }

      // Check for game end conditions
      const gameEndResult = get().evaluateGameEnd();
      if (gameEndResult.isOver) {
        logDebug(`Game over: ${gameEndResult.reason}. Winner: ${gameEndResult.winner}`, 'GameFlow');
        logDebug(`Game ending: reason=${gameEndResult.reason}, winner=${gameEndResult.winner}`, 'GameFlow');

        // Using proper immer pattern
        set(state => {
          state.gamePhase = GamePhase.GameOver;
          state.gameOverReason = gameEndResult.reason || "Game over";
          state.winnerMessage = gameEndResult.winner === 'balanced'
            ? 'Project BALANCED'
            : `Project FAVORS ${gameEndResult.winner?.toUpperCase()}`;
        });

        // Record the win in telemetry
        if (gameEndResult.winner) {
          useTelemetryStore.getState().recordWin(gameEndResult.winner);
        }

        return;
      }

      // Advance to next floor
      logDebug(`Advancing to next floor after acceptance`, 'GameFlow');
      get().advanceToNextFloor();
    },

    passProposal: () => {
      // Always get fresh state
      const playersState = usePlayersStore.getState();
      const floorState = useFloorStore.getState();
      
      const {
        getCurrentPlayer,
        cardsBeingDealt
      } = playersState;

      const {
        currentFloor,
        getCurrentFloorState,
        finalizeFloor
      } = floorState;

      logDebug(`passProposal called: currentFloor=${currentFloor}, isAiTurn=${get().isAiTurn}`, 'GameFlow');

      // Validation - allow pass even from AI, but not during dealing
      if (cardsBeingDealt) {
        logDebug(`Pass proposal rejected: cards being dealt`, 'GameFlow');
        return;
      }

      const currentPlayer = getCurrentPlayer();
      if (!currentPlayer) {
        logDebug(`Pass proposal rejected: no current player`, 'GameFlow');
        return;
      }

      const floorStateObj = getCurrentFloorState();
      if (!floorStateObj) {
        logDebug(`Pass proposal rejected: no current floor state`, 'GameFlow');
        return;
      }

      const hasProposalA = !!floorStateObj.proposalA;
      const hasProposalB = !!floorStateObj.proposalB;

      logDebug(`Pass state validation: player=${currentPlayer.id}, floor=${currentFloor}, hasProposalA=${hasProposalA}, hasProposalB=${hasProposalB}`, 'GameFlow');

      // Handle different pass scenarios
      if (hasProposalA && hasProposalB) {
        // Mediation needed - Create safe copies of proposals
        const proposalACopy = {...floorStateObj.proposalA!};
        const proposalBCopy = {...floorStateObj.proposalB!};
        
        get().logAction(
          `${currentPlayer.name} passes. AI mediator will select the fairest proposal.`
        );
        logDebug(`Both proposals exist - initiating mediation`, 'GameFlow');

        // Use copied proposals for mediation
        const mediatedWinner = get().mediateProposals(currentFloor);

        if (mediatedWinner) {
          get().logAction(
            `AI mediator selected ${mediatedWinner.name} for floor ${currentFloor}.`
          );
          // Log debug outcome handled inside mediateProposals

          finalizeFloor(
            currentFloor,
            FloorStatus.Agreed,
            mediatedWinner,  // Using mediated result 
            Committer.Auto
          );
        } else {
          // Fallback if mediation fails
          get().logAction(`Mediation failed for floor ${currentFloor}. Skipping.`);
          logDebug(`Mediation failed unexpectedly for floor ${currentFloor}`, 'GameFlow');

          finalizeFloor(
            currentFloor,
            FloorStatus.Skipped,
            undefined,
            Committer.None
          );
        }
      } else if (hasProposalA || hasProposalB) {
        // Auto-accept single proposal - make a safe copy
        const winnerCard = hasProposalA ? 
          {...floorStateObj.proposalA!} : 
          {...floorStateObj.proposalB!};

        if (winnerCard) {
          get().logAction(`${currentPlayer.name} passes. Only one proposal exists.`);
          get().logAction(
            `${winnerCard.name} is automatically accepted for floor ${currentFloor}.`
          );
          logDebug(`One proposal exists, auto-accepting: ${winnerCard.id} (proposed by ${hasProposalA ? 'A' : 'B'})`, 'GameFlow');

          finalizeFloor(
            currentFloor,
            FloorStatus.Agreed,
            winnerCard,  // Using our safe copy
            hasProposalA ? Committer.PlayerA : Committer.PlayerB
          );
        } else {
          // Should be impossible if hasProposalA or hasProposalB is true
          get().logAction(
            `Error: Proposal expected but not found on floor ${currentFloor}. Skipping.`
          );
          logDebug(`Error in pass proposal state: proposal flagged (A=${hasProposalA}, B=${hasProposalB}) but object not found`, 'GameFlow');

          finalizeFloor(
            currentFloor,
            FloorStatus.Skipped,
            undefined,
            Committer.None
          );
        }
      } else {
        // No proposals - Skip the floor
        get().logAction(`${currentPlayer.name} passes. No proposals made.`);
        get().logAction(`Skipping floor ${currentFloor}.`);
        logDebug(`No proposals exist, skipping floor ${currentFloor}`, 'GameFlow');

        finalizeFloor(
          currentFloor,
          FloorStatus.Skipped,
          undefined,
          Committer.None
        );
      }

      // Record end of negotiation time for telemetry
      if (get().negotiationStartTime) {
        const endTime = Date.now();
        const negotiationTime = Math.round((endTime - get().negotiationStartTime!) / 1000);
        useTelemetryStore.getState().recordNegotiationTime(currentFloor, negotiationTime);
        logDebug(`Negotiation (ended by pass) completed in ${negotiationTime}s`, 'GameFlow');
      }

      // Check for game end conditions
      const gameEndResult = get().evaluateGameEnd();
      if (gameEndResult.isOver) {
        logDebug(`Game over: ${gameEndResult.reason}. Winner: ${gameEndResult.winner}`, 'GameFlow');
        logDebug(`Game ending: reason=${gameEndResult.reason}, winner=${gameEndResult.winner}`, 'GameFlow');

        // Using proper immer pattern
        set(state => {
          state.gamePhase = GamePhase.GameOver;
          state.gameOverReason = gameEndResult.reason || "Game over";
          state.winnerMessage = gameEndResult.winner === 'balanced'
            ? 'Project BALANCED'
            : `Project FAVORS ${gameEndResult.winner?.toUpperCase()}`;
        });

        // Record the win in telemetry
        if (gameEndResult.winner) {
          useTelemetryStore.getState().recordWin(gameEndResult.winner);
        }

        return;
      }

      // Advance to next floor
      logDebug(`Advancing to next floor after pass`, 'GameFlow');
      get().advanceToNextFloor();
    },

    useRecallToken: (floorNumber) => {
      // Basic validations using helper functions
      const validationResult = validateAll(
        validateGamePhase(get().gamePhase, GamePhase.Playing),
        validateNotDealing(usePlayersStore.getState().cardsBeingDealt),
      );

      // Additional validation for AI turn
      if (get().isAiTurn) {
        return validationFailed('AI cannot use recall tokens');
      }

      // Always get fresh state
      const playersState = usePlayersStore.getState();
      const floorState = useFloorStore.getState();
      
      const { getCurrentPlayer, decrementRecallToken, currentPlayerIndex } = playersState;
      const { validateRecall, applyRecall, setCurrentFloor } = floorState;
      const { applyScorePenalty } = useBuildingStore.getState();

      const currentPlayer = getCurrentPlayer();
      if (!currentPlayer) {
        logDebug(`Recall token use rejected: no current player`, 'GameFlow');
        return;
      }

      // Validate the recall action
      const recallValidation = validateRecall(floorNumber);
      if (!recallValidation.isValid) {
        get().logAction(recallValidation.reason);
        logDebug(`Recall token use rejected: validation failed (${recallValidation.reason})`, 'GameFlow');
        return;
      }

      // Store original state for rollback if needed
      const originalPlayerIndex = currentPlayerIndex;
      const originalTokenCount = currentPlayer.recallTokens;
      let recallSuccessful = false;

      try {
        // TRANSACTION START - First operation: Decrement the token
        decrementRecallToken(originalPlayerIndex);
        logDebug(`Decremented recall token for player ${currentPlayer.id}`, 'GameFlow');

        // Second operation: Apply the recall to the floor
        const { winnerCard } = applyRecall(floorNumber);
        logDebug(`Successfully applied recall to floor ${floorNumber}`, 'GameFlow');

        // Mark the transaction as successful
        recallSuccessful = true;

        // Apply score penalty based on player role (outside critical transaction)
        const scorePenalty = currentPlayer.role === PlayerRole.Community
          ? RECALL_SCORE_PENALTY
          : -RECALL_SCORE_PENALTY;

        applyScorePenalty(scorePenalty);

        // Log the action
        const currentScore = useBuildingStore.getState().building.baselineScore;
        get().logAction(
          `${currentPlayer.name} used a recall token on floor ${floorNumber}. ` +
          `Score penalty: ${scorePenalty > 0 ? '+' : ''}${scorePenalty}. ` +
          `New score: ${currentScore > 0 ? '+' : ''}${currentScore}`
        );

        // Add detailed outcome logging
        logDebug(`Recall token used: player=${currentPlayer.id}, floor=${floorNumber}, penalty=${scorePenalty}, newScore=${currentScore}`, 'GameFlow');

        // Record recall in telemetry
        useTelemetryStore.getState().recordRecallUsed(currentPlayer.role);

        // Prepare for renegotiation
        setCurrentFloor(floorNumber);

        // Get fresh state again
        const leadPlayer = usePlayersStore.getState().getLeadPlayer(floorNumber);
        if (!leadPlayer) {
          throw new Error(`Could not determine lead player for recalled floor ${floorNumber}`);
        }

        // Set up next turn
        const nextPlayerIndex = usePlayersStore.getState().players.findIndex(
          p => p.id === leadPlayer.id
        );

        usePlayersStore.getState().setCurrentPlayerIndex(nextPlayerIndex);
        usePlayersStore.getState().selectHandCard(null);
        usePlayersStore.getState().selectCounterCard(null);

        set(state => {
          state.isAiTurn = leadPlayer.type === PlayerType.AI;
          state.negotiationStartTime = Date.now();
          state.proposalTimer = PROPOSAL_TIMER;
        });

        get().logAction(`Returning to floor ${floorNumber}. ${leadPlayer.name} to propose.`);
        logDebug(`Floor reopened: setting currentFloor=${floorNumber}, leadPlayer=${leadPlayer.id}, isAI=${leadPlayer.type === PlayerType.AI}`, 'GameFlow');

        // Schedule AI turn if needed
        if (leadPlayer.type === PlayerType.AI) {
          setTimeout(() => {
            if (get().gamePhase === GamePhase.Playing && get().isAiTurn) {
              logDebug(`Triggering AI turn for reopened floor ${floorNumber}`, 'GameFlow');
              useAIStore.getState().aiPlayTurn();
            }
          }, AI_TURN_DELAY_MS);
        }
      } catch (error) {
        // TRANSACTION ROLLBACK - if the recall failed but we already deducted the token
        if (!recallSuccessful) {
          logDebug(`Recall operation failed, rolling back token for player ${originalPlayerIndex}`, 'GameFlow');

          // Add the token back - use setState directly to avoid Immer draft issue
          usePlayersStore.setState(state => {
            if (state.players[originalPlayerIndex]) {
              state.players[originalPlayerIndex].recallTokens = originalTokenCount;
            }
            return state;
          });

          logDebug(`Rollback complete: restored token count to ${originalTokenCount}`, 'GameFlow');
        }

        // Log the error
        const errorMessage = error instanceof Error ? error.message : String(error);
        logError(`Error recalling floor ${floorNumber}`, error instanceof Error ? error : new Error(errorMessage), 'GameFlow');
        get().logAction(`Error recalling floor ${floorNumber}: ${errorMessage}`);
      }
    },

    advanceToNextFloor: () => {
      // Always get fresh state
      const floorState = useFloorStore.getState();
      const { currentFloor, getNextPendingFloor, setCurrentFloor } = floorState;
      const nextFloor = getNextPendingFloor();

      // Add current state and target logging
      logDebug(`advanceToNextFloor called: currentFloor=${currentFloor}, nextFloor=${nextFloor}`, 'GameFlow');

      // Check if we've reached maximum height
      if (nextFloor > MAX_STORIES) {
        get().logAction(`Building complete! Maximum height of ${MAX_STORIES} stories reached.`);

        const gameEndResult = get().evaluateGameEnd();
        // Add game end condition logging
        logDebug(`Game ending due to max height: winner=${gameEndResult.winner}`, 'GameFlow');

        // Using proper immer pattern
        set(state => {
          state.gamePhase = GamePhase.GameOver;
          state.gameOverReason = 'Building complete';
          state.winnerMessage = gameEndResult.winner === 'balanced'
            ? 'Project BALANCED'
            : `Project FAVORS ${gameEndResult.winner?.toUpperCase()}`;
        });

        // Record the win in telemetry
        if (gameEndResult.winner) {
          useTelemetryStore.getState().recordWin(gameEndResult.winner);
        }

        return;
      }

      // Set the next floor
      setCurrentFloor(nextFloor);

      // Get fresh player state
      const playersState = usePlayersStore.getState();
      const leadPlayer = playersState.getLeadPlayer(nextFloor);
      
      if (!leadPlayer) {
        logDebug(`Error: Could not determine lead player for floor ${nextFloor}. Ending game.`, 'GameFlow');
        console.error(`Error: Could not determine lead player for floor ${nextFloor}.`);

        // Using proper immer pattern
        set(state => {
          state.gamePhase = GamePhase.GameOver;
          state.gameOverReason = 'Internal error: Cannot determine lead player';
        });
        return;
      }

      // Set up next turn
      const nextPlayerIndex = playersState.players.findIndex(
        p => p.id === leadPlayer.id
      );

      playersState.setCurrentPlayerIndex(nextPlayerIndex);

      set(state => {
        state.isAiTurn = leadPlayer.type === PlayerType.AI;
        state.negotiationStartTime = Date.now();
        state.proposalTimer = PROPOSAL_TIMER; // Reset timer for new floor
      });

      get().logAction(`Moving to floor ${nextFloor}. ${leadPlayer.name} to propose.`);
      // Add player transition logging
      logDebug(`Advanced to floor ${nextFloor}: leadPlayer=${leadPlayer.id}, isAI=${leadPlayer.type === PlayerType.AI}`, 'GameFlow');

      // Trigger AI turn if needed
      if (leadPlayer.type === PlayerType.AI) {
        logDebug(`AI turn required for new floor ${nextFloor}. Scheduling AI action...`, 'GameFlow');
        setTimeout(() => {
          // Safety check
          if (get().gamePhase === GamePhase.Playing && get().isAiTurn) {
            logDebug(`Triggering AI turn for new floor ${nextFloor}`, 'GameFlow');
            useAIStore.getState().aiPlayTurn();
          }
        }, 1000);
      }
    },

    mediateProposals: (floorNumber) => {
      logDebug(`mediateProposals called for floor ${floorNumber}`, 'GameFlow');
      
      // Get fresh state
      const { getFloorState } = useFloorStore.getState();
      const { building } = useBuildingStore.getState();

      const floorState = getFloorState(floorNumber);
      if (!floorState || !floorState.proposalA || !floorState.proposalB) {
        logDebug(`Mediation failed: Missing proposals on floor ${floorNumber}`, 'GameFlow');
        return undefined;
      }

      // Create safe copies of proposals to avoid revoked proxy issues
      const proposalA = {...floorState.proposalA};
      const proposalB = {...floorState.proposalB};
      const currentScore = building.baselineScore;

      // Add proposal comparison logging
      logDebug(`Mediating between proposalA (${proposalA.name}, impact=${proposalA.netScoreImpact}) and proposalB (${proposalB.name}, impact=${proposalB.netScoreImpact}) at score ${currentScore}`, 'GameFlow');

      // Implement mediation logic directly - choose card that brings score closest to balance
      const scoreAfterA = currentScore + (proposalA.netScoreImpact || 0);
      const scoreAfterB = currentScore + (proposalB.netScoreImpact || 0);
      
      // The winner is the card that brings the score closest to zero
      const winner = Math.abs(scoreAfterA) <= Math.abs(scoreAfterB) ? proposalA : proposalB;

      // Add decision outcome
      logDebug(`Mediation selected: ${winner.name} (results in score of ${currentScore + (winner.netScoreImpact || 0)})`, 'GameFlow');

      return winner;
    },

    // Added toggleAiTurn implementation
    toggleAiTurn: () => {
      // Using proper Immer pattern
      set(state => {
        state.isAiTurn = !state.isAiTurn;
      });

      // Call logAction after state update
      const isAi = get().isAiTurn;
      get().logAction(`Turn switched to ${isAi ? 'AI' : 'Human'}`);
      logDebug(`AI turn toggled: now ${isAi ? 'AI' : 'Human'}`, 'GameFlow');
    },

    // Evaluation methods
    evaluateGameEnd: () => {
      // Get fresh state
      const playersState = usePlayersStore.getState();
      const buildingState = useBuildingStore.getState();
      const floorState = useFloorStore.getState();
      
      const { players, deck } = playersState;
      const { building } = buildingState;
      const { currentFloor } = floorState;
      const finalScore = building.baselineScore;

      // Add current state logging
      logDebug(`Evaluating game end conditions: currentScore=${finalScore}, currentFloor=${currentFloor}, deckSize=${deck.length}`, 'GameFlow');

      // 1. Check max height
      if (currentFloor >= MAX_STORIES && useFloorStore.getState().floors[MAX_STORIES-1]?.status !== FloorStatus.Pending) {
        logDebug(`Game end condition: Max height reached (${MAX_STORIES}). Final score: ${finalScore}`, 'GameFlow');
        const winner = get().determineWinner(finalScore);
        logDebug(`Result: ${winner === 'balanced' ? "BALANCED (within threshold ±" + BALANCE_THRESHOLD + ")" : winner.toUpperCase() + " WINS"}`, 'GameFlow');
        return { isOver: true, reason: 'Building complete', winner: winner };
      }

      // 2. Check empty deck and hands
      const noMoreCards = deck.length === 0 && players.every(p => p.hand.length === 0);
      if (noMoreCards) {
        get().logAction(`No more cards left to play. Game over.`);
        logDebug(`Game end condition: Deck and hands empty. Final score: ${finalScore}`, 'GameFlow');
        const winner = get().determineWinner(finalScore);
        logDebug(`Result: ${winner === 'balanced' ? 'BALANCED (within threshold ±' + BALANCE_THRESHOLD + ')' : winner.toUpperCase() + ' WINS'}`, 'GameFlow');
        return {
          isOver: true,
          reason: 'No more cards',
          winner: winner
        };
      }

      // 3. Check for impossible finish
      const remainingCards = [...deck, ...players.flatMap(player => player.hand)];
      const cardMetrics = get().analyzeRemainingCards(remainingCards);
      const bestPossibleFinalScore = building.baselineScore + cardMetrics.maxPositiveImpact;
      const worstPossibleFinalScore = building.baselineScore + cardMetrics.maxNegativeImpact;
      const isImpossible = (
        worstPossibleFinalScore > BALANCE_THRESHOLD ||
        bestPossibleFinalScore < -BALANCE_THRESHOLD
      );
      if (isImpossible) {
        get().logAction(`Impossible to reach balanced outcome. Ending game.`);
        logDebug(`Game end condition: Balance impossible. Final score: ${finalScore}`, 'GameFlow');
        const winner = get().determineWinner(finalScore);
        logDebug(`Result: ${winner === 'balanced' ? "BALANCED (within threshold +/-" + BALANCE_THRESHOLD + ")" : winner.toUpperCase() + " WINS"}`, 'GameFlow');
        return {
          isOver: true,
          reason: 'Balance impossible to achieve',
          winner: winner
        };
      }

      // Game continues
      logDebug(`Game end conditions not met, continuing game.`, 'GameFlow');
      return { isOver: false };
    },

    /**
     * Determines the winner based on the final score.
     */
    determineWinner: (finalScore) => {
      // Implement winner determination directly instead of using private engine method
      if (Math.abs(finalScore) <= BALANCE_THRESHOLD) {
        return 'balanced';
      } else if (finalScore > BALANCE_THRESHOLD) {
        return 'community';
      } else {
        return 'developer';
      }
    },

    /**
     * Checks if it's impossible to achieve a balanced outcome
     */
    checkImpossibleFinish: () => {
      // Get fresh state
      const buildingState = useBuildingStore.getState();
      const floorState = useFloorStore.getState();
      const playersState = usePlayersStore.getState();

      const { building } = buildingState;
      const { currentFloor } = floorState;

      const currentScore = building.baselineScore;
      const remainingFloors = MAX_STORIES - currentFloor + 1; // Include current floor if pending

      // No need to check if the game already ended
      if (remainingFloors <= 0) return false;

      logDebug(`Checking if balanced finish is possible: currentScore=${currentScore}, remainingFloors=${remainingFloors}`, 'GameFlow');

      // Get all remaining cards (in deck and player hands)
      const remainingCards = [...playersState.deck, ...playersState.players.flatMap(player => player.hand)];

      // Use the public method to analyze cards
      const cardMetrics = get().analyzeRemainingCards(remainingCards);

      logDebug(`Remaining card analysis: MaxPosImpact=${cardMetrics.maxPositiveImpact}, MaxNegImpact=${cardMetrics.maxNegativeImpact}`, 'GameFlow');

      // Calculate best and worst possible outcomes
      const bestPossibleFinalScore = currentScore + cardMetrics.maxPositiveImpact;
      const worstPossibleFinalScore = currentScore + cardMetrics.maxNegativeImpact;

      // Check if the entire possible range of final scores is outside the balance threshold
      const isImpossible = (
        worstPossibleFinalScore > BALANCE_THRESHOLD || // Too high, can't get down enough
        bestPossibleFinalScore < -BALANCE_THRESHOLD    // Too low, can't get up enough
      );

      // Log outcome summary with clear explanation
      logDebug(
        `Balance range [${worstPossibleFinalScore}, ${bestPossibleFinalScore}]. ` +
        `Target range [${-BALANCE_THRESHOLD}, ${BALANCE_THRESHOLD}]. ` +
        `Balance ${isImpossible ? 'IS' : 'IS NOT'} impossible to achieve.`,
        'GameFlow'
      );

      return isImpossible;
    },

    analyzeRemainingCards: (cards) => {
      // Implement the card analysis directly since gameEngine.analyzeRemainingCards is private
      const maxPositiveImpact = cards.reduce((sum, card) => {
        const impact = card.netScoreImpact || 0;
        return impact > 0 ? sum + impact : sum;
      }, 0);
      
      const maxNegativeImpact = cards.reduce((sum, card) => {
        const impact = card.netScoreImpact || 0;
        return impact < 0 ? sum + impact : sum;
      }, 0);
      
      const topPositiveCards = [...cards]
        .filter(card => (card.netScoreImpact || 0) > 0)
        .sort((a, b) => (b.netScoreImpact || 0) - (a.netScoreImpact || 0))
        .slice(0, 5);
        
      const topNegativeCards = [...cards]
        .filter(card => (card.netScoreImpact || 0) < 0)
        .sort((a, b) => (a.netScoreImpact || 0) - (b.netScoreImpact || 0))
        .slice(0, 5);
        
      return {
        maxPositiveImpact,
        maxNegativeImpact,
        topPositiveCards,
        topNegativeCards
      };
    }
  }))
);

/**
 * Helper function for logging a game event message.
 */
function logGameEvent(message: string): void {
  // Use the centralized logDebug function with a specific category
  logDebug(message, 'GameEvent');
}