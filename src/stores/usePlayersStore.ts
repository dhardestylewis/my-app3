// src/stores/usePlayersStore.ts
// Corrected for TS4104 and added AI-specific actions for setting proposal counts.

"use client";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { arrayMove } from "@dnd-kit/sortable";
import {
    CardData,
    CardDefinition,
    PlayerRole,
    PlayerType,
    CardInstance,
} from "@/data/types";
import {
    MAX_RECALL_TOKENS,
    CARD_DEAL_INTERVAL_MS,
} from "@/data/constants"; 
import { getCardDefinitions } from "@/data/deckData";
import { logDebug, logError, logWarn } from "@/utils/logger";
import { v4 as uuidv4 } from 'uuid';
import { deepCopy } from "@/utils/deepCopy";

const STARTING_HAND_SIZE = 5; 
const PLAYER_A_INDEX = 0;
const PLAYER_B_INDEX = 1;
const HUMAN_PLAYER_ID = "human";
const AI_PLAYER_ID = "ai";
const LEAD_PLAYER_BLOCK_SIZE = 5;

export interface Player {
    id: string;
    name: string;
    type: PlayerType;
    role: PlayerRole;
    hand: CardInstance[]; 
    recallTokens: number;
    isLeadPlayer: boolean;
}

export interface ProposalBasketItem {
    definitionId: string;
    count: number;
    sourceHandInstanceId: string; // Which stack in hand it's from
}

export interface PlayersStoreState {
    /* State */
    players: Player[];
    currentPlayerIndex: number;
    deckCardDefinitions: Readonly<CardDefinition[]>;
    proposalCounts: Record<string, { definitionId: string, count: number }>;
    counterProposalCounts: Record<string, { definitionId: string, count: number }>;
    cardsBeingDealt: boolean; 
    currentScore: number; 

    /* Actions */
    initializePlayers: (humanPlayerRole: PlayerRole) => void;
    resetToDefaults: () => void;
    setCurrentPlayerIndex: (index: number) => void;

    cycleProposalCountForCard: (handCardInstanceId: string) => void;
    cycleCounterProposalCountForCard: (handCardInstanceId: string) => void;
    clearAllProposalCounts: () => void;
    clearAllCounterProposalCounts: () => void;
    clearAllSelectionsForCurrentPlayer: () => void;

    // New actions for AI to set its proposal/counter items
    setAICardsForProposal: (items: ProposalBasketItem[]) => void;
    setAICardsForCounterProposal: (items: ProposalBasketItem[]) => void;

    reorderHandCards: (playerIndex: number, activeId: string, overId: string | null) => void;
    drawCardInstanceToHandById: (playerIndex: number, definitionId: string) => CardInstance | undefined;
    addCardToHand: (playerIndex: number, cardInstance: CardInstance) => void; 
    playCardFromHand: (playerIndex: number, instanceIdOfStackInHand: string) => CardInstance | undefined; 
    decrementRecallToken: (playerIndex: number) => void;
    dealInitialCards: () => Promise<boolean>; 
    completeInitialDeal: () => void;
    logPlayerState: () => void;
    
    /* Getters / Selectors */
    getCurrentPlayer: () => Player | undefined;
    getLeadPlayer: (floorNumber: number) => Player | undefined;
    getRespondingPlayer: (floorNumber: number) => Player | undefined;
    isPlayerA: (player: Player) => boolean;
    getHumanPlayer: () => Player | undefined;
    getAIPlayer: () => Player | undefined;
    getCurrentProposalBasket: () => ProposalBasketItem[];
    getCurrentCounterProposalBasket: () => ProposalBasketItem[];
    getRemainingCards: () => CardInstance[]; 
    getPlayerById: (playerId: string) => Player | undefined;
    findCardInHandByInstanceId: (playerIndex: number, instanceId: string) => CardInstance | undefined;
}

const createPlayer = (id: string, type: PlayerType, role: PlayerRole, isDesignatedPlayerA: boolean): Player => ({
    id, name: type === PlayerType.Human ? `You (${role})` : `AI (${role})`, type, role, hand: [], recallTokens: MAX_RECALL_TOKENS, isLeadPlayer: isDesignatedPlayerA,
});
const determinePlayerSetup = (humanPlayerRole: PlayerRole): [Player, Player] => {
    const humanIsDeveloper = humanPlayerRole === PlayerRole.Developer;
    const aiRole = humanIsDeveloper ? PlayerRole.Community : PlayerRole.Developer;
    const humanIsPlayerA = Math.random() < 0.5; 
    const pAInfo = { id: humanIsPlayerA ? HUMAN_PLAYER_ID : AI_PLAYER_ID, type: humanIsPlayerA ? PlayerType.Human : PlayerType.AI, role: humanIsPlayerA ? humanPlayerRole : aiRole};
    const pBInfo = { id: !humanIsPlayerA ? HUMAN_PLAYER_ID : AI_PLAYER_ID, type: !humanIsPlayerA ? PlayerType.Human : PlayerType.AI, role: !humanIsPlayerA ? humanPlayerRole : aiRole};
    return [createPlayer(pAInfo.id, pAInfo.type, pAInfo.role, true), createPlayer(pBInfo.id, pBInfo.type, pBInfo.role, false)];
};

interface DefaultPlayersState { 
    players: Player[];
    currentPlayerIndex: number;
    deckCardDefinitions: Readonly<CardDefinition[]>; 
    proposalCounts: Record<string, { definitionId: string, count: number }>;
    counterProposalCounts: Record<string, { definitionId: string, count: number }>;
    cardsBeingDealt: boolean;
    currentScore: number; 
}

const getDefaultState = (): DefaultPlayersState => ({
    players: [], currentPlayerIndex: PLAYER_A_INDEX, deckCardDefinitions: [], 
    proposalCounts: {}, counterProposalCounts: {}, 
    cardsBeingDealt: false, currentScore: 0,
});

export const usePlayersStore = create<PlayersStoreState>()(
    immer((set, get) => {
        const _getPlayerByIndex = (state: PlayersStoreState | DefaultPlayersState, playerIndex: number, actionName: string): Player | null => { 
            if (playerIndex < 0 || playerIndex >= state.players.length || !state.players[playerIndex]) {
                logError(`[PlayersStore] Invalid playerIndex ${playerIndex} in ${actionName}. Players: ${state.players.length}.`);
                return null;
            }
            return state.players[playerIndex];
        };
        
        return {
            ...getDefaultState(),

            initializePlayers: (humanPlayerRole: PlayerRole): void => {
                logDebug(`[PlayersStore] Initializing players. Human role: ${humanPlayerRole}`);
                try {
                    const orderedPlayers = determinePlayerSetup(humanPlayerRole);
                    const allCardDefinitions = getCardDefinitions(); 
                    if (!allCardDefinitions || allCardDefinitions.length === 0) {
                        logError("[PlayersStore] Init failed: Card definitions empty.");
                        set(getDefaultState()); return;
                    }
                    set(state => {
                        Object.assign(state, getDefaultState()); 
                        state.players = orderedPlayers;
                        // Corrected for TS4104: Immer handles making this part of the state immutable.
                        // The type `Readonly<CardDefinition[]>` on `deckCardDefinitions` is the primary guard.
                        state.deckCardDefinitions = deepCopy(allCardDefinitions); 
                        state.currentPlayerIndex = PLAYER_A_INDEX; 
                        state.cardsBeingDealt = true; 
                    });
                    logDebug(`[PlayersStore] Players initialized. Loaded ${allCardDefinitions.length} card defs. Starting deal.`);
                    get().logPlayerState();
                } catch (error) {
                    logError("[PlayersStore] Critical error during player initialization.", error instanceof Error ? error : new Error(String(error)));
                    set(getDefaultState());
                }
            },
            resetToDefaults: (): void => set(getDefaultState()),
            setCurrentPlayerIndex: (index: number): void => {
                const numPlayers = get().players.length;
                if (index < 0 || index >= numPlayers) { logError(`[PlayersStore] Invalid index ${index} for setCurrentPlayerIndex.`); return; }
                set(state => {
                    if (_getPlayerByIndex(state, index, "setCurrentPlayerIndex")) {
                        state.currentPlayerIndex = index;
                        state.proposalCounts = {}; state.counterProposalCounts = {};
                    }
                });
            },

            cycleProposalCountForCard: (handCardInstanceId: string): void => { /* ... (as in F.3 refactor) ... */ 
                set(state => {
                    const player = _getPlayerByIndex(state, state.currentPlayerIndex, "cycleProposalCountForCard");
                    if (!player) return;
                    const cardInHand = player.hand.find(c => c.instanceId === handCardInstanceId);
                    if (!cardInHand || !cardInHand.stack || cardInHand.stack <= 0) {
                        logWarn(`[PlayersStore] Card stack ${handCardInstanceId} not found/empty in hand for proposal count.`);
                        return;
                    }
                    const currentEntry = state.proposalCounts[handCardInstanceId];
                    const currentCount = currentEntry ? currentEntry.count : 0;
                    const maxCount = cardInHand.stack; 
                    let newCount = (currentCount + 1) % (maxCount + 1);
                    if (newCount === 0) delete state.proposalCounts[handCardInstanceId];
                    else state.proposalCounts[handCardInstanceId] = { definitionId: cardInHand.id, count: newCount };
                    state.counterProposalCounts = {}; 
                    get().logPlayerState();
                });
            },
            cycleCounterProposalCountForCard: (handCardInstanceId: string): void => { /* ... (as in F.3 refactor) ... */ 
                set(state => {
                    const player = _getPlayerByIndex(state, state.currentPlayerIndex, "cycleCounterProposalCountForCard");
                    if (!player) return;
                    const cardInHand = player.hand.find(c => c.instanceId === handCardInstanceId);
                    if (!cardInHand || !cardInHand.stack || cardInHand.stack <= 0) {
                        logWarn(`[PlayersStore] Card stack ${handCardInstanceId} not found/empty for counter count.`);
                        return;
                    }
                    const currentEntry = state.counterProposalCounts[handCardInstanceId];
                    const currentCount = currentEntry ? currentEntry.count : 0;
                    const maxCount = cardInHand.stack;
                    let newCount = (currentCount + 1) % (maxCount + 1);
                    if (newCount === 0) delete state.counterProposalCounts[handCardInstanceId];
                    else state.counterProposalCounts[handCardInstanceId] = { definitionId: cardInHand.id, count: newCount };
                    state.proposalCounts = {};
                    get().logPlayerState();
                });
            },
            clearAllProposalCounts: (): void => set(state => { state.proposalCounts = {}; }),
            clearAllCounterProposalCounts: (): void => set(state => { state.counterProposalCounts = {}; }),
            clearAllSelectionsForCurrentPlayer: (): void => { get().clearAllProposalCounts(); get().clearAllCounterProposalCounts(); },

            // F.3 - New actions for AI to set proposals
            setAICardsForProposal: (items: ProposalBasketItem[]): void => {
                set(state => {
                    state.proposalCounts = {}; // Clear existing
                    items.forEach(item => {
                        // Basic validation: AI should only propose cards it has enough of.
                        // This might need more robust checks against AI's hand state.
                        state.proposalCounts[item.sourceHandInstanceId] = { definitionId: item.definitionId, count: item.count };
                    });
                    state.counterProposalCounts = {}; // Clear other selection
                    logDebug("[PlayersStore] AI proposal counts set by setAICardsForProposal.", state.proposalCounts);
                });
            },
            setAICardsForCounterProposal: (items: ProposalBasketItem[]): void => {
                set(state => {
                    state.counterProposalCounts = {}; // Clear existing
                    items.forEach(item => {
                        state.counterProposalCounts[item.sourceHandInstanceId] = { definitionId: item.definitionId, count: item.count };
                    });
                    state.proposalCounts = {}; // Clear other selection
                    logDebug("[PlayersStore] AI counter-proposal counts set by setAICardsForCounterProposal.", state.counterProposalCounts);
                });
            },

            reorderHandCards: (playerIndex, activeId, overId) => { /* ... (as in F.3 refactor) ... */ 
                set(state => {
                    const player = _getPlayerByIndex(state, playerIndex, "reorderHandCards");
                    if (!player || !overId) return;
                    const oldIndex = player.hand.findIndex(card => card.instanceId === activeId);
                    const newIndex = player.hand.findIndex(card => card.instanceId === overId);
                    if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                        player.hand = arrayMove(player.hand, oldIndex, newIndex);
                    }
                });
            },
            drawCardInstanceToHandById: (playerIndex, definitionId) => { /* ... (as in F.3 refactor) ... */ 
                let newInstanceClone: CardInstance | undefined;
                set(state => {
                    const player = _getPlayerByIndex(state, playerIndex, "drawCardInstanceToHandById");
                    if (!player) return;
                    const cardDef = state.deckCardDefinitions.find(def => def.id === definitionId);
                    if (!cardDef) { logError(`[PlayersStore] Card definition ID '${definitionId}' not found.`); return; }
                    const newInstanceBase: CardInstance = { ...deepCopy(cardDef), instanceId: `${cardDef.id}-${uuidv4()}`, ownerId: player.id, stack: 1, };
                    const existingStack = player.hand.find(c => c.id === newInstanceBase.id); 
                    if (existingStack) {
                        existingStack.stack = (existingStack.stack || 1) + 1;
                        newInstanceClone = deepCopy(existingStack); 
                    } else {
                        player.hand.push(newInstanceBase); 
                        newInstanceClone = deepCopy(newInstanceBase);
                    }
                });
                return newInstanceClone; 
            },
            addCardToHand: (playerIndex, cardInstance) => { /* ... (as in F.3 refactor) ... */ 
                 if (!cardInstance?.id || !cardInstance.instanceId) { logError(`[PlayersStore] addCardToHand: Card instance invalid.`, cardInstance); return; }
                set(state => {
                    const player = _getPlayerByIndex(state, playerIndex, "addCardToHand");
                    if (!player) return;
                    const existingStack = player.hand.find(c => c.id === cardInstance.id); 
                    if (existingStack) {
                        existingStack.stack = (existingStack.stack || 1) + (cardInstance.stack || 1); 
                    } else {
                        player.hand.push({ ...cardInstance, stack: cardInstance.stack || 1 });
                    }
                });
            },
            playCardFromHand: (playerIndex, instanceIdOfStackInHand) => { /* ... (as in F.3 refactor) ... */ 
                let playedSingleInstanceClone: CardInstance | undefined;
                set(state => {
                    const player = _getPlayerByIndex(state, playerIndex, "playCardFromHand");
                    if (!player) return;
                    const stackIndex = player.hand.findIndex(card => card.instanceId === instanceIdOfStackInHand);
                    if (stackIndex === -1) { logError(`[PlayersStore] Card stack ${instanceIdOfStackInHand} not found in hand.`); return; }
                    const stackObjectInHand = player.hand[stackIndex];
                    if (!stackObjectInHand.stack || stackObjectInHand.stack < 1) { logError(`[PlayersStore] Stack ${stackObjectInHand.name} invalid count.`); player.hand.splice(stackIndex, 1); return; }
                    const singlePlayedCard: CardInstance = { ...stackObjectInHand, instanceId: `${stackObjectInHand.id}-${uuidv4()}`, stack: undefined, ownerId: player.id, };
                    playedSingleInstanceClone = deepCopy(singlePlayedCard); 
                    stackObjectInHand.stack!--; 
                    if (stackObjectInHand.stack <= 0) {
                        player.hand.splice(stackIndex, 1);
                        // If stack depleted, remove from counts
                        delete state.proposalCounts[instanceIdOfStackInHand];
                        delete state.counterProposalCounts[instanceIdOfStackInHand];
                    }
                });
                return playedSingleInstanceClone;
            },
            decrementRecallToken: (playerIndex) => { /* ... (as in F.3 refactor) ... */ 
                set(state => {
                    const player = _getPlayerByIndex(state, playerIndex, "decrementRecallToken");
                    if (player && player.recallTokens > 0) player.recallTokens--;
                    else if(player) logError(`[PlayersStore] Player ${player.id} no recall tokens.`);
                });
            },
            dealInitialCards: async () => { /* ... (as in F.3 refactor) ... */ 
                set(state => { state.cardsBeingDealt = true; });
                let success = true;
                try {
                    const numPlayers = get().players.length;
                    if (numPlayers === 0) throw new Error("No players for initial deal.");
                    const cardDefs = get().deckCardDefinitions;
                    if (cardDefs.length === 0) throw new Error("No card definitions for deal.");
                    for (let i = 0; i < STARTING_HAND_SIZE; i++) {
                        for (let pIdx = 0; pIdx < numPlayers; pIdx++) {
                            const player = get().players[pIdx];
                            if (!player) continue;
                            const randomDefIndex = Math.floor(Math.random() * cardDefs.length);
                            const selectedDef = cardDefs[randomDefIndex];
                            if (selectedDef) { get().drawCardInstanceToHandById(pIdx, selectedDef.id); await new Promise(r => setTimeout(r, CARD_DEAL_INTERVAL_MS)); }
                        }
                    }
                } catch (e) { success = false; logError('[PlayersStore] Error dealInitialCards:', e); } 
                finally { get().completeInitialDeal(); }
                return success;
            },
            completeInitialDeal: () => { /* ... (as in F.3 refactor) ... */ 
                if (get().cardsBeingDealt) { set(state => { state.cardsBeingDealt = false; }); get().logPlayerState(); }
            },
            logPlayerState: () => { /* ... (as in F.3 refactor, adjusted for counts) ... */ 
                const s = get();
                const playerDetails = s.players?.map((p, i) => { 
                    const handDetails = p?.hand?.map(c => `${c?.name}(StkID:${c?.instanceId?.slice(-4)})${c.stack && c.stack > 1 ? `x${c.stack}` : ''}`).join(', ') || 'Empty';
                    return `\n P${i}: ${p?.id?.slice(-4)} Hand(${p?.hand?.length}) [${handDetails}]`;
                }).join('');
                const proposalBasket = get().getCurrentProposalBasket();
                const counterBasket = get().getCurrentCounterProposalBasket();
                logDebug(`[PlayersStore State] CurrP: ${s.currentPlayerIndex}, Dealing: ${s.cardsBeingDealt}, DeckDefs: ${s.deckCardDefinitions.length}\nPropBasket: ${JSON.stringify(proposalBasket)}\nCounterBasket: ${JSON.stringify(counterBasket)}${playerDetails}`);
            },
            
            /* --- Getters --- */
            getCurrentPlayer: () => get().players[get().currentPlayerIndex],
            getLeadPlayer: (floorNum) => { /* ... (as in F.3 refactor) ... */ 
                const s = get(); if (s.players.length<2) return undefined; 
                return s.players[Math.ceil(floorNum / LEAD_PLAYER_BLOCK_SIZE) % 2 === 1 ? 0:1];
            },
            getRespondingPlayer: (floorNum) => { /* ... (as in F.3 refactor) ... */ 
                const s = get(); if (s.players.length<2) return undefined; 
                const lead = get().getLeadPlayer(floorNum); if(!lead) return undefined;
                return s.players.find(p => p.id !== lead.id);
            },
            isPlayerA: (player) => get().players[0]?.id === player.id,
            getHumanPlayer: () => get().players.find(p => p.type === PlayerType.Human),
            getAIPlayer: () => get().players.find(p => p.type === PlayerType.AI),
            
            getCurrentProposalBasket: (): ProposalBasketItem[] => { /* ... (as in F.3 refactor) ... */ 
                const { proposalCounts } = get();
                return Object.entries(proposalCounts).map(([sourceHandInstanceId, { definitionId, count }]) => ({
                    definitionId, count, sourceHandInstanceId,
                })).filter(item => item.count > 0);
            },
            getCurrentCounterProposalBasket: (): ProposalBasketItem[] => { /* ... (as in F.3 refactor) ... */ 
                const { counterProposalCounts } = get();
                return Object.entries(counterProposalCounts).map(([sourceHandInstanceId, { definitionId, count }]) => ({
                    definitionId, count, sourceHandInstanceId,
                })).filter(item => item.count > 0);
            },
            getRemainingCards: () => { /* ... (as in F.3 refactor) ... */ 
                const { players } = get();
                const cardsInHands: CardInstance[] = [];
                players.forEach(player => player?.hand?.forEach(stack => {
                    for (let i = 0; i < (stack.stack || 1); i++) cardsInHands.push({...stack, instanceId: `${stack.instanceId}-dup-${i}-${uuidv4().slice(0,4)}`, stack: undefined});
                }));
                return cardsInHands;
            },
            getPlayerById: (id) => get().players.find(p => p.id === id),
            findCardInHandByInstanceId: (idx, id) => get().players[idx]?.hand.find(c => c.instanceId === id)
        };
    })
);

export { PlayerRole };