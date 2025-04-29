// stores/useFloorStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { CardData } from "@/data/types";
import { MAX_STORIES, RECALL_MAX_FLOOR } from '@/data/constants';
import { usePlayersStore } from './usePlayersStore';
import { useBuildingStore } from './useBuildingStore';
import { logDebug } from '@/utils/logger';

// Enums for clearer type safety
export enum FloorStatus {
  Pending = 'pending',      // Actively being negotiated or not yet started
  Agreed = 'agreed',        // Negotiation successful, card placed
  Skipped = 'skipped',      // Negotiation failed or passed, no card placed
  Reopened = 'reopened',    // Recalled, ready for renegotiation
}

export enum Committer {
  PlayerA = 'A',
  PlayerB = 'B',
  Auto = 'auto', // e.g., Mediator decision or automatic pass
  None = 'none',
}

export interface FloorState {
  floorNumber: number;
  status: FloorStatus;
  proposalA?: CardData;     // Player A's proposal for this floor
  proposalB?: CardData;     // Player B's proposal for this floor
  winnerCard?: CardData;    // The card agreed upon for this floor
  committedBy: Committer | null; // Who (or what) finalized the decision
  units: number;            // Typically 1, could change with future mechanics
}

interface FloorStoreState {
  // State
  floors: FloorState[];
  currentFloor: number;

  // Actions
  initializeFloors: () => void;
  setCurrentFloor: (floorNumber: number) => void;
  /** Sets a proposal card for the current floor for either Player A or Player B. Includes validation. */
  setProposal: (isPlayerA: boolean, card: CardData) => void;
   /** Clears proposals for the current floor. Useful for resetting state if needed. */
  clearCurrentFloorProposals: () => void;
  /** Finalizes the state of a specific floor (e.g., Agreed, Skipped). */
  finalizeFloor: (
    floorNumber: number,
    status: FloorStatus,
    winnerCard?: CardData,
    committedBy?: Committer | null
  ) => void;
  /** Checks if a recall action is valid for a given floor. */
  validateRecall: (floorNumber: number) => { isValid: boolean; reason: string };
   /** Applies the recall action, reopening a floor for negotiation. */
  applyRecall: (floorNumber: number) => {
    winnerCard?: CardData;
    committedBy?: Committer | null
  };

  // Getters
  getCurrentFloorState: () => FloorState | undefined;
  getFloorState: (floorNumber: number) => FloorState | undefined;
  getNextPendingFloor: () => number;
}

// Initialize with a default array of floors
const createInitialFloors = (): FloorState[] => {
  const initialFloors: FloorState[] = [];
  for (let i = 1; i <= MAX_STORIES; i++) {
    initialFloors.push({
      floorNumber: i,
      status: FloorStatus.Pending, // Start all floors as pending
      proposalA: undefined,
      proposalB: undefined,
      winnerCard: undefined,
      committedBy: null,
      units: 1,
    });
  }
  return initialFloors;
};


export const useFloorStore = create<FloorStoreState>()(
  immer((set, get) => ({
    // ===========================
    //         State
    // ===========================
    floors: createInitialFloors(),
    currentFloor: 1,

    // ===========================
    //         Actions
    // ===========================
    initializeFloors: () => {
      logDebug(`Initializing floors for a new game`, 'Floors');
      logDebug(`Creating ${MAX_STORIES} empty floors`, 'Floors');
      const newFloors = createInitialFloors();
      set({ floors: newFloors, currentFloor: 1 });
    },

    setCurrentFloor: (floorNumber) => {
      if (floorNumber < 1 || floorNumber > MAX_STORIES) {
        logDebug(`Invalid floor number ignored: ${floorNumber}`, 'Floors');
        console.error(`Attempted to set invalid current floor: ${floorNumber}`);
        return;
      }
      logFloorAction(`Moving to floor ${floorNumber}`);
      logDebug(`Setting current floor: ${floorNumber}`, 'Floors');
      set({ currentFloor: floorNumber });
    },

    /**
     * Sets a proposal card for the current floor after validation.
     * Ensures proposals are only set on pending/reopened floors
     * and that a player doesn't overwrite their existing proposal.
     */
    setProposal: (isPlayerA, card) => {
      logDebug(`Attempting setProposal: isPlayerA=${isPlayerA}, card=${card.name} (ID: ${card.id}), currentFloor=${get().currentFloor}`, 'Floors');

      set(state => {
        const floorIndex = state.floors.findIndex(f => f.floorNumber === state.currentFloor);
        if (floorIndex === -1) {
          logDebug(`Error: Floor not found: ${state.currentFloor}`, 'Floors');
          console.error(`setProposal failed: Floor ${state.currentFloor} not found in state.`);
          return;
        }

        const currentFloorState = state.floors[floorIndex];
        const floorNumber = state.currentFloor;

        // --- Validation 1: Check Floor Status ---
        if (currentFloorState.status !== FloorStatus.Pending && currentFloorState.status !== FloorStatus.Reopened) {
          logDebug(`Error: Cannot set proposal on floor ${floorNumber}. Status is ${currentFloorState.status}.`, 'Floors');
          console.warn(`setProposal blocked: Floor ${floorNumber} has status ${currentFloorState.status}, cannot set proposal.`);
          return;
        }

        // --- Validation 2: Check if Proposal Slot is Already Filled ---
        if (isPlayerA) {
          if (currentFloorState.proposalA) {
            logDebug(`Warning: Proposal A already exists for floor ${floorNumber}. Current: ${currentFloorState.proposalA.name}, Attempted: ${card.name}. Action blocked.`, 'Floors');
            console.warn(`setProposal blocked: Proposal A already exists for floor ${floorNumber}.`);
            return;
          } else {
            logDebug(`Setting proposal A for floor ${floorNumber}: ${card.name} (ID: ${card.id})`, 'Floors');
            currentFloorState.proposalA = card;
            logFloorAction(`Player A proposed ${card.name} for floor ${floorNumber}`);
          }
        } else {
          if (currentFloorState.proposalB) {
            logDebug(`Warning: Proposal B already exists for floor ${floorNumber}. Current: ${currentFloorState.proposalB.name}, Attempted: ${card.name}. Action blocked.`, 'Floors');
            console.warn(`setProposal blocked: Proposal B already exists for floor ${floorNumber}.`);
            return;
          } else {
            logDebug(`Setting proposal B for floor ${floorNumber}: ${card.name} (ID: ${card.id})`, 'Floors');
            currentFloorState.proposalB = card;
            logDebug(`Player B proposed ${card.name} for floor ${floorNumber}`, 'Floors');
          }
        }
      });
    },

    /**
     * Clears both proposal slots for the current floor.
     * Useful for explicit state resets during game flow if needed.
     */
    clearCurrentFloorProposals: () => {
      const currentFloorNum = get().currentFloor;
      logDebug(`Clearing proposals for current floor: ${currentFloorNum}`, 'Floors');
      set(state => {
        const floorIndex = state.floors.findIndex(f => f.floorNumber === currentFloorNum);
        if (floorIndex !== -1) {
          if (state.floors[floorIndex].proposalA || state.floors[floorIndex].proposalB) {
            state.floors[floorIndex].proposalA = undefined;
            state.floors[floorIndex].proposalB = undefined;
            logFloorAction(`Proposals cleared for floor ${currentFloorNum}.`);
          } else {
            logDebug(`No proposals to clear for floor ${currentFloorNum}.`, 'Floors');
          }
        } else {
          logDebug(`Error: Cannot clear proposals, floor ${currentFloorNum} not found.`, 'Floors');
        }
      });
    },

    /**
     * Finalizes a floor's state, updating its status and potentially adding a winner card.
     * Also clears any lingering proposals for the finalized floor.
     */
    finalizeFloor: (floorNumber, status, winnerCard, committedBy = null) => {
      logDebug(`Finalizing floor: floor=${floorNumber}, status=${status}, winnerCard=${winnerCard?.name ?? 'N/A'}, committedBy=${committedBy ?? 'N/A'}`, 'Floors');

      set(state => {
        const floorIndex = state.floors.findIndex(f => f.floorNumber === floorNumber);
        if (floorIndex === -1) {
          logDebug(`Error: Floor not found for finalization: ${floorNumber}`, 'Floors');
          console.error(`finalizeFloor failed: Floor ${floorNumber} not found.`);
          return;
        }

        const floorToUpdate = state.floors[floorIndex];
        const previousStatus = floorToUpdate.status;

        // Update floor state
        floorToUpdate.status = status;
        floorToUpdate.winnerCard = winnerCard;
        floorToUpdate.committedBy = committedBy;

        // --- Proposal Clearing ---
        if (status === FloorStatus.Agreed || status === FloorStatus.Skipped) {
          if (floorToUpdate.proposalA || floorToUpdate.proposalB) {
            logDebug(`Clearing proposals for finalized floor ${floorNumber}.`, 'Floors');
            floorToUpdate.proposalA = undefined;
            floorToUpdate.proposalB = undefined;
          }
        }

        logDebug(`Floor ${floorNumber} finalized as ${status}${winnerCard ? ` with card ${winnerCard.name}` : ''}${committedBy ? ` by ${committedBy}`: ''}`, 'Floors');
        logDebug(`Floor ${floorNumber} status changed: ${previousStatus} -> ${status}`, 'Floors');
      });

      // --- Cross-Store Update: Add Card to Building ---
      if (status === FloorStatus.Agreed && winnerCard) {
        const { addCardToFloor } = useBuildingStore.getState();
        const floorState = get().getFloorState(floorNumber);

        if (floorState) {
          let ownerRole = 'neutral';
          if (committedBy === Committer.PlayerA || committedBy === Committer.PlayerB) {
            const { players } = usePlayersStore.getState();
            const playerIndex = committedBy === Committer.PlayerA ? 0 : 1;
            if (players[playerIndex]) {
              ownerRole = players[playerIndex].role;
            }
          } else if (committedBy === Committer.Auto) {
            // Handle auto/mediator case if needed
          }

          logDebug(`Adding card to building store: floor=${floorNumber}, card=${winnerCard.id}, ownerRole=${ownerRole}`, 'Floors');
          addCardToFloor(
            floorNumber,
            winnerCard,
            floorState.units,
            ownerRole
          );
        } else {
          logDebug(`Error: Could not find floor state ${floorNumber} after finalization to update building store.`, 'Floors');
        }
      }
    },

    // --- validateRecall (Keep existing implementation) ---
    validateRecall: (floorNumber) => {
      const { currentFloor, floors } = get();
      const { getCurrentPlayer } = usePlayersStore.getState();
      const currentPlayer = getCurrentPlayer();

      logDebug(`validateRecall called: floorNumber=${floorNumber}, currentFloor=${currentFloor}`, 'Floors');

      if (!currentPlayer) {
        logDebug(`Recall validation failed: No active player`, 'Floors');
        return { isValid: false, reason: "No active player." };
      }
      if (floorNumber >= RECALL_MAX_FLOOR) {
        logDebug(`Recall validation failed: Floor ${floorNumber} is beyond recall limit (${RECALL_MAX_FLOOR - 1})`, 'Floors');
        return { isValid: false, reason: `Cannot recall: Floor ${floorNumber} is beyond the recall limit of floor ${RECALL_MAX_FLOOR - 1}.`};
      }
      if (floorNumber >= currentFloor) {
        logDebug(`Recall validation failed: Floor ${floorNumber} is current or future floor`, 'Floors');
        return { isValid: false, reason: `Cannot recall: Floor ${floorNumber} is the current or a future floor.` };
      }
      if (currentPlayer.recallTokens <= 0) {
        logDebug(`Recall validation failed: Player has no recall tokens left`, 'Floors');
        return { isValid: false, reason: `Cannot recall: ${currentPlayer.name} has no recall tokens left.` };
      }
      const floorToRecall = floors.find(f => f.floorNumber === floorNumber);
      if (!floorToRecall || floorToRecall.status !== FloorStatus.Agreed) {
        logDebug(`Recall validation failed: Floor ${floorNumber} was not agreed upon or doesn't exist`, 'Floors');
        return { isValid: false, reason: `Cannot recall: Floor ${floorNumber} was not agreed upon or doesn't exist.` };
      }
      logDebug(`Recall validation passed for floor ${floorNumber}`, 'Floors');
      return { isValid: true, reason: "" };
    },

    /**
     * Reopens a previously agreed-upon floor for renegotiation.
     * Clears the winner card, commitment, and any proposals.
     * Updates the building store by removing the card.
     */
    applyRecall: (floorNumber) => {
      logDebug(`Applying recall: floorNumber=${floorNumber}`, 'Floors');
      let recalledCardData: { winnerCard?: CardData; committedBy?: Committer | null } = {};

      set(state => {
        const floorIndex = state.floors.findIndex(f => f.floorNumber === floorNumber);
        if (floorIndex === -1) {
          logDebug(`Error: Cannot apply recall, floor ${floorNumber} not found.`, 'Floors');
          console.error(`applyRecall failed: Floor ${floorNumber} not found.`);
          return;
        }

        const floorToRecall = state.floors[floorIndex];

        if (floorToRecall.status !== FloorStatus.Agreed) {
          logDebug(`Warning: Cannot apply recall to floor ${floorNumber}, status is ${floorToRecall.status} (expected Agreed).`, 'Floors');
          return;
        }

        const previousStatus = floorToRecall.status;
        recalledCardData = { winnerCard: floorToRecall.winnerCard, committedBy: floorToRecall.committedBy };

        // --- Reset the floor state for renegotiation ---
        floorToRecall.status = FloorStatus.Reopened;
        floorToRecall.winnerCard = undefined;
        floorToRecall.committedBy = null;
        floorToRecall.proposalA = undefined;
        floorToRecall.proposalB = undefined;

        logDebug(`Floor ${floorNumber} recalled and reopened`, 'Floors');
        logDebug(`Floor ${floorNumber} status changed: ${previousStatus} -> ${FloorStatus.Reopened}. Proposals cleared.`, 'Floors');
      });

      // --- Cross-Store Update: Remove Card from Building ---
      if (recalledCardData.winnerCard) {
        const { removeCardFromFloor } = useBuildingStore.getState();
        logDebug(`Removing recalled card ${recalledCardData.winnerCard.id} from building store at floor ${floorNumber}`, 'Floors');
        removeCardFromFloor(floorNumber, recalledCardData.winnerCard.id);
      } else {
        logDebug(`No winner card found on floor ${floorNumber} during recall, nothing to remove from building store.`, 'Floors');
      }

      return recalledCardData;
    },

    // ===========================
    //         Getters
    // ===========================
    getCurrentFloorState: () => {
      const { floors, currentFloor } = get();
      const floorState = floors.find(f => f.floorNumber === currentFloor);
      return floorState;
    },

    getFloorState: (floorNumber) => {
      const { floors } = get();
      return floors.find(f => f.floorNumber === floorNumber);
    },

    getNextPendingFloor: () => {
      const { floors, currentFloor } = get();
      const nextNegotiableFloor = floors.find(
        f => f.floorNumber > currentFloor && (f.status === FloorStatus.Pending || f.status === FloorStatus.Reopened)
      );

      const nextFloor = nextNegotiableFloor
        ? nextNegotiableFloor.floorNumber
        : Math.min(currentFloor + 1, MAX_STORIES + 1);

      logDebug(`Next negotiable floor identified after ${currentFloor} is ${nextFloor}`, 'Floors');
      return nextFloor;
    }
  }))
);

function logFloorAction(message: string): void {
  console.info(`[FLOOR ACTION]: ${message}`);
}

// (Removed duplicate logFloorAction implementation)
