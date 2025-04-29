'use client';
// ClientLayout.tsx
// This component ensures that all Zustand stores are initialized and ready for use in the game
// It also provides a loading state while the game is being set up

import { useEffect, useState } from "react";
import { usePlayersStore, PlayerRole } from "@/stores/usePlayersStore";
import { useGameFlowStore, GamePhase } from "@/stores/useGameFlowStore";
import { useFloorStore } from "@/stores/useFloorStore";
import { logDebug } from "@/utils/logger";
import dynamic from "next/dynamic";

// Dynamically import App with client-side only rendering
const GameApp = dynamic(() => import("@/App"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="animate-pulse text-xl">Loading game...</div>
    </div>
  ),
});

// ────────────────────────────────────────────────────────────
//  ClientLayout: guarantees all core Zustand stores are primed
// ────────────────────────────────────────────────────────────
export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // State to track if the game is ready to render
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    logDebug("🔄 ClientLayout initialization running…", "Init");
    
    const timer = setTimeout(() => {
      const playerStore = usePlayersStore.getState();
      const gameFlowStore = useGameFlowStore.getState();
      
      /* 1️⃣ Ensure we have valid players + a live game */
      const playersOK =
        playerStore.players?.length > 0 &&
        typeof playerStore.players?.[0]?.id === "string";
        
      if (!playersOK) {
        logDebug("[Init] No players found – resetting & starting game", "Init");
        playerStore.resetToDefaults?.();
        
        // Check if startGame exists before calling it
        if (typeof gameFlowStore.startGame === 'function') {
          gameFlowStore.startGame?.(PlayerRole.Developer);
        } else {
          logDebug("[Init] Warning: gameFlowStore.startGame is not a function", "Init");
        }
      }
      
      /* 2️⃣ Dev console helpers (singletons) */
      if (typeof window !== "undefined") {
        (window as any).debugGame = {
          // expose the *store functions* so you can call getState()/subscribe()
          players: usePlayersStore,
          floors: useFloorStore,
          game: useGameFlowStore,
          // handy one-liners
          resetPlayers: () => usePlayersStore.getState().resetToDefaults?.(),
          logPlayers: () => usePlayersStore.getState().logPlayerState?.(),
          // Additional helper to toggle AI turn if method exists
          toggleAiTurn: () => {
            const gameFlow = useGameFlowStore.getState();
            if (typeof gameFlow.toggleAiTurn === 'function') {
              gameFlow.toggleAiTurn();
              logDebug(`Toggled AI turn: ${gameFlow.isAiTurn ? 'AI' : 'Player'}`, "Debug");
            } else {
              logDebug("toggleAiTurn method not available", "Debug");
            }
          }
        };
        
        // sanity check: same store instances everywhere
        const storeChecks = {
          samePlayers: usePlayersStore === (window as any).debugGame.players,
          sameFloors: useFloorStore === (window as any).debugGame.floors,
          sameGame: useGameFlowStore === (window as any).debugGame.game,
        };
        logDebug(`Debug helpers added to window.debugGame. Store checks: ${JSON.stringify(storeChecks)}`, "Init");
      }
      
      // Mark initialization as complete
      setIsInitialized(true);
      logDebug("✅ Game initialization complete", "Init");
    }, 250); // Slight timeout to ensure hydration
    
    return () => clearTimeout(timer);
  }, []);

  // Render the game app once initialized, otherwise show the loading children
  return isInitialized ? <GameApp /> : <>{children}</>;
}