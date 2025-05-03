// stores/useBuildingStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { CardData } from "@/data/types";
import { MANDATORY_IMPACTS, BUILDING_FOOTPRINT } from '@/data/constants'; // BUILDING_FOOTPRINT kept for future use

import { logDebug, logError } from '@/utils/logger';

// ---------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------
/** Maximum square footage allowed per floor */
const MAX_FLOOR_SQFT = 10_000;

// Calculate baseline score from mandatory impacts
const BASELINE_SCORE = MANDATORY_IMPACTS.reduce(
  (sum, impact) => sum + impact.netScoreImpact,
  0
);

// ---------------------------------------------------------------------
// Local type declarations (since they are not exported from the data layer)
// ---------------------------------------------------------------------
interface BuildingUse {
  cardId: string;
  cardName: string;
  category: string;
  sqft: number;
  units: number;
  impact: number;
  owner: string;
}

interface FloorData {
  sqftUsed: number;
  uses: BuildingUse[];
  score: number;
}

interface BuildingState {
  floors: { [floorNumber: number]: FloorData };
  baselineScore: number;
  scorePenaltiesTotal: number;
}

const initialBuildingState: BuildingState = {
  floors: {},
  baselineScore: BASELINE_SCORE,
  scorePenaltiesTotal: 0,
};

interface BuildingStoreState {
  // State slice
  building: BuildingState;

  // Actions
  resetBuilding: () => void;
  addCardToFloor: (
    floorNumber: number,
    card: CardData,
    units: number,
    ownerRole: string
  ) => void;
  removeCardFromFloor: (floorNumber: number, cardId: string) => void;
  applyScorePenalty: (penalty: number) => void;

  // Getters
  getCurrentNetScore: () => number;
  getTotalSqft: () => number;
  getTotalHeight: () => number;
  getFloorSummary: () => {
    floor: number;
    sqft: number;
    uses: BuildingUse[];
    score: number;
  }[];
  getFloorData: (floorNumber: number) => FloorData | undefined;
}

// Helper to determine default height for a use
const getCardHeight = (category: string | undefined): number =>
  category === 'Housing' ? 12 : 15;

// ---------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------
export const useBuildingStore = create<BuildingStoreState>()(
  immer((set, get) => ({
    // -----------------------------------------------------------------
    // State
    // -----------------------------------------------------------------
    building: { ...initialBuildingState },

    // -----------------------------------------------------------------
    // Actions
    // -----------------------------------------------------------------
    resetBuilding: () => {
      logDebug('Resetting building store state.', 'BuildingStore');
      set({ building: { ...initialBuildingState } });
    },

    /**
     * Adds a card instance to a floor, unless it would exceed the per‑floor
     * MAX_FLOOR_SQFT hard cap.
     */
    addCardToFloor: (floorNumber, card, units = 1, ownerRole) => {
      if (!card?.id) {
        logError(
          `Attempted to add invalid card data to floor ${floorNumber}.`,
          'BuildingStore'
        );
        return;
      }
      if (units <= 0) {
        logDebug(
          `Attempted to add card ${card.id} with zero or negative units (${units}). Skipping.`,
          'BuildingStore'
        );
        return;
      }

      // --------------------------------------------------------------
      // Hard‑cap check BEFORE mutating state
      // --------------------------------------------------------------
      const floorSqft = get().building.floors[floorNumber]?.sqftUsed ?? 0;
      const addSqft = (card.baseSqft ?? 0) * units;
      const proposedSqft = floorSqft + addSqft;

      if (proposedSqft > MAX_FLOOR_SQFT) {
        logDebug(
          `⛔️ Cannot add ${card.id} to floor ${floorNumber}: ` +
            `would exceed ${MAX_FLOOR_SQFT} sq ft (proposed ${proposedSqft}).`,
          'BuildingStore'
        );
        return;
      }

      // --------------------------------------------------------------
      // Safe to mutate
      // --------------------------------------------------------------
      set((state) => {
        // Ensure floor exists
        if (!state.building.floors[floorNumber]) {
          state.building.floors[floorNumber] = {
            sqftUsed: 0,
            uses: [],
            score: 0,
          };
          logDebug(
            `Initialized floor ${floorNumber} data.`,
            'BuildingStore'
          );
        }

        const floor = state.building.floors[floorNumber];
        const scoreImpact = (card.netScoreImpact ?? 0) * units;

        floor.uses.push({
          cardId: card.id,
          cardName: card.name,
          category: card.category ?? '',
          sqft: addSqft,
          units,
          impact: scoreImpact,
          owner: ownerRole,
        });

        floor.sqftUsed += addSqft;
        floor.score += scoreImpact;

        logDebug(
          `Floor ${floorNumber} updated: sqft=${floor.sqftUsed}, score=${floor.score}`,
          'BuildingStore'
        );
      });
    },

    removeCardFromFloor: (floorNumber, cardId) => {
      logDebug(
        `Attempting to remove card ${cardId} from floor ${floorNumber}.`,
        'BuildingStore'
      );

      set((state) => {
        const floor = state.building.floors[floorNumber];
        if (!floor) {
          logDebug(
            `Cannot remove card: Floor ${floorNumber} does not exist.`,
            'BuildingStore'
          );
          return;
        }

        const idx = floor.uses.findIndex((use) => use.cardId === cardId);
        if (idx === -1) {
          logDebug(
            `Cannot remove card: Card ${cardId} not found on floor ${floorNumber}.`,
            'BuildingStore'
          );
          return;
        }

        const removed = floor.uses[idx];
        floor.sqftUsed -= removed.sqft;
        floor.score -= removed.impact;
        floor.uses.splice(idx, 1);

        if (floor.uses.length === 0) {
          logDebug(
            `Floor ${floorNumber} is now empty after removing ${cardId}.`,
            'BuildingStore'
          );
          // Optionally: delete state.building.floors[floorNumber];
        }

        logDebug(
          `Removed card ${cardId} from floor ${floorNumber}. New stats: sqft=${floor.sqftUsed}, score=${floor.score}`,
          'BuildingStore'
        );
      });
    },

    applyScorePenalty: (penalty) => {
      logDebug(`Applying score penalty: ${penalty}`, 'BuildingStore');
      set((state) => {
        state.building.scorePenaltiesTotal += penalty;
      });
    },

    // -----------------------------------------------------------------
    // Getters
    // -----------------------------------------------------------------
    getCurrentNetScore: () => {
      const { building } = get();
      let net = building.baselineScore + building.scorePenaltiesTotal;
      for (const floor of Object.values(building.floors)) {
        net += floor.score;
      }
      return net;
    },

    getTotalSqft: () => {
      const { building } = get();
      return Object.values(building.floors).reduce(
        (sum, floor) => sum + floor.sqftUsed,
        0
      );
    },

    getTotalHeight: () => {
      const { building } = get();
      let height = 0;
      for (const floor of Object.values(building.floors)) {
        if (floor.uses.length > 0) {
          height += Math.max(
            ...floor.uses.map((use) => getCardHeight(use.category)),
            0
          );
        }
      }
      return height;
    },

    getFloorSummary: () => {
      const { building } = get();
      return Object.entries(building.floors)
        .map(([num, data]) => ({
          floor: Number(num),
          sqft: data.sqftUsed,
          uses: data.uses,
          score: data.score,
        }))
        .sort((a, b) => a.floor - b.floor);
    },

    getFloorData: (floorNumber) => get().building.floors[floorNumber],
  }))
);
