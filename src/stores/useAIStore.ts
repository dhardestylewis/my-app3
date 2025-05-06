// stores/useAIStore.ts
// Fully refactored and corrected for usePlayersStore API changes and typing.

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { CardData, PlayerRole, PlayerType, GamePhase, Player, FloorState, CardDefinition, CardInstance } from "@/data/types";
import { BALANCE_THRESHOLD, MAX_STORIES, AI_TURN_DELAY_MS } from '@/data/constants'; 
import { usePlayersStore, ProposalBasketItem } from './usePlayersStore';
import { useFloorStore } from './useFloorStore';
import { useBuildingStore } from './useBuildingStore';
import { useGameFlowStore } from './useGameFlowStore';
import { logDebug, logError, logWarn } from '@/utils/logger';
import { deepCopy } from '@/utils/deepCopy';

const AI_INTERNAL_THINKING_DELAY_MS = 1000; 
const AI_INTERNAL_SHOW_ACTION_DELAY_MS = 1500; 

export const logAIAction = (message: string) => logDebug(message, 'AI');

export interface AIStrategy {
    name: string;
    evaluateProposal: (card: CardData, gameState: GameStateSnapshot) => number;
    selectInitialProposal: (hand: CardInstance[], gameState: GameStateSnapshot) => CardData[] | null; 
    shouldAcceptProposal: (opponentProposal: CardData[], gameState: GameStateSnapshot) => boolean;
    selectCounterProposal: (hand: CardInstance[], opponentProposal: CardData[], gameState: GameStateSnapshot) => CardData[] | null;
    shouldAcceptCounter: (aiOriginalProposal: CardData[], opponentCounter: CardData[], gameState: GameStateSnapshot) => boolean;
}

const balancedStrategy: AIStrategy = {
    name: 'balanced',
    evaluateProposal: (card, gameState) => {
        const currentScore = gameState.building.currentNetScore;
        const impact = card.netScoreImpact ?? 0;
        const newScore = currentScore + impact;
        return -Math.abs(newScore); 
    },
    selectInitialProposal: (hand, gameState) => {
        if (hand.length === 0) return null;
        const playableHandStacks = hand.filter(cardStack => 
            useFloorStore.getState().canPlayOnFloor(cardStack, gameState.currentFloor) && (cardStack.stack ?? 0) > 0
        );
        if (playableHandStacks.length === 0) return null;
        
        const evaluableCards = playableHandStacks.map(stack => ({...stack, stack:1, instanceId: `eval-${stack.instanceId}`}));
        evaluableCards.sort((a, b) => balancedStrategy.evaluateProposal(b, gameState) - balancedStrategy.evaluateProposal(a, gameState));
        
        const bestCardToPropose = evaluableCards[0]; 
        if (!bestCardToPropose) return null;

        // Strategy returns a CardData array (effectively definitions of cards to play)
        // based on the best evaluated card type from available hand stacks.
        const originalHandStackDetails = hand.find(s => s.id === bestCardToPropose.id);
        logAIAction(`BalancedSelectProposal: Strategized to propose [${originalHandStackDetails?.name ?? 'Unknown Card'}] from ${playableHandStacks.length} playable stacks.`);
        // Return a CardData (definition-like) representation of the chosen card type.
        // The actual instance will be sourced from hand in aiPlayTurn.
        return originalHandStackDetails ? [deepCopy(originalHandStackDetails)] : null; 
    },
    shouldAcceptProposal: (opponentProposal, gameState) => {
        if (!opponentProposal || opponentProposal.length === 0) return false; 
        const primaryOpponentCard = opponentProposal[0]; 
        const proposalValue = balancedStrategy.evaluateProposal(primaryOpponentCard, gameState);
        const isGoodEnough = proposalValue > -BALANCE_THRESHOLD * 0.75; 
        const decision = isGoodEnough && Math.random() < 0.8; 
        logAIAction(`BalancedShouldAccept: Opponent's ${primaryOpponentCard.name}, Value=${proposalValue.toFixed(1)}, Accept=${decision}`);
        return decision;
    },
    selectCounterProposal: (hand, opponentProposal, gameState) => {
        if (hand.length === 0 || !opponentProposal || opponentProposal.length === 0) return null;
        const playableHandStacks = hand.filter(cardStack =>
            useFloorStore.getState().canPlayOnFloor(cardStack, gameState.currentFloor) && (cardStack.stack ?? 0) > 0
        );
        if (playableHandStacks.length === 0) return null;

        const evaluableCards = playableHandStacks.map(stack => ({...stack, stack:1, instanceId: `eval-${stack.instanceId}`}));
        const primaryOpponentCard = opponentProposal[0];
        const opponentValue = balancedStrategy.evaluateProposal(primaryOpponentCard, gameState);
        evaluableCards.sort((a, b) => balancedStrategy.evaluateProposal(b, gameState) - balancedStrategy.evaluateProposal(a, gameState));
        const bestCounterCard = evaluableCards.find(card => balancedStrategy.evaluateProposal(card, gameState) > opponentValue + 1.0); 
        
        if (!bestCounterCard) return null;
        const originalHandStackDetails = hand.find(s => s.id === bestCounterCard.id);
        logAIAction(`BalancedSelectCounter vs ${primaryOpponentCard.name}: Strategized [${originalHandStackDetails?.name ?? 'Unknown Card'}]`);
        return originalHandStackDetails ? [deepCopy(originalHandStackDetails)] : null;
    },
    shouldAcceptCounter: (aiOriginalProposal, opponentCounter, gameState) => {
        if (!aiOriginalProposal || aiOriginalProposal.length === 0 || !opponentCounter || opponentCounter.length === 0) return false;
        const primaryOriginal = aiOriginalProposal[0];
        const primaryCounter = opponentCounter[0];
        const originalValue = balancedStrategy.evaluateProposal(primaryOriginal, gameState);
        const counterValue = balancedStrategy.evaluateProposal(primaryCounter, gameState);
        const decision = counterValue >= originalValue - 2.0; 
        logAIAction(`BalancedShouldAcceptCounter: MyOrig=${primaryOriginal.name}, TheirCounter=${primaryCounter.name}, OrigVal=${originalValue.toFixed(1)}, CounterVal=${counterValue.toFixed(1)}, Accept=${decision}`);
        return decision;
    }
};
const aggressiveStrategy: AIStrategy = { ...balancedStrategy, name: "aggressive" }; // Placeholder

export type PendingAIAction =
    | { type: 'propose'; cardsToPropose: CardData[]; reason?: string; } 
    | { type: 'accept'; card: CardData; reason?: string; } 
    | { type: 'counter'; cardsToCounter: CardData[]; reason?: string; }
    | { type: 'pass'; reason?: string; }
    | { type: 'accept_counter'; card: CardData; reason?: string; } 
    | { type: 'reject_counter'; card: CardData; reason?: string; };

interface GameStateSnapshot {
    building: { currentNetScore: number };
    currentPlayer: Readonly<Player> | null; 
    currentFloor: number;
    floorState: FloorState | null; 
    difficultyLevel: string;
    deckSize: number; // Number of unique card definitions
    floorsRemaining: number;
}
type AIActionInternal =
    | { type: 'SET_THINKING'; thinking: boolean }
    | { type: 'SET_PENDING_ACTION'; action: PendingAIAction | null }
    | { type: 'SET_LAST_DECISION'; timestamp: number; action: string; details?: string }
    | { type: 'SET_STRATEGY'; strategy: AIStrategy }
    | { type: 'SET_DIFFICULTY_LEVEL'; level: string };

interface AIStoreState {
    strategy: AIStrategy;
    difficultyLevel: string; 
    isAIThinking: boolean;
    pendingAIAction: PendingAIAction | null; 
    lastDecision: { timestamp: number; action: string; details?: string };
    setStrategy: (strategyName: string) => void;
    setDifficultyLevel: (level: string) => void;
    aiPlayTurn: () => Promise<void>; 
    aiMakeProposalDecision: (gameState: GameStateSnapshot) => PendingAIAction;
    aiRespondToProposalDecision: (gameState: GameStateSnapshot) => PendingAIAction;
    aiDecideOnCounterDecision: (gameState: GameStateSnapshot) => PendingAIAction;
    dispatch: (action: AIActionInternal) => void; 
    getGameStateSnapshot: () => GameStateSnapshot;
}

// Corrected Omit for defaultAIStateValues
type AIDefaultStateKeys = 
    'setStrategy' | 'setDifficultyLevel' | 'aiPlayTurn' | 
    'aiMakeProposalDecision' | 'aiRespondToProposalDecision' | 'aiDecideOnCounterDecision' | 
    'dispatch' | 'getGameStateSnapshot';
const defaultAIStateValues: Omit<AIStoreState, AIDefaultStateKeys> = {
    strategy: balancedStrategy,
    difficultyLevel: 'normal',
    isAIThinking: false,
    pendingAIAction: null,
    lastDecision: { timestamp: 0, action: '', details: '' },
};

export const useAIStore = create<AIStoreState>()(
    immer((set, get) => ({
        ...defaultAIStateValues,
        dispatch: (action) => {
            set(state => {
                switch (action.type) {
                    case 'SET_THINKING': state.isAIThinking = action.thinking; if (!action.thinking) state.pendingAIAction = null; break;
                    case 'SET_PENDING_ACTION': state.pendingAIAction = action.action; break;
                    case 'SET_LAST_DECISION': state.lastDecision = { timestamp: action.timestamp, action: action.action, details: action.details }; break;
                    case 'SET_STRATEGY': state.strategy = action.strategy; break;
                    case 'SET_DIFFICULTY_LEVEL': state.difficultyLevel = action.level; break;
                    default: logWarn(`Unhandled AIActionInternal type in dispatch`, 'AI State');
                }
            })
        },
        setStrategy: (strategyName) => {
            const normalizedName = strategyName.toLowerCase();
            let newStrategy = balancedStrategy;
            if (normalizedName === 'aggressive') newStrategy = aggressiveStrategy;
            if (get().strategy.name !== newStrategy.name) {
                get().dispatch({ type: 'SET_STRATEGY', strategy: newStrategy });
                logAIAction(`Strategy set to ${newStrategy.name}`);
            }
        },
        setDifficultyLevel: (level) => {
            const normalizedLevel = level.toLowerCase();
            if (['easy', 'normal', 'hard'].includes(normalizedLevel) && get().difficultyLevel !== normalizedLevel) {
                get().dispatch({ type: 'SET_DIFFICULTY_LEVEL', level: normalizedLevel });
                logAIAction(`Difficulty set to ${normalizedLevel}`);
            } else if (!['easy', 'normal', 'hard'].includes(normalizedLevel)) {
                logWarn(`Invalid AI difficulty level: ${level}`, 'AI Config');
            }
        },
        aiPlayTurn: async (): Promise<void> => {
            const turnStartTime = Date.now();
            const { getGameStateSnapshot, dispatch, strategy, aiMakeProposalDecision, aiRespondToProposalDecision, aiDecideOnCounterDecision } = get();

            if (get().isAIThinking) { logWarn('AI Turn: called while already thinking.'); return; }
            dispatch({ type: 'SET_THINKING', thinking: true });
            logAIAction(`⚙️ AI Turn START (Strategy: ${strategy.name}, Difficulty: ${get().difficultyLevel})`);

            try {
                await new Promise(resolve => setTimeout(resolve, AI_INTERNAL_THINKING_DELAY_MS));

                const liveGameFlowState = useGameFlowStore.getState();
                if (liveGameFlowState.gamePhase !== GamePhase.Playing || !liveGameFlowState.isAiTurn) {
                    logWarn(`AI Turn Aborted (Post-Think): Not playing or not AI turn.`); dispatch({ type: 'SET_THINKING', thinking: false }); return;
                }
                const gameStateSnapshot = getGameStateSnapshot();
                if (!gameStateSnapshot.currentPlayer || gameStateSnapshot.currentPlayer.type !== PlayerType.AI || !gameStateSnapshot.floorState) {
                    logError("AI Turn Error (Post-Think): Invalid snapshot or not AI player.", { snapshot: gameStateSnapshot }); dispatch({ type: 'SET_THINKING', thinking: false }); return;
                }
                if (gameStateSnapshot.currentFloor !== useFloorStore.getState().currentFloor) {
                    logWarn(`AI Turn Aborted (Post-Think): Floor changed.`); dispatch({ type: 'SET_THINKING', thinking: false }); return;
                }

                let decision: PendingAIAction;
                const { proposalA, proposalB } = gameStateSnapshot.floorState;
                const leadPlayer = usePlayersStore.getState().getLeadPlayer(gameStateSnapshot.currentFloor);
                const isAILeadPlayer = gameStateSnapshot.currentPlayer.id === leadPlayer?.id;

                if (isAILeadPlayer && !proposalA && !proposalB) { 
                    decision = aiMakeProposalDecision(gameStateSnapshot);
                } else if (!isAILeadPlayer && (proposalA || proposalB) && !(proposalA && proposalB)) { 
                    decision = aiRespondToProposalDecision(gameStateSnapshot);
                } else if (isAILeadPlayer && proposalA && proposalB) { 
                    decision = aiDecideOnCounterDecision(gameStateSnapshot);
                } else {
                    logWarn(`AI Turn: Unhandled game state. AI will pass. Lead:${isAILeadPlayer}, PropA:${!!proposalA}, PropB:${!!proposalB}`, 'AI Logic');
                    decision = { type: 'pass', reason: 'Unhandled game state' };
                }
                
                dispatch({ type: 'SET_PENDING_ACTION', action: deepCopy(decision) });
                await new Promise(resolve => setTimeout(resolve, AI_INTERNAL_SHOW_ACTION_DELAY_MS));
                
                const gameFlowStateBeforeExecute = useGameFlowStore.getState(); // Re-check state
                if (gameFlowStateBeforeExecute.gamePhase !== GamePhase.Playing || !gameFlowStateBeforeExecute.isAiTurn || useFloorStore.getState().currentFloor !== gameStateSnapshot.currentFloor || JSON.stringify(get().pendingAIAction) !== JSON.stringify(decision)) {
                    logWarn(`AI Action Execution Aborted: State changed during AI delay.`); dispatch({ type: 'SET_THINKING', thinking: false }); return;
                }

                const gameFlowActions = useGameFlowStore.getState();
                const playerStoreActions = usePlayersStore.getState(); // For setAICards...
                const aiPlayerName = gameStateSnapshot.currentPlayer?.name ?? "AI";
                const localLogGameAction = (message: string) => gameFlowActions.logAction(`AI (${aiPlayerName}): ${message}`);

                switch (decision.type) {
                    case 'propose':
                        if (decision.cardsToPropose?.length && gameStateSnapshot.currentPlayer?.hand) {
                            const basketItems: ProposalBasketItem[] = [];
                            decision.cardsToPropose.forEach(cardDefData => { // These are CardData from strategy
                                const handStack = gameStateSnapshot.currentPlayer!.hand.find(
                                    stack => stack.id === cardDefData.id && (stack.stack ?? 0) > 0
                                );
                                if (handStack) {
                                    basketItems.push({ definitionId: cardDefData.id, count: 1, sourceHandInstanceId: handStack.instanceId });
                                } else { logWarn(`AI wants to propose ${cardDefData.name} but no corresponding stack found/empty in hand.`, "AI Execute");}
                            });
                            if (basketItems.length > 0) {
                                playerStoreActions.setAICardsForProposal(basketItems);
                                localLogGameAction(`Proposes (basket set)`);
                                gameFlowActions.proposeCard();
                            } else { localLogGameAction("Had no valid cards to propose from strategy choice, passing."); gameFlowActions.passProposal(); }
                        } else { logError("AI propose action missing cards or AI hand undefined.", undefined, "AI Execute"); gameFlowActions.passProposal(); }
                        break;
                    case 'counter':
                         if (decision.cardsToCounter?.length && gameStateSnapshot.currentPlayer?.hand) {
                            const basketItems: ProposalBasketItem[] = [];
                             decision.cardsToCounter.forEach(cardDefData => {
                                const handStack = gameStateSnapshot.currentPlayer!.hand.find(
                                    stack => stack.id === cardDefData.id && (stack.stack ?? 0) > 0
                                );
                                if (handStack) {
                                    basketItems.push({ definitionId: cardDefData.id, count: 1, sourceHandInstanceId: handStack.instanceId });
                                } else { logWarn(`AI wants to counter with ${cardDefData.name} but no corresponding stack found/empty in hand.`, "AI Execute");}
                            });
                            if (basketItems.length > 0) {
                                playerStoreActions.setAICardsForCounterProposal(basketItems);
                                localLogGameAction(`Counters (basket set)`);
                                gameFlowActions.counterPropose();
                            } else { localLogGameAction("Had no valid cards to counter with from strategy choice, passing."); gameFlowActions.passProposal(); }
                        } else { logError("AI counter action missing cards or AI hand undefined.", undefined, "AI Execute"); gameFlowActions.passProposal(); }
                        break;
                    case 'accept': localLogGameAction(`Accepts ${decision.card?.name ?? 'proposal'}`); gameFlowActions.acceptProposal(); break;
                    case 'accept_counter': localLogGameAction(`Accepts counter-offer of ${decision.card?.name ?? 'proposal'}`); gameFlowActions.acceptProposal(); break;
                    case 'reject_counter': localLogGameAction(`Rejects counter-offer (${decision.card?.name}). Passing to mediator.`); gameFlowActions.passProposal(); break;
                    case 'pass': localLogGameAction(`Passes. Reason: ${decision.reason ?? 'Strategy decision'}`); gameFlowActions.passProposal(); break;
                }
                // ... (setLastDecision and finally block) ...
                 let details = decision.reason ?? (('cardsToPropose' in decision && decision.cardsToPropose) ? decision.cardsToPropose.map(c=>c.name).join(', ') : 
                                                   ('cardsToCounter' in decision && decision.cardsToCounter) ? decision.cardsToCounter.map(c=>c.name).join(', ') : 
                                                   ('card' in decision && decision.card) ? decision.card.name : '');
                dispatch({ type: 'SET_LAST_DECISION', timestamp: Date.now(), action: decision.type, details });

            } catch (error) { 
                 logError(`Error in AI turn: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined, 'AI Execute');
                try { 
                    logWarn("AI attempting to pass due to an error in its turn.", undefined, "AI Execute");
                    useGameFlowStore.getState().passProposal(); 
                } catch (e) { 
                    logError(`CRITICAL: AI error recovery (pass) failed: ${e}`, undefined, "AI Execute");
                }
            } finally { 
                dispatch({ type: 'SET_THINKING', thinking: false });
                logAIAction(`⚙️ AI Turn END (Duration: ${Date.now() - turnStartTime}ms)`);
            }
        },
        aiMakeProposalDecision: (gameStateSnapshot) => {
            const { strategy } = get();
            const aiHandForStrategy = gameStateSnapshot.currentPlayer?.hand ? deepCopy(gameStateSnapshot.currentPlayer.hand) : [];
            const cardsChosen = strategy.selectInitialProposal(aiHandForStrategy, gameStateSnapshot);
            if (cardsChosen?.length) {
                return { type: 'propose', cardsToPropose: cardsChosen, reason: 'Strategic selection' };
            }
            return { type: 'pass', reason: aiHandForStrategy.length === 0 ? 'No cards' : 'No suitable proposal' };
        },
        aiRespondToProposalDecision: (gameStateSnapshot) => {
            const { strategy } = get();
            const aiHandForStrategy = gameStateSnapshot.currentPlayer?.hand ? deepCopy(gameStateSnapshot.currentPlayer.hand) : [];
            const floorData = gameStateSnapshot.floorState;
            if (!floorData || !gameStateSnapshot.currentPlayer) return { type: 'pass', reason: 'Missing data' };
            const opponentProposalArray = usePlayersStore.getState().isPlayerA(gameStateSnapshot.currentPlayer) ? floorData.proposalB : floorData.proposalA;
            if (!opponentProposalArray?.length) return { type: 'pass', reason: 'No opponent proposal' };
            
            const opponentCopies = opponentProposalArray.map(c => deepCopy(c as CardData)); // Ensure type for strategy
            if (strategy.shouldAcceptProposal(opponentCopies, gameStateSnapshot)) {
                return { type: 'accept', card: opponentCopies[0], reason: 'Acceptable' };
            }
            const cardsToCounterChosen = strategy.selectCounterProposal(aiHandForStrategy, opponentCopies, gameStateSnapshot);
            if (cardsToCounterChosen?.length) {
                return { type: 'counter', cardsToCounter: cardsToCounterChosen, reason: 'Better alternative' };
            }
            return { type: 'pass', reason: 'No good counter, not accepting' };
        },
        aiDecideOnCounterDecision: (gameStateSnapshot) => {
            const { strategy } = get();
            const floorData = gameStateSnapshot.floorState;
            if (!floorData || !gameStateSnapshot.currentPlayer) return { type: 'pass', reason: 'Missing data' };
            const aiIsPlayerA = usePlayersStore.getState().isPlayerA(gameStateSnapshot.currentPlayer);
            const aiOriginalProposal = (aiIsPlayerA ? floorData.proposalA : floorData.proposalB)?.map(c => deepCopy(c as CardData));
            const opponentCounter = (aiIsPlayerA ? floorData.proposalB : floorData.proposalA)?.map(c => deepCopy(c as CardData));
            if (!aiOriginalProposal?.length || !opponentCounter?.length) return { type: 'pass', reason: 'Missing proposals for counter decision' };
            
            if (strategy.shouldAcceptCounter(aiOriginalProposal, opponentCounter, gameStateSnapshot)) {
                return { type: 'accept_counter', card: opponentCounter[0], reason: 'Counter acceptable' };
            }
            return { type: 'reject_counter', card: opponentCounter[0], reason: 'Reject counter' };
        },
        getGameStateSnapshot: (): GameStateSnapshot => {
            const floorStoreState = useFloorStore.getState();
            const playerStoreState = usePlayersStore.getState();
            const buildingStoreState = useBuildingStore.getState();
            const aiStoreSelf = get();
            const currentPlayerFromStore = playerStoreState.getCurrentPlayer();
            const currentFloorStateFromStore = floorStoreState.getCurrentFloorState();
            
            return {
                building: { currentNetScore: buildingStoreState.getCurrentNetScore() },
                currentPlayer: currentPlayerFromStore ? deepCopy(currentPlayerFromStore) : null,
                currentFloor: floorStoreState.currentFloor,
                floorState: currentFloorStateFromStore ? deepCopy(currentFloorStateFromStore) : null, 
                difficultyLevel: aiStoreSelf.difficultyLevel,
                deckSize: playerStoreState.deckCardDefinitions.length, // Corrected
                floorsRemaining: MAX_STORIES > 0 ? Math.max(0, MAX_STORIES - floorStoreState.currentFloor + 1) : 0,
            };
        }
    }))
);