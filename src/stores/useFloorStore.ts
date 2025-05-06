// stores/useFloorStore.ts
// Reviewed for E.2: Ensuring validateRecall is robust for the improved recall UX.

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { CardData, FloorState, FloorStatus, Committer, PlayerRole, CardDefinition } from "@/data/types";
import { MAX_STORIES, RECALL_MAX_FLOOR } from '@/data/constants';
import { usePlayersStore } from './usePlayersStore';
import { useBuildingStore } from './useBuildingStore';
import { logDebug, logError, logWarn, logInfo } from '@/utils/logger';
import { deepCopy } from '@/utils/deepCopy';

const logFloorAction = (message: string): void => {
    logDebug(message, 'Floors');
};

export interface FloorStoreState {
    // State
    floors: FloorState[];
    currentFloor: number;

    // Actions
    resetFloors: () => void;
    initializeFloors: (maxFloors?: number) => void;
    setCurrentFloor: (floorNumber: number) => void;
    setProposal: (isPlayerA: boolean, cards: CardData[] | CardData) => void;
    clearCurrentFloorProposals: () => void;
    finalizeFloor: (
        floorNumber: number,
        status: FloorStatus,
        winnerCard?: CardData,
        committedBy?: Committer | null
    ) => void;
    validateRecall: (floorNumber: number) => { isValid: boolean; reason: string };
    applyRecall: (floorNumber: number) => {
        recalledCard?: Readonly<CardData>;
        ownerId?: string;
    };
    resetToDefaults: () => void;

    // Getters
    getCurrentFloorState: () => FloorState | undefined;
    getFloorState: (floorNumber: number) => FloorState | undefined;
    getNextPendingFloor: () => number;
    canPlayOnFloor: (card: CardData | CardDefinition, floorNumber: number) => boolean;
}

const createInitialFloors = (maxFloors: number = MAX_STORIES): FloorState[] => {
    logDebug(`Creating initial state for ${maxFloors} floors.`, 'Floors Init');
    return Array.from({ length: maxFloors }, (_, i) => ({
        floorNumber: i + 1,
        status: FloorStatus.Pending,
        proposalA: undefined,
        proposalB: undefined,
        winnerCard: undefined,
        committedBy: null,
        units: 1,
    }));
};

const getDefaultState = (): { floors: FloorState[]; currentFloor: number } => ({
    floors: createInitialFloors(),
    currentFloor: 1,
});

export const useFloorStore = create<FloorStoreState>()(
    immer((set, get) => ({
        ...getDefaultState(),

        resetFloors: () => {
            logDebug(`Resetting floor store state.`, 'Floors Reset');
            set(getDefaultState());
        },

        initializeFloors: (maxFloors = MAX_STORIES) => {
            logDebug(`Initializing floors state (max: ${maxFloors}).`, 'Floors Init');
            set({ floors: createInitialFloors(maxFloors), currentFloor: 1 });
        },

        resetToDefaults: () => {
            get().resetFloors();
        },

        setCurrentFloor: (floorNumber) => {
            if (floorNumber < 1 || floorNumber > MAX_STORIES) {
                logError(`Attempted to set invalid current floor: ${floorNumber}`, undefined, 'Floors');
                return;
            }
            if (floorNumber !== get().currentFloor) {
                logFloorAction(`Setting current floor: ${floorNumber}`);
                set({ currentFloor: floorNumber });
            }
        },

        setProposal: (isPlayerA: boolean, cards: CardData[] | CardData) => {
            const floorNum = get().currentFloor;
            const idx = get().floors.findIndex(f => f.floorNumber === floorNum);

            if (idx === -1) {
                logError(`Floor ${floorNum} not found for setProposal`, undefined, 'Floors');
                return;
            }
            
            const currentFloorState = get().floors[idx];
            if (currentFloorState.status !== FloorStatus.Pending && currentFloorState.status !== FloorStatus.Reopened) {
                logWarn(`Cannot propose on floor ${floorNum} (status=${currentFloorState.status})`, undefined, 'Floors');
                return;
            }

            const existingProposal = isPlayerA ? currentFloorState.proposalA : currentFloorState.proposalB;
            if (existingProposal?.length) {
                logWarn(`Proposal slot already filled for floor ${floorNum} by ${isPlayerA ? "Player A" : "Player B"}`, undefined, 'Floors');
                return;
            }

            const cardsArray = (Array.isArray(cards) ? cards : [cards]).map(card => deepCopy(card));
            
            set(state => {
                const draftFloor = state.floors.find(f => f.floorNumber === floorNum);
                if (draftFloor) {
                    if (isPlayerA) draftFloor.proposalA = cardsArray;
                    else draftFloor.proposalB = cardsArray;
                } else {
                     logError(`Floor ${floorNum} not found in draft for setProposal during set operation.`, undefined, 'Floors');
                }
            });

            const cardNames = cardsArray.map(c => c.name).join(', ');
            logFloorAction(`Player ${isPlayerA ? "A" : "B"} proposed ${cardsArray.length} card(s) [${cardNames}] for floor ${floorNum}`);
        },

        clearCurrentFloorProposals: () => {
            const currentFloorNum = get().currentFloor;
            logFloorAction(`Clearing proposals for current floor: ${currentFloorNum}`);
            set(state => {
                const floor = state.floors.find(f => f.floorNumber === currentFloorNum);
                if (floor) {
                    if (floor.proposalA?.length || floor.proposalB?.length) {
                        floor.proposalA = undefined;
                        floor.proposalB = undefined;
                        logFloorAction(`Proposals cleared for floor ${currentFloorNum}.`);
                    }
                } else {
                    logError(`Cannot clear proposals, floor ${currentFloorNum} not found.`, undefined, 'Floors');
                }
            });
        },

        finalizeFloor: (floorNumber, status, winnerCard, committedBy = null) => {
            logFloorAction(`Finalizing floor ${floorNumber}: Status=${status}, Card=${winnerCard?.name ?? 'N/A'}, By=${committedBy ?? 'N/A'}`);
            const cardToStoreInFloorState = winnerCard ? deepCopy(winnerCard) : undefined;

            set(state => {
                const floor = state.floors.find(f => f.floorNumber === floorNumber);
                if (!floor) {
                    logError(`finalizeFloor failed: Floor ${floorNumber} not found.`, undefined, 'Floors');
                    return;
                }
                floor.status = status;
                floor.winnerCard = cardToStoreInFloorState;
                floor.committedBy = committedBy;
                if (status === FloorStatus.Agreed || status === FloorStatus.Skipped) {
                    floor.proposalA = undefined;
                    floor.proposalB = undefined;
                }
            });

            if (status === FloorStatus.Agreed && cardToStoreInFloorState?.instanceId) {
                const buildingStore = useBuildingStore.getState();
                const playersStore = usePlayersStore.getState();
                let ownerRole: PlayerRole | 'neutral' = 'neutral';

                if (committedBy === Committer.PlayerA || committedBy === Committer.PlayerB) {
                    const playerIndex = committedBy === Committer.PlayerA ? 0 : 1;
                    ownerRole = playersStore.players[playerIndex]?.role ?? 'neutral';
                }
                
                const unitsForSqFtCalc = cardToStoreInFloorState.units ?? get().getFloorState(floorNumber)?.units ?? 1;
                logDebug(`Calling addCardToFloor for ${cardToStoreInFloorState.name} on floor ${floorNumber} with ${unitsForSqFtCalc} units. Card baseSqft expected: ${cardToStoreInFloorState.baseSqft}`, "Floors");
                buildingStore.addCardToFloor(floorNumber, cardToStoreInFloorState, unitsForSqFtCalc, ownerRole as string);

            } else if (status === FloorStatus.Agreed && !cardToStoreInFloorState?.instanceId) {
                logWarn(`Floor ${floorNumber} finalized as Agreed, but winnerCard (or its instanceId) is missing. Sqft not added.`, 'Floors');
            }
        },

        validateRecall: (floorNumber: number): { isValid: boolean; reason: string } => {
            const { floors, currentFloor: currentNegotiationFloor } = get(); // currentFloor is the one being negotiated
            const { getCurrentPlayer, players } = usePlayersStore.getState();
            const playerState = getCurrentPlayer(); // This gets the current active player for the turn

            // UI should separately check if it's a human player's turn / not AI turn.
            // This validation focuses on game state rules for recall.
            if (!playerState) {
                return { isValid: false, reason: "No active player." };
            }
            if (playerState.recallTokens <= 0) {
                return { isValid: false, reason: "You have no recall tokens left." };
            }
            
            const floorToRecall = floors.find(f => f.floorNumber === floorNumber);
            if (!floorToRecall) {
                return { isValid: false, reason: `Floor ${floorNumber} data not found.` };
            }

            if (RECALL_MAX_FLOOR !== undefined && floorNumber >= RECALL_MAX_FLOOR) {
                return { isValid: false, reason: `Recall is only usable up to floor ${RECALL_MAX_FLOOR - 1}.` };
            }
            if (floorToRecall.status !== FloorStatus.Agreed) {
                return { isValid: false, reason: `Floor ${floorNumber} has not been agreed upon.` };
            }
            if (!floorToRecall.winnerCard?.id) {
                return { isValid: false, reason: `Floor ${floorNumber} has no placed card to recall.` };
            }
            // Cannot recall the floor currently under negotiation, even if it was previously agreed and then reopened by AI/mediation for some reason.
            // Or more simply, you can't recall the floor you just built or are about to build. Recall is for *past* floors.
            // This is implicitly handled as a reopened floor won't be status 'Agreed'.
            // However, an explicit check might be:
            // if (floorNumber === currentNegotiationFloor && floorToRecall.status === FloorStatus.Agreed) {
            //    // This scenario should ideally not happen if game flow is correct.
            //    return { isValid: false, reason: "Cannot recall the current negotiation floor."};
            // }

            return { isValid: true, reason: "" }; // All checks passed
        },

        applyRecall: (floorNumber: number): { recalledCard?: Readonly<CardData>, ownerId?: string } => {
            let result: { recalledCard?: Readonly<CardData>, ownerId?: string } = {};
            const floorStateFromStore = get().getFloorState(floorNumber); 
            
            // Validate again before applying, though UI should gate this.
            const validation = get().validateRecall(floorNumber);
            if (!validation.isValid) {
                logWarn(`applyRecall blocked for floor ${floorNumber}: ${validation.reason}`, undefined, 'Floors Recall');
                // Potentially inform GameFlowStore or UI about failure
                return { reason: validation.reason } as any; // Or a more structured error
            }

            if (!floorStateFromStore) { // Should be caught by validateRecall, but as a safeguard
                logError(`applyRecall failed: Floor ${floorNumber} not found during apply phase.`, undefined, 'Floors Recall');
                return {};
            }
            // winnerCard check is also in validateRecall
            const cardToRemoveFromBuildingAndReturn = floorStateFromStore.winnerCard ? deepCopy(floorStateFromStore.winnerCard) : undefined;
            const originalCommitter = floorStateFromStore.committedBy;
            let ownerId: string | undefined = undefined;

            if (originalCommitter === Committer.PlayerA || originalCommitter === Committer.PlayerB) {
                const { players } = usePlayersStore.getState();
                ownerId = players[originalCommitter === Committer.PlayerA ? 0 : 1]?.id;
            }
            
            // Remove card from building store using its unique instanceId
            if (cardToRemoveFromBuildingAndReturn?.instanceId) {
                useBuildingStore.getState().removeCardFromFloor(floorNumber, cardToRemoveFromBuildingAndReturn.instanceId);
            } else {
                 logWarn(`Recall on floor ${floorNumber}: Winner card or its instanceId missing, nothing to remove from building store. Floor will still reopen.`, undefined, "Floors Recall");
            }

            set(state => {
                const floorToRecall = state.floors.find(f => f.floorNumber === floorNumber);
                if (floorToRecall) {
                    floorToRecall.status = FloorStatus.Reopened;
                    floorToRecall.winnerCard = undefined; 
                    floorToRecall.committedBy = null;
                    floorToRecall.proposalA = undefined;
                    floorToRecall.proposalB = undefined;
                    floorToRecall.units = 1; 
                }
            });
            
            result = { recalledCard: cardToRemoveFromBuildingAndReturn, ownerId };
            logInfo(`Floor ${floorNumber} recalled and reopened. Card '${cardToRemoveFromBuildingAndReturn?.name}' returned to owner ID ${ownerId}.`, "Floors Recall")
            return result;
        },

        getCurrentFloorState: (): FloorState | undefined => {
            const { floors, currentFloor } = get();
            return floors.find(f => f.floorNumber === currentFloor);
        },

        getFloorState: (floorNumber: number): FloorState | undefined => {
            return get().floors.find(f => f.floorNumber === floorNumber);
        },

        getNextPendingFloor: (): number => {
            const { floors, currentFloor } = get();
            const nextNegotiableFloor = floors.find(f => f.floorNumber > currentFloor && (f.status === FloorStatus.Pending || f.status === FloorStatus.Reopened));
            return nextNegotiableFloor ? nextNegotiableFloor.floorNumber : MAX_STORIES + 1;
        },

        canPlayOnFloor: (card: CardData | CardDefinition, floorNumber: number): boolean => {
            if (!card?.id) {
                logWarn('canPlayOnFloor: Invalid card data provided.', undefined, 'FloorStore Validation');
                return false;
            }
            if (floorNumber < 1 || floorNumber > MAX_STORIES) return false;

            if (card.requiresFloor?.length) {
                const allowed = card.requiresFloor.some(req => {
                    if (typeof req === 'string') {
                        if (req.toLowerCase() === 'ground') return floorNumber === 1;
                        if (req.toLowerCase() === 'roof') return floorNumber === MAX_STORIES;
                        logWarn(`Unknown string floor requirement: '${req}' for card ${card.id}`, undefined, 'FloorStore Validation');
                        return false;
                    }
                    return req === floorNumber;
                });
                if (!allowed) return false;
            }

            const floorData = get().floors.find(f => f.floorNumber === floorNumber);
            // Card can only be played on floors that are pending or reopened for negotiation.
            if (floorData && floorData.status !== FloorStatus.Pending && floorData.status !== FloorStatus.Reopened) return false;
            
            return true;
        },
    }))
);

export type { FloorState } from "@/data/types";