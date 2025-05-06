// stores/useBuildingStore.ts
// Fully unabridged and corrected version.

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { CardData } from "@/data/types"; 
import { MANDATORY_IMPACTS, BUILDING_FOOTPRINT } from '@/data/constants'; // BUILDING_FOOTPRINT included as per original
import { logDebug, logError, logWarn } from '@/utils/logger';

export interface BuildingUse {
  cardId: string; // Should be unique for this use, e.g., cardInstanceId
  cardName: string;
  category: string;
  sqft: number; 
  units: number;
  impact: number; // Score impact
  owner: string;
}

interface FloorData {
  sqftUsed: number; 
  uses: BuildingUse[];
  score: number; // Sum of score impacts of cards on this floor
}

const BASELINE_SCORE = MANDATORY_IMPACTS.reduce(
  (sum, impact) => sum + impact.netScoreImpact,
  0
);

interface BuildingState {
  floors: { [floorNumber: number]: FloorData };
  baselineScore: number;
  scorePenaltiesTotal: number;
  currentTotalSqFt: number; 
}

const initialBuildingState: BuildingState = {
  floors: {},
  baselineScore: BASELINE_SCORE,
  scorePenaltiesTotal: 0,
  currentTotalSqFt: 0, 
};

export interface BuildingStoreState {
  building: BuildingState;

  resetBuilding: () => void;
  addCardToFloor: (
    floorNumber: number,
    card: CardData,
    units: number, 
    ownerRole: string
  ) => void;
  removeCardFromFloor: (floorNumber: number, useCardIdToRemove: string) => void; // ID of the use entry
  applyScorePenalty: (penalty: number) => void;

  getCurrentNetScore: () => number;
  getTotalSqft: () => number; 
  getTotalHeight: () => number;
  getFloorSummary: () => {
    floor: number,
    sqft: number,
    uses: BuildingUse[],
    score: number
  }[];
  getFloorData: (floorNumber: number) => FloorData | undefined;
}

// Helper to determine height contribution of a card category
const getCardHeight = (category: string | undefined): number => {
  // This is a simplified model; can be expanded based on card types
  return category === 'Housing' ? 12 : 15; // Example heights
};

export const useBuildingStore = create<BuildingStoreState>()(
  immer((set, get) => ({
    building: { ...initialBuildingState },

    resetBuilding: () => {
      logDebug("Resetting building store state.", "BuildingStore");
      // Ensure all relevant parts of the building state are reset
      set({ 
        building: { 
          ...initialBuildingState, 
          floors: {}, // Explicitly clear floors
          currentTotalSqFt: 0 // Ensure total sqft is reset
        } 
      });
    },

    addCardToFloor: (floorNumber, card, units = 1, ownerRole) => {
      if (!card || !card.id) {
        logError(`Attempted to add invalid card data to floor ${floorNumber}. Card or card.id is missing.`, "BuildingStore");
        return;
      }
      if (units <= 0) {
        logDebug(`Attempted to add card ${card.id} with zero or negative units (${units}). Skipping.`, "BuildingStore");
        return;
      }

      let cardSqftValue: number | undefined = undefined;

      // Try to get square footage, preferring baseSqft, then minimumSqft.
      if (card) { // Ensure card object exists
        if (typeof card.baseSqft === 'number') {
          cardSqftValue = card.baseSqft;
        } else if (typeof card.minimumSqft === 'number') {
          // Log a warning that we're falling back, this suggests an upstream data consistency opportunity.
          logWarn(`Card ${card.name} (ID: ${card.id}) is using 'minimumSqft' (${card.minimumSqft}) because 'baseSqft' is not defined. 'baseSqft' should ideally be populated during CardInstance creation from the definition's 'minimumSqft'.`, "BuildingStore");
          cardSqftValue = card.minimumSqft;
        }
        // Optionally, add more fallbacks here if other sqft-related fields like 'minSqft' might be used.
        // else if (typeof card.minSqft === 'number') {
        //   cardSqftValue = card.minSqft;
        // }
      }

      // Check if a valid square footage value was found
      if (typeof cardSqftValue !== 'number') {
        logError(`Card ${card.name} (ID: ${card.id}) is missing a valid square footage property (checked 'baseSqft' and 'minimumSqft'). Cannot add to floor.`, "BuildingStore");
        return;
      }

      const cardName = card.name;
      const useEntryId = card.instanceId || card.id;

      logDebug(`Adding card ${cardName} (Use ID: ${useEntryId}, Base ID: ${card.id}, Units: ${units}, SqFt/Unit: ${cardSqftValue}) to floor ${floorNumber}. Owner: ${ownerRole}`, "BuildingStore");

      set(state => {
        if (!state.building.floors[floorNumber]) {
          state.building.floors[floorNumber] = {
            sqftUsed: 0,
            uses: [],
            score: 0
          };
        }

        const floor = state.building.floors[floorNumber];
        // Use the resolved cardSqftValue for calculations
        const totalSqftUsedByThisAddition = cardSqftValue * units;
        const scoreImpactByThisAddition = (card.netScoreImpact ?? 0) * units;

        floor.uses.push({
          cardId: useEntryId,
          cardName: card.name,
          category: card.category ?? '',
          sqft: totalSqftUsedByThisAddition,
          units: units,
          impact: scoreImpactByThisAddition,
          owner: ownerRole
        });

        floor.sqftUsed += totalSqftUsedByThisAddition;
        floor.score += scoreImpactByThisAddition;
        state.building.currentTotalSqFt += totalSqftUsedByThisAddition;
      });

      const updatedFloor = get().building.floors[floorNumber];
      const currentTotalSqFt = get().building.currentTotalSqFt;
      logDebug(
        `Floor ${floorNumber} updated after adding ${cardName}: sqftUsedOnFloor=${updatedFloor?.sqftUsed}, floorScore=${updatedFloor?.score}. Building total sqft: ${currentTotalSqFt}`,
        "BuildingStore"
      );
    },
    
    removeCardFromFloor: (floorNumber, useCardIdToRemove: string) => {
      logDebug(`Attempting to remove card use entry '${useCardIdToRemove}' from floor ${floorNumber}.`, "BuildingStore");
      set(state => {
        const floor = state.building.floors[floorNumber];
        if (!floor) {
          logWarn(`Cannot remove card use: Floor ${floorNumber} does not exist.`, "BuildingStore");
          return;
        }

        const useIndexToRemove = floor.uses.findIndex(use => use.cardId === useCardIdToRemove);
        if (useIndexToRemove === -1) {
           logWarn(`Cannot remove card use: Entry '${useCardIdToRemove}' not found on floor ${floorNumber}.`, "BuildingStore");
          return;
        }

        const removedUse = floor.uses[useIndexToRemove];
        floor.sqftUsed -= removedUse.sqft;
        floor.score -= removedUse.impact;
        state.building.currentTotalSqFt -= removedUse.sqft;

        if (state.building.currentTotalSqFt < 0) {
            logWarn(`Building total sqft became negative (${state.building.currentTotalSqFt}) after removal from floor ${floorNumber}. Setting to 0.`, "BuildingStore");
            state.building.currentTotalSqFt = 0;
        }

        floor.uses.splice(useIndexToRemove, 1);

        if (floor.uses.length === 0 && floor.sqftUsed === 0 && floor.score === 0) {
          logDebug(`Floor ${floorNumber} is now empty after removing card use '${useCardIdToRemove}'.`, "BuildingStore");
          // Optionally: delete state.building.floors[floorNumber]; if completely empty floors are not desired.
        }
        logDebug(`Removed card use '${useCardIdToRemove}' from floor ${floorNumber}. Floor sqftUsed=${floor.sqftUsed}, score=${floor.score}. Building total sqft: ${state.building.currentTotalSqFt}`, "BuildingStore");
      });
    },

    applyScorePenalty: (penalty) => {
      logDebug(`Applying score penalty: ${penalty}`, "BuildingStore");
      set(state => {
        state.building.scorePenaltiesTotal += penalty;
      });
    },

    getCurrentNetScore: () => {
      const { building } = get();
      let netScore = building.baselineScore + building.scorePenaltiesTotal;
      // Iterate over floor values for their scores
      Object.values(building.floors).forEach(floorData => {
        if (floorData) { // Ensure floorData is not undefined
            netScore += floorData.score;
        }
      });
      return netScore;
    },

    getTotalSqft: () => {
      // Returns the explicitly tracked total square footage for the building
      return get().building.currentTotalSqFt;
    },

    getTotalHeight: () => {
      const { building } = get();
      let totalHeight = 0;
      // Iterate over floor values to calculate height
      Object.values(building.floors).forEach(floorData => {
        if (floorData && floorData.uses.length > 0) {
          // Calculate height for this floor based on its uses.
          // This assumes the height of a floor is determined by the max height of cards on it.
          // Or, a floor could have a fixed height if it has any uses.
          const floorUsesHeights = floorData.uses.map(use => getCardHeight(use.category));
          const maxCardHeightOnFloor = Math.max(...floorUsesHeights, 0); // Ensure at least 0
          
          // If a floor is used, it contributes its height.
          // If multiple cards are on a floor, this model assumes they don't stack vertically
          // to increase that single floor's structural height beyond what one card dictates.
          // The height added is the height of *that floor level*.
          if (maxCardHeightOnFloor > 0) { // Only add height if there are cards contributing to it.
             // This logic might be simplified if each "occupied" floor number adds a fixed height,
             // regardless of card category. For now, it's category-driven.
             // If each distinct floor number only contributes once to height:
             // This sum will work if each floorData represents a unique floor level.
            totalHeight += maxCardHeightOnFloor; 
          }
        }
      });
      return totalHeight;
    },

    getFloorSummary: () => {
      const { building } = get();
      // Transform the floors object into a sorted array for summary
      return Object.entries(building.floors)
        .map(([floorNumStr, data]) => {
          const floorNum = parseInt(floorNumStr, 10);
          // Ensure data exists and has defaults if somehow partially formed (should not happen with init)
          return {
            floor: floorNum,
            sqft: data?.sqftUsed || 0,
            uses: data?.uses || [],
            score: data?.score || 0,
          };
        })
        .sort((a, b) => a.floor - b.floor); // Sort by floor number
    },

    getFloorData: (floorNumber: number): FloorData | undefined => {
        // Returns a direct reference; immer handles immutability within 'set' calls.
        return get().building.floors[floorNumber];
    }
  }))
);