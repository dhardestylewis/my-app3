// src/stores/useUIPopupStore.ts
"use client";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { logDebug } from "@/utils/logger";

export interface UIPopupStoreState {
  // State
  isDeckSelectorOpen: boolean;
  
  // Actions
  openDeckSelector: () => void;
  closeDeckSelector: () => void;
  toggleDeckSelector: () => void;
}

// The store implementation is already correct since we:
// 1. Don't have any computed values that return new objects
// 2. Use immer's draft state to update values in place
// 3. Have simple primitive values (booleans) that maintain referential equality
export const useUIPopupStore = create<UIPopupStoreState>()(
  immer((set, get) => ({
    // State
    isDeckSelectorOpen: false,
    
    // Actions
    openDeckSelector: () => {
      // Only open if not already open to avoid unnecessary rerenders
      if (!get().isDeckSelectorOpen) {
        logDebug("Opening deck selector popup", "UIPopup");
        set(state => {
          state.isDeckSelectorOpen = true;
        });
      }
    },
    
    closeDeckSelector: () => {
      // Only close if not already closed to avoid unnecessary rerenders
      if (get().isDeckSelectorOpen) {
        logDebug("Closing deck selector popup", "UIPopup");
        set(state => {
          state.isDeckSelectorOpen = false;
        });
      }
    },
    
    toggleDeckSelector: () => {
      const newValue = !get().isDeckSelectorOpen;
      set(state => {
        state.isDeckSelectorOpen = newValue;
      });
      logDebug(`Toggled deck selector popup to ${newValue ? 'open' : 'closed'}`, "UIPopup");
    }
  }))
);