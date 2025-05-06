// src/components/ClientLayout.tsx
// Corrected: Ensures 'export default' is top-level and GamePhase comparison is fixed.

'use client';

import { useEffect, useState } from "react";
import { usePlayersStore } from "@/stores/usePlayersStore";
import { useGameFlowStore } from "@/stores/useGameFlowStore";
import { useFloorStore } from "@/stores/useFloorStore";
import { logDebug } from "@/utils/logger";
import dynamic from "next/dynamic";
import { GamePhase, PlayerRole } from "@/data/types"; // GamePhase is the enum

const GameApp = dynamic(() => import("@/App"), { 
  ssr: false, 
  loading: () => (
    <div className="flex h-screen w-full items-center justify-center bg-slate-900 text-slate-300">
      {/* You can use your LoadingIndicator component here if available */}
      <div className="animate-pulse text-xl">Loading Game Application...</div>
    </div>
  ),
});

// This MUST be at the top level of the module
export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    logDebug("🔄 ClientLayout mounting. Setting up debug helpers and marking initialized.", "Init");
    
    const timer = setTimeout(() => {
      const playerStore = usePlayersStore.getState();
      const gameFlowStore = useGameFlowStore.getState(); // Get store state snapshot
      
      const playersOK = playerStore.players?.length > 0 && typeof playerStore.players?.[0]?.id === "string";
          
      // Corrected: Use gameFlowStore.gamePhase for comparison against enum members
      if (!playersOK && gameFlowStore.gamePhase !== GamePhase.Playing) {
        logDebug("[ClientLayout Init] No players found or game not in Playing phase – App.tsx useEffect should handle primary init.", "Init");
      }
      if (gameFlowStore.gamePhase === GamePhase.Title && typeof gameFlowStore.startGame === 'function') {
        // logDebug("[ClientLayout Init] Game in Title phase. App/TitleScreen responsible for starting.", "Init");
      }
      
      if (typeof window !== "undefined") {
        (window as any).debugGame = {
          players: usePlayersStore,
          floors: useFloorStore,
          game: useGameFlowStore,
          resetPlayers: () => usePlayersStore.getState().resetToDefaults?.(),
          logPlayers: () => usePlayersStore.getState().logPlayerState?.(),
          toggleAiTurn: () => {
            const gfState = useGameFlowStore.getState();
            useGameFlowStore.setState({ isAiTurn: !gfState.isAiTurn });
            logDebug(`Debug: Toggled AI turn. Now: ${useGameFlowStore.getState().isAiTurn ? 'AI' : 'Player'}`, "Debug");
          }
        };
        logDebug(`Debug helpers added to window.debugGame.`, "Init");
      }
      
      setIsInitialized(true);
      logDebug("✅ ClientLayout: GameApp will now render.", "Init");
    }, 250); 

    return () => clearTimeout(timer);
  }, []); // Empty dependency array ensures this runs only once on mount

  return isInitialized ? <GameApp /> : <>{children}</>;
}