// stores/useBuildingStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { CardData } from "@/data/types";
import { MANDATORY_IMPACTS, BUILDING_FOOTPRINT } from '@/data/constants'; // Assuming BUILDING_FOOTPRINT might be used later

// Define BuildingUse interface locally since it's not exported from @/data/types
// EXPORT this interface
export interface BuildingUse {
  cardId: string;
  cardName: string;
  category: string;
  sqft: number;
  units: number;
  impact: number;
  owner: string;
}

// Define FloorData interface locally - removed 'height'
interface FloorData {
  sqftUsed: number;
  uses: BuildingUse[];
  // height: number; // Removed height from floor-specific data
  score: number;
}
import { logDebug, logError } from '@/utils/logger'; // Assuming logger exists

// Calculate baseline score from mandatory impacts (unchanged)
const BASELINE_SCORE = MANDATORY_IMPACTS.reduce(
  (sum, impact) => sum + impact.netScoreImpact,
  0
);

// Interface for the core building state slice
interface BuildingState {
  floors: { [floorNumber: number]: FloorData }; // Map of floor number to its data
  baselineScore: number; // Initial score offset (e.g., from site conditions)
  scorePenaltiesTotal: number; // Tracks penalties applied (e.g., from recall tokens)
}

// Define the initial state structure
const initialBuildingState: BuildingState = {
  floors: {},
  baselineScore: BASELINE_SCORE,
  scorePenaltiesTotal: 0,
};

// Interface for the full Zustand store (state + actions + getters)
interface BuildingStoreState {
  // State
  building: BuildingState;

  // Actions
  resetBuilding: () => void;
  /** Adds a card's use to a specific floor */
  addCardToFloor: (
    floorNumber: number,
    card: CardData,
    units: number, // How many instances of the card use (e.g., apartments)
    ownerRole: string // e.g., 'community' or 'developer'
  ) => void;
  /** Removes a card's use from a specific floor */
  removeCardFromFloor: (floorNumber: number, cardId: string) => void;
  /** Applies an explicit score penalty/bonus (e.g., for using recall) */
  applyScorePenalty: (penalty: number) => void;

  // Getters (Functions to calculate derived state)
  getCurrentNetScore: () => number;
  getTotalSqft: () => number;
  getTotalHeight: () => number;
  /** Provides a summary list of floor data */
  getFloorSummary: () => {
    floor: number,
    sqft: number,
    uses: BuildingUse[],
    score: number
    // Removed height from summary item
  }[];
  getFloorData: (floorNumber: number) => FloorData | undefined;
}

// Helper function to determine height based on card category (example logic)
const getCardHeight = (category: string | undefined): number => {
  return category === 'Housing' ? 12 : 15;
};


export const useBuildingStore = create<BuildingStoreState>()(
  immer((set, get) => ({
    // State
    building: { ...initialBuildingState },

    // --- Actions ---
    resetBuilding: () => {
      logDebug("Resetting building store state.", "BuildingStore");
      set({ building: { ...initialBuildingState } });
    },

    addCardToFloor: (floorNumber, card, units = 1, ownerRole) => {
      if (!card || !card.id) {
        logError(`Attempted to add invalid card data to floor ${floorNumber}.`, "BuildingStore");
        return;
      }
      if (units <= 0) {
        logDebug(`Attempted to add card ${card.id} with zero or negative units (${units}). Skipping.`, "BuildingStore");
        return;
      }
      
      // Snapshot values needed after mutation
      const cardName = card.name;
      const cardId = card.id;
      
      // Make a safe copy of the card
      const cardCopy = { ...card };
      
      logDebug(`Adding card ${cardId} (x${units}) to floor ${floorNumber}. Owner: ${ownerRole}`, "BuildingStore");
    
      set(state => {
        // Ensure floor exists in the map
        if (!state.building.floors[floorNumber]) {
          state.building.floors[floorNumber] = {
            sqftUsed: 0,
            uses: [],
            score: 0
          };
        }
    
        const floor = state.building.floors[floorNumber];
        const totalSqftUsedByCard = (cardCopy.baseSqft ?? 0) * units;
        const scoreImpactByCard = (cardCopy.netScoreImpact ?? 0) * units;
    
        // Add the specific use of the card to the floor
        floor.uses.push({
          cardId: cardCopy.id,
          cardName: cardCopy.name,
          category: cardCopy.category ?? '',
          sqft: totalSqftUsedByCard,
          units: units,
          impact: scoreImpactByCard,
          owner: ownerRole
        });
    
        // Update metrics
        floor.sqftUsed += totalSqftUsedByCard;
        floor.score += scoreImpactByCard;
      });
      
      // After mutation, use the safe values we captured earlier
      // or get fresh state if needed
      const updatedFloor = useBuildingStore.getState().building.floors[floorNumber];
      logDebug(
        `Floor ${floorNumber} updated after adding ${cardName}: sqft=${updatedFloor?.sqftUsed}, score=${updatedFloor?.score}`, 
        "BuildingStore"
      );
    },

    removeCardFromFloor: (floorNumber, cardId) => {
      logDebug(`Attempting to remove card ${cardId} from floor ${floorNumber}.`, "BuildingStore");

      set(state => {
        const floor = state.building.floors[floorNumber];
        if (!floor) {
          logDebug(`Cannot remove card: Floor ${floorNumber} does not exist.`, "BuildingStore");
          return;
        }

        const cardUseIndex = floor.uses.findIndex(use => use.cardId === cardId);
        if (cardUseIndex === -1) {
           logDebug(`Cannot remove card: Card ${cardId} not found on floor ${floorNumber}.`, "BuildingStore");
          return;
        }

        const removedUse = floor.uses[cardUseIndex];

        // Update floor metrics by subtracting the removed use's contribution
        floor.sqftUsed -= removedUse.sqft;
        floor.score -= removedUse.impact;

        // Remove the use from the array
        floor.uses.splice(cardUseIndex, 1);

        // Removed height recalculation logic here
        // if (floor.uses.length > 0) {
        //     floor.height = Math.max(
        //         ...floor.uses.map(use => getCardHeight(use.category)),
        //         0
        //     );
        // } else {
        //     floor.height = 0;
        //     logDebug(`Floor ${floorNumber} is now empty after removing ${cardId}.`, "BuildingStore");
        // }

        if (floor.uses.length === 0) {
          logDebug(`Floor ${floorNumber} is now empty after removing ${cardId}.`, "BuildingStore");
          // Optionally delete the floor if empty: delete state.building.floors[floorNumber];
        }

         logDebug(`Removed card ${cardId} from floor ${floorNumber}. New stats: sqft=${floor.sqftUsed}, score=${floor.score}`, "BuildingStore");
      });
       // Note: Building-wide totals are calculated by getters.
    },

    applyScorePenalty: (penalty) => {
      logDebug(`Applying score penalty: ${penalty}`, "BuildingStore");
      set(state => {
        state.building.scorePenaltiesTotal += penalty;
      });
    },

    // --- Getters ---

    getCurrentNetScore: () => {
      const { building } = get();
      // Start with baseline and explicit penalties
      let netScore = building.baselineScore + building.scorePenaltiesTotal;
      // Add score contributions from each floor
      for (const floorNumber in building.floors) {
        netScore += building.floors[floorNumber]?.score || 0;
      }
      // logDebug(`Calculated currentNetScore: ${netScore}`, "BuildingStore"); // Can be noisy
      return netScore;
    },

    getTotalSqft: () => {
      const { building } = get();
      let totalSqft = 0;
      for (const floorNumber in building.floors) {
        totalSqft += building.floors[floorNumber]?.sqftUsed || 0;
      }
      // logDebug(`Calculated totalSqft: ${totalSqft}`, "BuildingStore"); // Can be noisy
      return totalSqft;
    },

    getTotalHeight: () => {
      const { building } = get();
      let totalHeight = 0;

      // Iterate through each floor defined in the state
      for (const floorNumber in building.floors) {
        const floorData = building.floors[floorNumber];
        if (floorData && floorData.uses.length > 0) {
          // Find the maximum height among all uses on this specific floor
          const floorHeight = Math.max(
            ...floorData.uses.map(use => getCardHeight(use.category)),
            0 // Ensure a minimum of 0 if uses array is somehow empty after check
          );
          // Add this floor's height contribution to the total building height
          totalHeight += floorHeight;
        }
      }

      // logDebug(`Calculated totalHeight: ${totalHeight}`, "BuildingStore"); // Can be noisy
      return totalHeight;
    },

    getFloorSummary: () => {
      const { building } = get();
      const floorData = Object.entries(building.floors)
        .map(([floorNum, data]) => ({
          floor: parseInt(floorNum),
          sqft: data.sqftUsed || 0,
          uses: data.uses || [],
          score: data.score || 0, // Score contribution of this floor
          // height: data.height || 0 // Removed height from summary
        }))
        .sort((a, b) => a.floor - b.floor); // Sort by floor number

      return floorData;
    },

    getFloorData: (floorNumber) => {
       const { building } = get();
       return building.floors[floorNumber];
    }
  }))
);