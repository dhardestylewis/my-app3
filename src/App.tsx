// src/App.tsx
// Fully refactored: no conditional hooks, debug panel hook-free, renderAppContent hook-free.

"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { shallow } from "zustand/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";

// UI Components
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/components/ui/use-toast";
import { ThemeProvider } from "@/components/theme-provider";
import LoadingIndicator from "@/components/ui/LoadingIndicator";

// Game Components
import TitleScreen from "@/components/TitleScreen";
import GameInterface from "@/components/GameInterface";
import GameOverScreen, { GameOverScreenProps } from "@/components/GameOverScreen";

// Stores
import { useGameFlowStore, GamePhase } from "@/stores/useGameFlowStore";
import {
  usePlayersStore,
  PlayerRole,
  PlayersStoreState,
} from "@/stores/usePlayersStore";
import {
  useFloorStore,
  FloorState as FloorDataType,
} from "@/stores/useFloorStore";
import { useBuildingStore } from "@/stores/useBuildingStore";
import { useAIStore } from "@/stores/useAIStore";

// Utils
import { logDebug, logError, logInfo, logWarn } from "@/utils/logger";
import {
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

const HUMAN_PLAYER_ROLE_APP = PlayerRole.Developer;
const AI_DIFFICULTY_LEVEL_APP = "normal";

export default function App() {
  // ——— State & Toast —————————————————————————————————————————
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [showDebug, setShowDebug] = useState(false);

  // ——— All hooks, unconditionally at top ————————————————————————
  const gamePhase               = useGameFlowStore(s => s.gamePhase);
  const gameOverReason          = useGameFlowStore(s => s.gameOverReason);
  const winnerMessage           = useGameFlowStore(s => s.winnerMessage);

  const deckCardDefinitionsCount = usePlayersStore(
    s => s.deckCardDefinitions.length
  );
  const currentFloor             = useFloorStore(s => s.currentFloor);
  const currentPlayer            = useStoreWithEqualityFn(
    usePlayersStore,
    s => s.getCurrentPlayer(),
    shallow
  );
  const netScore                 = useBuildingStore(s => s.getCurrentNetScore());
  const isThinking               = useAIStore(s => s.isAIThinking);
  const gameLog                  = useGameFlowStore(s => s.gameLog);
  const proposalBasketForDebug   = useStoreWithEqualityFn(
    usePlayersStore,
    s => s.getCurrentProposalBasket(),
    shallow
  );
  const counterBasketForDebug    = useStoreWithEqualityFn(
    usePlayersStore,
    s => s.getCurrentCounterProposalBasket(),
    shallow
  );

  // Grab stable actions directly
  const { startGame, resetGame } = useGameFlowStore.getState();
  const {
    initializePlayers,
    cycleProposalCountForCard,
    cycleCounterProposalCountForCard,
  } = usePlayersStore.getState();
  const { setDifficultyLevel: setAIDifficulty } = useAIStore.getState();

  // ——— Effects ———————————————————————————————————————————————
  useEffect(() => {
    logInfo("App mounted. Initializing game systems.", "AppBoot");
    try {
      initializePlayers(HUMAN_PLAYER_ROLE_APP);
      setAIDifficulty(AI_DIFFICULTY_LEVEL_APP);
      setIsLoading(false);
      logInfo("Initialization tasks complete.", "AppBoot");
    } catch (error) {
      logError(
        "Critical error during app initialization.",
        error instanceof Error ? error : new Error(String(error)),
        "AppBoot"
      );
      toast({
        title: "Initialization Error",
        description: "Failed to initialize game components. Please refresh.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  }, [initializePlayers, setAIDifficulty, toast]);

  // ——— Callbacks & DnD ————————————————————————————————————————
  const handleStartGame = useCallback(
    (role: PlayerRole) => {
      logDebug(`Starting game as ${role}`, "AppEvents");
      startGame(role);
    },
    [startGame]
  );

  const handleResetGame = useCallback(() => {
    logDebug("Resetting game", "AppEvents");
    resetGame();
    initializePlayers(HUMAN_PLAYER_ROLE_APP);
    setAIDifficulty(AI_DIFFICULTY_LEVEL_APP);
  }, [resetGame, initializePlayers, setAIDifficulty]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !active.data.current?.isHandCard)
        return;

      const cardId = active.id as string;
      const dropId = over.id as string;
      const flow   = useGameFlowStore.getState();

      if (flow.isAiTurn || flow.waitForPlayerAcknowledgement) return;

      const players = usePlayersStore.getState();
      const floors  = useFloorStore.getState();
      const player  = players.getCurrentPlayer();
      const floor   = floors.floors.find(
        f => f.floorNumber === floors.currentFloor
      );
      const lead    = players.getLeadPlayer(floors.currentFloor);
      if (!player || !floor) return;

      const isLead    = player.id === lead?.id;
      const hasA      = !!floor.proposalA?.length;
      const hasB      = !!floor.proposalB?.length;
      const isInitial = isLead && !hasA && !hasB;
      const isResp    = !isLead && hasA && !hasB;

      if (dropId === "lead-proposal" && isInitial)
        cycleProposalCountForCard(cardId);
      else if (dropId === "counter-proposal" && isResp)
        cycleCounterProposalCountForCard(cardId);
      else
        logWarn(`Dropped ${cardId} on ${dropId} at wrong time`, "AppDnD");
    },
    [cycleProposalCountForCard, cycleCounterProposalCountForCard]
  );

  // ——— Pure render function, no hooks inside —————————————————————
  const renderAppContent = () => {
    switch (gamePhase) {
      case GamePhase.Title:
        return <TitleScreen onStartGame={handleStartGame} />;

      case GamePhase.Playing:
        return <GameInterface onResetGame={handleResetGame} />;

      case GamePhase.GameOver: {
        const props: GameOverScreenProps = {
          reason:        gameOverReason || "Game Over",
          winnerMessage: winnerMessage || "",
          onRestart:     handleResetGame,
        };
        return <GameOverScreen {...props} />;
      }

      default:
        return (
          <div className="flex items-center justify-center h-full text-slate-400">
            Loading game state…
          </div>
        );
    }
  };

  // ——— Early return during loading ———————————————————————————
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <LoadingIndicator />
        <span className="ml-2">Initializing Game…</span>
      </div>
    );
  }

  // ——— Main JSX —————————————————————————————————————————————
  return (
    <DndProvider backend={HTML5Backend}>
      <ThemeProvider defaultTheme="dark" storageKey="urbanbalance-theme-app-v2">
        <Suspense
          fallback={
            <div className="flex items-center justify-center min-h-screen">
              <LoadingIndicator /> Page loading…
            </div>
          }
        >
          {renderAppContent()}
        </Suspense>

        <Toaster />

        <button
          onClick={() => setShowDebug(prev => !prev)}
          className="fixed bottom-2 right-2 bg-slate-700 hover:bg-slate-600 text-white p-2 rounded text-xs z-[100]"
        >
          {showDebug ? "Hide" : "Show"} Debug
        </button>

        {showDebug && (
          <div className="fixed bottom-10 right-2 bg-slate-800/95 text-white p-3 rounded shadow-lg max-w-md max-h-72 overflow-auto text-xs z-[99] border border-slate-600 backdrop-blur-sm">
            <h4 className="font-bold mb-1">Debug Info</h4>
            <p>Phase: {gamePhase}</p>
            <p>
              Player: {currentPlayer?.name.slice(0, 10)} (
              {currentPlayer?.id.slice(0, 3)})
            </p>
            <p>
              Deck: {deckCardDefinitionsCount}, Floor: {currentFloor}, Score:{" "}
              {netScore}
            </p>
            <p>AI Thinking: {isThinking.toString()}</p>
            <p>
              PropBasket:{" "}
              {proposalBasketForDebug
                .map(i => `${i.definitionId.slice(0, 3)}×${i.count}`)
                .join(", ") || "[]"}
            </p>
            <p>
              CntrBasket:{" "}
              {counterBasketForDebug
                .map(i => `${i.definitionId.slice(0, 3)}×${i.count}`)
                .join(", ") || "[]"}
            </p>
            <p className="mt-1 font-semibold">--- Recent Logs ---</p>
            {gameLog.slice(0, 3).map((msg, i) => (
              <p key={i} className="truncate text-slate-400">
                {msg}
              </p>
            ))}
          </div>
        )}
      </ThemeProvider>
    </DndProvider>
  );
}
