import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { CardData } from "@/data/types";
import { MAX_STORIES, RECALL_MAX_FLOOR } from '@/data/constants';
import { usePlayersStore } from './usePlayersStore';
import { useBuildingStore } from './useBuildingStore';
import { logDebug } from '@/utils/logger';

// ===========================
//         Types
// ===========================
export enum FloorStatus {
  Pending = 'pending',      // Actively being negotiated or not yet started
  Agreed = 'agreed',        // Negotiation successful, card(s) placed
  Skipped = 'skipped',      // Negotiation failed or passed, no card placed
  Reopened = 'reopened',    // Recalled, ready for renegotiation
}

export enum Committer {
  PlayerA = 'A',
  PlayerB = 'B',
  Auto = 'auto', // e.g., Mediator decision or automatic pass
  None = 'none',
}

/**
 * A concrete card slot on the building once a floor is finalised.
 * Units are stored per‑card to enable mixed‑unit stacks.
 */
export interface PlacedCard {
  card: CardData;
  units: number; // default 1
}

export interface FloorState {
  floorNumber: number;
  status: FloorStatus;
  proposalA?: CardData;        // Player A's single active proposal for this floor
  proposalB?: CardData;        // Player B's single active proposal for this floor
  winnerCards: PlacedCard[];   // One or many cards agreed for the floor
  committedBy: Committer | null; // Who (or what) finalised the decision
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
  /** Finalises the state of a specific floor (e.g., Agreed, Skipped). Can now accept multiple winner cards. */
  finalizeFloor: (
    floorNumber: number,
    status: FloorStatus,
    winnerCards?: PlacedCard[],
    committedBy?: Committer | null
  ) => void;
  /** Checks if a recall action is valid for a given floor. */
  validateRecall: (floorNumber: number) => { isValid: boolean; reason: string };
  /** Applies the recall action, reopening a floor for negotiation. */
  applyRecall: (floorNumber: number) => {
    winnerCards?: PlacedCard[];
    committedBy?: Committer | null
  };

  // Getters
  getCurrentFloorState: () => FloorState | undefined;
  getFloorState: (floorNumber: number) => FloorState | undefined;
  getNextPendingFloor: () => number;
}

// ===========================
//   Helpers / Initialisers
// ===========================
const createInitialFloors = (): FloorState[] => {
  const initialFloors: FloorState[] = [];
  for (let i = 1; i <= MAX_STORIES; i++) {
    initialFloors.push({
      floorNumber: i,
      status: FloorStatus.Pending,
      proposalA: undefined,
      proposalB: undefined,
      winnerCards: [],
      committedBy: null,
    });
  }
  return initialFloors;
};

function logFloorAction(message: string): void {
  console.info(`[FLOOR ACTION]: ${message}`);
}

// ===========================
//         Store
// ===========================
export const useFloorStore = create<FloorStoreState>()(
  immer((set, get) => ({
    // ---------------------------
    //           State
    // ---------------------------
    floors: createInitialFloors(),
    currentFloor: 1,

    // ---------------------------
    //          Actions
    // ---------------------------
    initializeFloors: () => {
      logDebug(`Initializing floors for a new game`, 'Floors');
      const newFloors = createInitialFloors();
      set({ floors: newFloors, currentFloor: 1 });
    },

    setCurrentFloor: (floorNumber) => {
      if (floorNumber < 1 || floorNumber > MAX_STORIES) {
        logDebug(`Invalid floor number ignored: ${floorNumber}`, 'Floors');
        return;
      }
      logFloorAction(`Moving to floor ${floorNumber}`);
      set({ currentFloor: floorNumber });
    },

    setProposal: (isPlayerA, card) => {
      logDebug(`Attempting setProposal: isPlayerA=${isPlayerA}, card=${card.name}`, 'Floors');

      set(state => {
        const floorIndex = state.floors.findIndex(f => f.floorNumber === state.currentFloor);
        if (floorIndex === -1) return;

        const currentFloorState = state.floors[floorIndex];

        // Only pending or reopened floors can accept proposals
        if (![FloorStatus.Pending, FloorStatus.Reopened].includes(currentFloorState.status)) return;

        if (isPlayerA) {
          if (currentFloorState.proposalA) return; // Do not overwrite existing proposal
          currentFloorState.proposalA = card;
        } else {
          if (currentFloorState.proposalB) return;
          currentFloorState.proposalB = card;
        }
      });
    },

    clearCurrentFloorProposals: () => {
      const currentFloorNum = get().currentFloor;
      set(state => {
        const floor = state.floors.find(f => f.floorNumber === currentFloorNum);
        if (!floor) return;
        floor.proposalA = undefined;
        floor.proposalB = undefined;
      });
    },

    /**
     * Finalises a floor. Supports placing multiple cards.
     * Each card will be forwarded to the BuildingStore with its assigned units.
     */
    finalizeFloor: (floorNumber, status, winnerCards = [], committedBy = null) => {
      logDebug(`Finalising floor ${floorNumber} with ${winnerCards.length} card(s)`, 'Floors');

      set(state => {
        const floor = state.floors.find(f => f.floorNumber === floorNumber);
        if (!floor) return;

        floor.status = status;
        floor.winnerCards = status === FloorStatus.Agreed ? winnerCards : [];
        floor.committedBy = committedBy;
        floor.proposalA = undefined;
        floor.proposalB = undefined;
      });

      // Push agreed cards into BuildingStore
      if (status === FloorStatus.Agreed && winnerCards.length) {
        const { addCardToFloor } = useBuildingStore.getState();
        const { players } = usePlayersStore.getState();
        let ownerRole = 'neutral';
        if (committedBy === Committer.PlayerA && players[0]) ownerRole = players[0].role;
        if (committedBy === Committer.PlayerB && players[1]) ownerRole = players[1].role;

        winnerCards.forEach(pc => {
          logDebug(`> addCardToFloor: floor=${floorNumber}, card=${pc.card.id}, units=${pc.units}, owner=${ownerRole}`, 'Floors');
          addCardToFloor(floorNumber, pc.card, pc.units, ownerRole);
        });
      }
    },

    // ---------------------------
    //      Recall Handlers
    // ---------------------------
    validateRecall: (floorNumber) => {
      const { currentFloor, floors } = get();
      const { getCurrentPlayer } = usePlayersStore.getState();
      const currentPlayer = getCurrentPlayer();

      if (!currentPlayer) return { isValid: false, reason: "No active player." };
      if (floorNumber >= RECALL_MAX_FLOOR) return { isValid: false, reason: `Cannot recall: Floor ${floorNumber} is beyond the recall limit of floor ${RECALL_MAX_FLOOR - 1}.` };
      if (floorNumber >= currentFloor) return { isValid: false, reason: `Cannot recall: Floor ${floorNumber} is the current or a future floor.` };
      if (currentPlayer.recallTokens <= 0) return { isValid: false, reason: `${currentPlayer.name} has no recall tokens left.` };

      const floor = floors.find(f => f.floorNumber === floorNumber);
      if (!floor || floor.status !== FloorStatus.Agreed) return { isValid: false, reason: `Floor ${floorNumber} was not agreed upon or doesn't exist.` };

      return { isValid: true, reason: "" };
    },

    applyRecall: (floorNumber) => {
      let recalled: { winnerCards?: PlacedCard[]; committedBy?: Committer | null } = {};

      set(state => {
        const floor = state.floors.find(f => f.floorNumber === floorNumber);
        if (!floor || floor.status !== FloorStatus.Agreed) return;

        recalled = { winnerCards: floor.winnerCards, committedBy: floor.committedBy };

        floor.status = FloorStatus.Reopened;
        floor.winnerCards = [];
        floor.committedBy = null;
        floor.proposalA = undefined;
        floor.proposalB = undefined;
      });

      // Remove each card from BuildingStore
      if (recalled.winnerCards?.length) {
        const { removeCardFromFloor } = useBuildingStore.getState();
        recalled.winnerCards.forEach(pc => removeCardFromFloor(floorNumber, pc.card.id));
      }

      return recalled;
    },

    // ---------------------------
    //          Getters
    // ---------------------------
    getCurrentFloorState: () => {
      const { floors, currentFloor } = get();
      return floors.find(f => f.floorNumber === currentFloor);
    },

    getFloorState: (floorNumber) => {
      const { floors } = get();
      return floors.find(f => f.floorNumber === floorNumber);
    },

    getNextPendingFloor: () => {
      const { floors, currentFloor } = get();
      const next = floors.find(f => f.floorNumber > currentFloor && [FloorStatus.Pending, FloorStatus.Reopened].includes(f.status));
      return next ? next.floorNumber : Math.min(currentFloor + 1, MAX_STORIES + 1);
    },
  }))
);
