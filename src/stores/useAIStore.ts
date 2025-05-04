// stores/useAIStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { CardData } from "@/data/types";
import { BALANCE_THRESHOLD } from '@/data/constants';
import { usePlayersStore, PlayerRole, PlayerType } from './usePlayersStore';
import { useFloorStore } from './useFloorStore';
import { useBuildingStore } from './useBuildingStore';
import { useGameFlowStore } from './useGameFlowStore';
import { logDebug } from '@/utils/logger';

// Add AI-specific logging function
export const logAIAction = (message: string) =>
  logDebug(message, 'AI');

// Define AI strategy interface
export interface AIStrategy {
  name: string;
  evaluateProposal: (card: CardData, gameState: any) => number;
  shouldAcceptProposal: (proposal: CardData, gameState: any) => boolean;
  selectCounterProposal: (hand: CardData[], opponentProposal: CardData, gameState: any) => CardData | null;
}

// Balanced strategy implementation
const balancedStrategy: AIStrategy = {
  name: 'balanced',
  evaluateProposal: (card, gameState) => {
    const newScore = gameState.building.currentNetScore + card.netScoreImpact;
    logDebug(`Balanced strategy evaluating card ${card.name}, impact=${card.netScoreImpact}, current score=${gameState.building.currentNetScore}`, 'AI');
    
    if (gameState.currentPlayer.role === PlayerRole.Developer) {
      if (newScore > 0 && newScore <= BALANCE_THRESHOLD) {
        logDebug(`   Good balance for Developer: ${newScore}`, 'AI');
        return newScore;
      } else if (newScore > BALANCE_THRESHOLD) {
        const score = BALANCE_THRESHOLD - (newScore - BALANCE_THRESHOLD) * 0.8;
        logDebug(`   Beyond threshold for Developer: ${score}`, 'AI');
        return score;
      } else {
        const score = newScore * 0.5;
        logDebug(`   Negative but acceptable for Developer: ${score}`, 'AI');
        return score;
      }
    } else {
      if (newScore < 0 && newScore >= -BALANCE_THRESHOLD) {
        const score = -newScore;
        logDebug(`   Good balance for Community: ${score}`, 'AI');
        return score;
      } else if (newScore < -BALANCE_THRESHOLD) {
        const score = BALANCE_THRESHOLD - (Math.abs(newScore) - BALANCE_THRESHOLD) * 0.8;
        logDebug(`   Beyond threshold for Community: ${score}`, 'AI');
        return score;
      } else {
        const score = -newScore * 0.5;
        logDebug(`   Positive but acceptable for Community: ${score}`, 'AI');
        return score;
      }
    }
  },
  shouldAcceptProposal: (proposal, gameState) => {
    const { currentNetScore } = gameState.building;
    const aiRole = gameState.currentPlayer.role;
    const scoreWithProposal = currentNetScore + proposal.netScoreImpact;
    logDebug(`Balanced strategy deciding on accepting ${proposal.name}, impact=${proposal.netScoreImpact}, current score=${currentNetScore}`, 'AI');
    const isWithinThreshold = Math.abs(scoreWithProposal) <= BALANCE_THRESHOLD;
    const isMovingInPreferredDirection = aiRole === PlayerRole.Developer
      ? scoreWithProposal > currentNetScore
      : scoreWithProposal < currentNetScore;
    const acceptanceChance = isWithinThreshold ? 0.8 : (isMovingInPreferredDirection ? 0.5 : 0.3);
    const randomRoll = Math.random();
    const willAccept = randomRoll < acceptanceChance;
    logDebug(`   isWithinThreshold=${isWithinThreshold}, isMovingInPreferredDirection=${isMovingInPreferredDirection}`, 'AI');
    logDebug(`   Acceptance chance=${acceptanceChance}, roll=${randomRoll.toFixed(2)}, decision=${willAccept ? 'ACCEPT' : 'REJECT'}`, 'AI');
    return willAccept;
  },
  selectCounterProposal: (hand, opponentProposal, gameState) => {
    logDebug(`Balanced strategy selecting counter-proposal against ${opponentProposal.name}`, 'AI');
    const opponentProposalValue = balancedStrategy.evaluateProposal(opponentProposal, gameState);
    logDebug(`   Opponent proposal value: ${opponentProposalValue}`, 'AI');
    let bestCounterCard: CardData | null = null;
    let bestValue = -Infinity;
    for (const card of hand) {
      const cardValue = balancedStrategy.evaluateProposal(card, gameState);
      logDebug(`   Evaluating potential counter ${card.name}: value=${cardValue}`, 'AI');
      // Only counter if significantly better than opponent's proposal
      if (cardValue > opponentProposalValue + 3) { // Threshold to prevent minor counters
        if (cardValue > bestValue) {
          bestValue = cardValue;
          bestCounterCard = card;
          logDebug(`     New best counter: ${card.name} (${cardValue})`, 'AI');
        }
      }
    }
    if (bestCounterCard) {
      logDebug(`   Selected counter: ${bestCounterCard.name} (value: ${bestValue})`, 'AI');
    } else {
      logDebug(`   No suitable counter found`, 'AI');
    }
    return bestCounterCard;
  }
};

// Aggressive strategy implementation
const aggressiveStrategy: AIStrategy = {
  name: 'aggressive',
  evaluateProposal: (card, gameState) => {
    const newScore = gameState.building.currentNetScore + card.netScoreImpact;
    logDebug(`Aggressive strategy evaluating card ${card.name}, impact=${card.netScoreImpact}, current score=${gameState.building.currentNetScore}`, 'AI');
    if (gameState.currentPlayer.role === PlayerRole.Developer) {
      logDebug(`   Developer role favors positive: ${newScore}`, 'AI');
      return newScore;
    } else {
      // Community role aggressively favors negative scores
      logDebug(`   Community role favors negative: ${-newScore}`, 'AI');
      return -newScore; // Return the negative of the score impact
    }
  },
  shouldAcceptProposal: (proposal, gameState) => {
    const { currentNetScore } = gameState.building;
    const aiRole = gameState.currentPlayer.role;
    const scoreWithProposal = currentNetScore + proposal.netScoreImpact;
    logDebug(`Aggressive strategy deciding on accepting ${proposal.name}, impact=${proposal.netScoreImpact}, current score=${currentNetScore}`, 'AI');
    const isStronglyPreferred = aiRole === PlayerRole.Developer
      ? scoreWithProposal > currentNetScore + 2 // Stronger preference needed
      : scoreWithProposal < currentNetScore - 2;
    const willAccept = isStronglyPreferred && Math.random() < 0.4; // Lower chance
    logDebug(`   isStronglyPreferred=${isStronglyPreferred}, decision=${willAccept ? 'ACCEPT' : 'REJECT'}`, 'AI');
    return willAccept;
  },
  selectCounterProposal: (hand, opponentProposal, gameState) => {
    logDebug(`Aggressive strategy selecting counter-proposal against ${opponentProposal.name}`, 'AI');
    let bestCounterCard: CardData | null = null;
    let bestValue = -Infinity;
    for (const card of hand) {
      const cardValue = aggressiveStrategy.evaluateProposal(card, gameState);
      logDebug(`   Evaluating potential counter ${card.name}: value=${cardValue}`, 'AI');
      if (cardValue > bestValue) {
        bestValue = cardValue;
        bestCounterCard = card;
        logDebug(`     New best counter: ${card.name} (${cardValue})`, 'AI');
      }
    }
    if (bestCounterCard) {
      logDebug(`   Selected counter: ${bestCounterCard.name} (value: ${bestValue})`, 'AI');
    } else {
      logDebug(`   No suitable counter found`, 'AI');
    }
    return bestCounterCard;
  }
};

// Define action types for async handling
type AIAction = 
  | { type: 'SET_THINKING', thinking: boolean }
  | { type: 'SET_LAST_DECISION', timestamp: number, action: string, details?: string }
  | { type: 'SET_STRATEGY', strategy: AIStrategy }
  | { type: 'SET_DIFFICULTY_LEVEL', level: string };

interface AIStoreState {
  // State
  strategy: AIStrategy;
  difficultyLevel: string; // e.g., 'easy', 'normal', 'hard'
  thinking: boolean;
  lastDecision: {
    timestamp: number;
    action: string; // e.g., 'propose', 'accept', 'counter', 'pass', 'mediate'
    details?: string; // e.g., card name, reason
  };

  // Actions
  setStrategy: (strategyName: string) => void;
  setDifficultyLevel: (level: string) => void;
  aiPlayTurn: () => void; // Main entry point for AI turn
  aiMakeProposal: () => void;
  aiRespondToProposal: () => void;
  aiDecideOnCounter: () => void;

  // Dispatch helper for async operations
  dispatch: (action: AIAction) => void;

  // Helpers
  getGameState: () => any; // Gathers necessary state for decision making
}

export const useAIStore = create<AIStoreState>()(
  immer((set, get) => ({
    // ===========================
    //         State
    // ===========================
    strategy: balancedStrategy, // Default strategy
    difficultyLevel: 'normal',
    thinking: false,
    lastDecision: {
      timestamp: 0,
      action: ''
    },

    // ===========================
    //         Actions
    // ===========================
    
    // Helper to safely dispatch state updates from async operations
    dispatch: (action: AIAction): void => {
      switch (action.type) {
        case 'SET_THINKING':
          set(state => {
            state.thinking = action.thinking;
          });
          break;
        case 'SET_LAST_DECISION':
          set(state => {
            state.lastDecision = {
              timestamp: action.timestamp,
              action: action.action,
              details: action.details
            };
          });
          break;
        case 'SET_STRATEGY':
          set(state => {
            state.strategy = action.strategy;
          });
          break;
        case 'SET_DIFFICULTY_LEVEL':
          set(state => {
            state.difficultyLevel = action.level;
          });
          break;
      }
    },

    setStrategy: (strategyName: string): void => {
      logDebug(`Setting AI strategy to: ${strategyName}`, 'AI');
      let newStrategy: AIStrategy;
      switch (strategyName.toLowerCase()) {
        case 'aggressive':
          newStrategy = aggressiveStrategy;
          break;
        case 'balanced':
        default:
          newStrategy = balancedStrategy;
          break;
      }
      set(state => {
        state.strategy = newStrategy;
      });
      logAIAction(`AI strategy changed to ${newStrategy.name}`);
    },

    setDifficultyLevel: (level: string): void => {
      logDebug(`Setting difficulty level to: ${level}`, 'AI');
      set(state => {
        state.difficultyLevel = level;
      });
    },

    /**
     * Main entry point for the AI to take its turn.
     * Determines the current game state and calls the appropriate AI action.
     */
    aiPlayTurn: () => {
      logDebug(`⚙️ aiPlayTurn() firing for floor ${get().getGameState().currentFloor}`, 'AI');

      logDebug(`AI turn beginning`, 'AI');
      // Mark AI as thinking
      get().dispatch({ type: 'SET_THINKING', thinking: true });
    
      try {
        // Run validations synchronously
        // Fetch necessary state from other stores
        const { isAiTurn } = useGameFlowStore.getState();
        const { getCurrentPlayer, getLeadPlayer } = usePlayersStore.getState();
        const { currentFloor, getCurrentFloorState } = useFloorStore.getState();
        const { logAction, passProposal } = useGameFlowStore.getState();
    
        // Pre-computation checks
        if (!isAiTurn) {
          logDebug(`Error: Not AI's turn. Aborting AI action.`, 'AI');
          get().dispatch({ type: 'SET_THINKING', thinking: false });
          return;
        }
    
        const aiPlayer = getCurrentPlayer();
        if (!aiPlayer || aiPlayer.type !== PlayerType.AI) {
          logDebug(`Error: Current player is not AI or not found. Skipping turn.`, 'AI');
          logAction("AI turn error (not AI player). Skipping.");
          get().dispatch({ type: 'SET_THINKING', thinking: false });
          return;
        }
    
        const currentFloorState = getCurrentFloorState();
        if (!currentFloorState) {
          logDebug(`Error: Cannot get current floor state. Skipping turn.`, 'AI');
          logAction("AI turn error (no floor state). Skipping.");
          get().dispatch({ type: 'SET_THINKING', thinking: false });
          return;
        }
    
        // Determine AI's role on this floor (lead proposer or responder)
        const leadPlayer = getLeadPlayer(currentFloor);
        const isLeadPlayer = aiPlayer.id === leadPlayer?.id;
    
        const hasProposalA = !!currentFloorState.proposalA;
        const hasProposalB = !!currentFloorState.proposalB;
    
        logDebug(`AI turn state: floor=${currentFloor}, isLeadPlayer=${isLeadPlayer}, proposals: A=${hasProposalA}, B=${hasProposalB}, AI: ${aiPlayer.name} (${aiPlayer.role})`, 'AI');
    
        logDebug(`Branch logic on floor ${currentFloor}: isLead=${isLeadPlayer}, hasA=${hasProposalA}, hasB=${hasProposalB}`, 'AI');

        // Determine the action to take after the thinking delay
        let nextAction: () => void;
        
        if (isLeadPlayer && !hasProposalA && !hasProposalB) {
          // AI is lead player and needs to make initial proposal
          nextAction = () => get().aiMakeProposal();
        } else if (!isLeadPlayer && (hasProposalA || hasProposalB) && !(hasProposalA && hasProposalB)) {
          // AI is responder, and one proposal exists
          nextAction = () => get().aiRespondToProposal();
        } else if (isLeadPlayer && hasProposalA && hasProposalB) {
          // AI is lead player and both proposals exist (opponent made counter)
          nextAction = () => get().aiDecideOnCounter();
        } else {
          // Fallback for unexpected states
          logDebug(`AI in unexpected state or waiting. Will pass turn. State: isLead=${isLeadPlayer}, propA=${hasProposalA}, propB=${hasProposalB}`, 'AI');
          nextAction = () => {
            logAction(`AI (${aiPlayer.name}) is in an unexpected state or has no action. Passing.`);
            passProposal();
            get().dispatch({ 
              type: 'SET_LAST_DECISION',
              timestamp: Date.now(),
              action: 'pass',
              details: 'Unexpected state'
            });
            get().dispatch({ type: 'SET_THINKING', thinking: false });
          };
        }
    
        // Use the thinking delay
        const thinkingTime = Math.random() * 500 + 500; // 500-1000ms
        logDebug(`AI thinking for ${thinkingTime.toFixed(0)}ms...`, 'AI');
        
        // Schedule the next action after thinking time
        setTimeout(() => {
          try {
            // FIX: Wrap nextAction in try-catch to catch any errors
            nextAction();
          } catch (e) {
            // If an error occurs, log it and make sure we clean up
            logDebug(`AI action error: ${e}`, 'AI');
            get().dispatch({ type: 'SET_THINKING', thinking: false });
          }
        }, thinkingTime);
      } catch (e) {
        // If an error occurs during setup, log it and clean up
        logDebug(`AI setup error: ${e}`, 'AI');
        get().dispatch({ type: 'SET_THINKING', thinking: false });
      }
    },

    /**
     * AI makes an initial proposal for the current floor.
     * Selects the best card based on strategy and calls the game flow action.
     */
    aiMakeProposal: () => {
      logDebug(`AI making initial proposal...`, 'AI');
      
      // IMPORTANT FIX: Capture all external state at the beginning
      // This ensures we don't access stores after they might have been modified
      const aiPlayer = usePlayersStore.getState().getCurrentPlayer();
      const selectHandCard = usePlayersStore.getState().selectHandCard;
      const proposeCard = useGameFlowStore.getState().proposeCard;
      const logAction = useGameFlowStore.getState().logAction;
      const passProposal = useGameFlowStore.getState().passProposal;
      const strategy = get().strategy;
      
      if (!aiPlayer) {
        logDebug(`Error: aiMakeProposal - No current AI player found.`, 'AI');
        get().dispatch({ type: 'SET_THINKING', thinking: false });
        return;
      }
    
      // Log AI's hand for debugging
      logDebug(`AI (${aiPlayer.name}) hand contains ${aiPlayer.hand.length} cards:`, 'AI');
      aiPlayer.hand.forEach((card, i) => {
        logDebug(`  Card ${i + 1}: ${card.name} (ID: ${card.id}, impact: ${card.netScoreImpact})`, 'AI');
      });
    
      // Check if AI can propose
      if (aiPlayer.hand.length === 0) {
        logDebug(`AI has no cards in hand. Passing.`, 'AI');
        logAction(`${aiPlayer.name} passes (no cards to propose).`);
        passProposal();
        
        get().dispatch({ 
          type: 'SET_LAST_DECISION',
          timestamp: Date.now(),
          action: 'pass',
          details: 'No cards in hand'
        });
        get().dispatch({ type: 'SET_THINKING', thinking: false });
        return;
      }
    
      // Use the game state to evaluate cards
      const gameState = get().getGameState();
      let bestCard: CardData | null = null;
      let bestValue = -Infinity;
    
      logDebug(`Evaluating ${aiPlayer.hand.length} cards for proposal using ${strategy.name} strategy`, 'AI');
      for (const card of aiPlayer.hand) {
        const cardValue = strategy.evaluateProposal(card, gameState);
        logDebug(`  Card ${card.name} (ID: ${card.id}): value = ${cardValue.toFixed(2)}`, 'AI');
        if (cardValue > bestValue) {
          bestValue = cardValue;
          bestCard = card;
        }
      }
    
      // Execute Proposal - IMPORTANT: Do all selections BEFORE updating state
      if (bestCard) {
        // Create a safe copy of the card so we aren't using an Immer proxy that will be revoked
        const cardToPropose = {...bestCard};
        logDebug(`Selected best card: ${cardToPropose.name} (ID: ${cardToPropose.id}, value: ${bestValue.toFixed(2)})`, 'AI');
        
        // FIX: Create a complete sequence of operations to avoid race conditions
        const executeProposal = () => {
          // 1. First select the card
          selectHandCard(cardToPropose.id);
          
          // 2. Log after selection but before proposing
          logAIAction(`AI proposes ${cardToPropose.name} (impact: ${(cardToPropose.netScoreImpact ?? 0) > 0 ? '+' : ''}${cardToPropose.netScoreImpact ?? 0})`);
          
          // 3. Propose card (this is when the error happened before)
          proposeCard();
          
          // 4. Update AI store state only after all other operations
          get().dispatch({ 
            type: 'SET_LAST_DECISION',
            timestamp: Date.now(),
            action: 'propose',
            details: cardToPropose.name
          });
          get().dispatch({ type: 'SET_THINKING', thinking: false });
        };
        
        // Use a small delay to ensure UI feedback
        setTimeout(executeProposal, 50);
      } else {
        logDebug(`No suitable proposal found despite having cards. Passing.`, 'AI');
        logAction(`AI (${aiPlayer.name}) passes (no suitable moves).`);
        passProposal();
        
        get().dispatch({ 
          type: 'SET_LAST_DECISION',
          timestamp: Date.now(),
          action: 'pass',
          details: 'No suitable card'
        });
        get().dispatch({ type: 'SET_THINKING', thinking: false });
      }
    },

    /**
     * AI responds to an opponent's proposal by either accepting or counter-proposing.
     */
    aiRespondToProposal: () => {
      logDebug(`AI responding to opponent's proposal...`, 'AI');
      
      // IMPORTANT FIX: Capture all external state first
      const aiPlayer = usePlayersStore.getState().getCurrentPlayer();
      const isPlayerA = usePlayersStore.getState().isPlayerA;
      // CRITICAL FIX: Use the correct selectCounterCard from the players store
      const selectCounterCard = usePlayersStore.getState().selectCounterCard;
      const floorState = useFloorStore.getState().getCurrentFloorState();
      const acceptProposal = useGameFlowStore.getState().acceptProposal;
      const counterPropose = useGameFlowStore.getState().counterPropose;
      const passProposal = useGameFlowStore.getState().passProposal;
      const logAction = useGameFlowStore.getState().logAction;
      const strategy = get().strategy;
    
      if (!aiPlayer || !floorState) {
        // Early validation
        logDebug(`Error: No AI player or floor state found`, 'AI');
        get().dispatch({ type: 'SET_THINKING', thinking: false });
        return;
      }
    
      // Identify opponent's proposal and make a safe copy
      const aiIsPlayerA = isPlayerA(aiPlayer);
      const opponentProposal = aiIsPlayerA ? floorState.proposalB : floorState.proposalA;
    
      if (!opponentProposal) {
        // FIX: Clear thinking flag in all early returns
        logDebug(`Error: No opponent proposal found`, 'AI');
        get().dispatch({ type: 'SET_THINKING', thinking: false });
        return;
      }
    
      // Make a safe copy of the opponent's proposal to avoid proxy issues
      const opponentProposalCopy = {...opponentProposal};
      
      // Capture AI player info before mutations
      const aiPlayerName = aiPlayer.name;
      
      // Get game state (should already do safe copying internally)
      const gameState = get().getGameState();
    
      // Decision: Accept?
      const shouldAccept = strategy.shouldAcceptProposal(opponentProposalCopy, gameState);
      if (shouldAccept) {
        logDebug(`AI decides to ACCEPT opponent's proposal: ${opponentProposalCopy.name}`, 'AI');
        
        // Use only safe primitives and copies in messages
        logAIAction(`AI accepts ${opponentProposalCopy.name} (impact: ${(opponentProposalCopy.netScoreImpact ?? 0) > 0 ? '+' : ''}${opponentProposalCopy.netScoreImpact ?? 0})`);
        logAction(`AI (${aiPlayerName}) accepts ${opponentProposalCopy.name}.`);
        
        // Execute accept and update - notice we're not using stale object references
        const executeAccept = () => {
          try {
            acceptProposal();
            get().dispatch({ 
              type: 'SET_LAST_DECISION',
              timestamp: Date.now(),
              action: 'accept',
              details: opponentProposalCopy.name
            });
          } catch (e) {
            logDebug(`AI action error: ${e}`, 'AI');
          } finally {
            // FIX: Always clear thinking flag
            get().dispatch({ type: 'SET_THINKING', thinking: false });
          }
        };
        
        setTimeout(executeAccept, 50);
        return;
      }
    
      // Decision: Counter-propose?
      // Use fresh state since we got this far
      const aiHand = [...aiPlayer.hand]; // Safe copy of hand
      
      const counterCard = strategy.selectCounterProposal(
        aiHand,
        opponentProposalCopy,
        gameState
      );
    
      if (counterCard) {
        // Create a safe copy of the counter card
        const counterCardCopy = {...counterCard};
        
        // Use only safe copies in messages
        logDebug(`AI found a suitable counter-proposal: ${counterCardCopy.name}`, 'AI');
        logAIAction(`AI counter-proposes ${counterCardCopy.name} (impact: ${(counterCardCopy.netScoreImpact ?? 0) > 0 ? '+' : ''}${counterCardCopy.netScoreImpact ?? 0})`);
        logAction(`AI (${aiPlayerName}) counter-proposes ${counterCardCopy.name}.`);
    
        // Execute counter
        const executeCounter = () => {
          try {
            // CRITICAL FIX: Use selectCounterCard, not selectHandCard
            selectCounterCard(counterCardCopy.id);
            // Add debug log to verify the counter card is selected
            logDebug(`About to counter with ID=${counterCardCopy.id}, selectedCounter=${usePlayersStore.getState().selectedCounterCardId}`, 'AI');
            // Then counter propose - this is the correct sequence
            counterPropose();
            
            get().dispatch({ 
              type: 'SET_LAST_DECISION',
              timestamp: Date.now(),
              action: 'counter',
              details: counterCardCopy.name 
            });
          } catch (e) {
            logDebug(`AI action error: ${e}`, 'AI');
          } finally {
            // FIX: Always clear thinking flag
            get().dispatch({ type: 'SET_THINKING', thinking: false });
          }
        };
        
        setTimeout(executeCounter, 50);
        return;
      }
    
      // Decision: Pass
      // Use only primitives or safe copies after any mutations
      logDebug(`AI did not accept and could not counter. Passing.`, 'AI');
      logAIAction(`AI passes (no suitable counter-proposal or chose not to)`);
      logAction(`AI (${aiPlayerName}) passes on floor ${useFloorStore.getState().currentFloor}.`);
      
      // Execute pass
      const executePass = () => {
        try {
          passProposal();
          
          get().dispatch({ 
            type: 'SET_LAST_DECISION',
            timestamp: Date.now(),
            action: 'pass',
            details: 'Did not accept or counter'
          });
        } catch (e) {
          logDebug(`AI action error: ${e}`, 'AI');
        } finally {
          // FIX: Always clear thinking flag
          get().dispatch({ type: 'SET_THINKING', thinking: false });
        }
      };
      
      setTimeout(executePass, 50);
    },

    /**
     * AI decides whether to accept a counter-proposal from the opponent.
     */
    aiDecideOnCounter: () => {
      logDebug(`AI deciding on opponent's counter-proposal...`, 'AI');
      
      // IMPORTANT FIX: Capture all external state at the beginning
      const aiPlayer = usePlayersStore.getState().getCurrentPlayer();
      const isPlayerA = usePlayersStore.getState().isPlayerA;
      const floorState = useFloorStore.getState().getCurrentFloorState();
      const acceptProposal = useGameFlowStore.getState().acceptProposal;
      const passProposal = useGameFlowStore.getState().passProposal;
      const logAction = useGameFlowStore.getState().logAction;
      const strategy = get().strategy;

      if (!aiPlayer) {
        logDebug(`Error: aiDecideOnCounter - No current AI player found.`, 'AI');
        get().dispatch({ type: 'SET_THINKING', thinking: false });
        return;
      }

      if (!floorState || !floorState.proposalA || !floorState.proposalB) {
        logDebug(`Error: Missing one or both proposals for decision. State: propA=${!!floorState?.proposalA}, propB=${!!floorState?.proposalB}. Passing.`, 'AI');
        logAction(`AI (${aiPlayer.name}) error: Missing proposals for decision. Passing.`);
        passProposal();
        
        get().dispatch({ 
          type: 'SET_LAST_DECISION',
          timestamp: Date.now(),
          action: 'pass',
          details: 'Error: Missing proposals'
        });
        get().dispatch({ type: 'SET_THINKING', thinking: false });
        return;
      }

      // Get game state and strategy
      const gameState = get().getGameState();

      // Create safe copies of proposals to avoid proxy issues
      const proposalACopy = {...floorState.proposalA};
      const proposalBCopy = {...floorState.proposalB};

      // Identify which proposal is AI's and which is opponent's counter
      const isAiPlayerA = isPlayerA(aiPlayer);
      const aiOriginalProposal = isAiPlayerA ? proposalACopy : proposalBCopy;
      const opponentCounterProposal = isAiPlayerA ? proposalBCopy : proposalACopy;

      // Evaluate Both Proposals
      const aiProposalValue = strategy.evaluateProposal(aiOriginalProposal, gameState);
      const counterProposalValue = strategy.evaluateProposal(opponentCounterProposal, gameState);

      logDebug(`Evaluating proposals using ${strategy.name} strategy:`, 'AI');
      logDebug(`  Original (${aiOriginalProposal.name}): value = ${aiProposalValue.toFixed(2)}`, 'AI');
      logDebug(`  Counter (${opponentCounterProposal.name}): value = ${counterProposalValue.toFixed(2)}`, 'AI');

      // Decision Logic
      const acceptanceThreshold = -2; // Accept if counter is not significantly worse
      if (counterProposalValue >= aiProposalValue + acceptanceThreshold) {
        logDebug(`AI decides to ACCEPT counter-offer (value difference ${(counterProposalValue - aiProposalValue).toFixed(2)} >= ${acceptanceThreshold})`, 'AI');
        logAIAction(`AI accepts counter-offer of ${opponentCounterProposal.name} (impact: ${(opponentCounterProposal.netScoreImpact ?? 0) > 0 ? '+' : ''}${opponentCounterProposal.netScoreImpact ?? 0})`);
        logAction(`AI (${aiPlayer.name}) accepts counter-offer of ${opponentCounterProposal.name}.`);
        
        // FIX: Execute as one operation
        const executeAccept = () => {
          // Execute accept
          acceptProposal();
          
          // Then update state
          get().dispatch({ 
            type: 'SET_LAST_DECISION',
            timestamp: Date.now(),
            action: 'accept counter',
            details: opponentCounterProposal.name
          });
          get().dispatch({ type: 'SET_THINKING', thinking: false });
        };
        
        setTimeout(executeAccept, 50);
      } else {
        logDebug(`AI decides to REJECT counter-offer (value difference ${(counterProposalValue - aiProposalValue).toFixed(2)} < ${acceptanceThreshold}). Passing for mediation/resolution.`, 'AI');
        logAction(`AI (${aiPlayer.name}) does not accept the counter-offer. Passing.`);
        
        // FIX: Execute as one operation
        const executeReject = () => {
          // Execute pass
          passProposal();
          
          // Then update state
          get().dispatch({ 
            type: 'SET_LAST_DECISION',
            timestamp: Date.now(),
            action: 'reject counter',
            details: `Preferred own proposal: ${aiOriginalProposal.name}`
          });
          get().dispatch({ type: 'SET_THINKING', thinking: false });
        };
        
        setTimeout(executeReject, 50);
      }
    },

    /**
     * Gathers all necessary state information from various stores 
     * to support AI decision-making processes.
     * 
     * @returns A composite object with relevant game state from all stores
     */
    getGameState: () => {
      // FIX: Capture all state once to prevent accessing revoked proxies
      // Get states from all relevant stores
      const floorState = useFloorStore.getState();
      const playerState = usePlayersStore.getState();
      const buildingState = useBuildingStore.getState();
      
      // Make a deep copy of necessary state to avoid proxy issues
      const currentPlayer = playerState.getCurrentPlayer();
      const currentFloorState = floorState.getCurrentFloorState();
      const currentNetScore = buildingState.getCurrentNetScore();
      
      const gameState = {
        building: {
          // Only include necessary parts of building state
          currentNetScore: currentNetScore,
          // Add other relevant building state as needed
        },
        currentPlayer: currentPlayer ? {
          ...currentPlayer,
          // Make a shallow copy of the hand array to prevent proxy issues
          hand: [...currentPlayer.hand]
        } : null,
        opponent: null, // Could be enhanced to identify opponent player
        currentFloor: floorState.currentFloor,
        floorState: currentFloorState ? {
          ...currentFloorState,
          // Copy proposals to avoid proxy issues
          proposalA: currentFloorState.proposalA ? { ...currentFloorState.proposalA } : null,
          proposalB: currentFloorState.proposalB ? { ...currentFloorState.proposalB } : null,
        } : null,
        difficultyLevel: get().difficultyLevel, // From own store state
      };

      // Log meaningful summary of game state
      logDebug(`Current game state snapshot: floor=${gameState.currentFloor}, score=${gameState.building.currentNetScore}, AI role=${gameState.currentPlayer?.role}, difficulty=${gameState.difficultyLevel}`, 'AI');

      return gameState;
    }
  }))
);