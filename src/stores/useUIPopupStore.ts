// FILEPATH: /c:/Users/Rhiou/Downloads/reactstarter/my-app3/src/stores/useUIPopupStore.ts
"use client"; // Add if this store is used in client components

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { logDebug } from "@/utils/logger"; // Assuming logger path

// Define the interface for the store's state and actions
export interface UIPopupStoreState {
  // State
  isDeckSelectorOpen: boolean;

  // Actions
  openDeckSelector: () => void;
  closeDeckSelector: () => void;
  toggleDeckSelector: () => void;
}

// Create the Zustand store with Immer middleware
export const useUIPopupStore = create<UIPopupStoreState>()(
  immer((set, get) => ({
    // Initial State
    isDeckSelectorOpen: false,

    // Actions
    openDeckSelector: () => {
      // Only update state if the value is actually changing
      if (!get().isDeckSelectorOpen) {
        logDebug("[UIPopup] Opening deck selector popup");
        set(state => {
          state.isDeckSelectorOpen = true;
        });
      }
    },

    closeDeckSelector: () => {
      // Only update state if the value is actually changing
      if (get().isDeckSelectorOpen) {
        logDebug("[UIPopup] Closing deck selector popup");
        set(state => {
          state.isDeckSelectorOpen = false;
        });
      }
    },

    toggleDeckSelector: () => {
      const currentIsOpen = get().isDeckSelectorOpen;
      const newValue = !currentIsOpen;
      set(state => {
        state.isDeckSelectorOpen = newValue;
      });
      logDebug(`[UIPopup] Toggled deck selector popup to ${newValue ? 'open' : 'closed'}`);
    }
  }))
);