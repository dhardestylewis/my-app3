"use client";
// src/components/GameOverScreen.tsx
// Displays the final outcome and analytics for the run.

import { RefreshCw, Building, Users, Scale, CircleHelp, Clock, ArrowLeftRight } from "lucide-react";
import { useGameFlowStore }   from "@/stores/useGameFlowStore";
import { useBuildingStore }   from "@/stores/useBuildingStore";
import { useTelemetryStore }  from "@/stores/useTelemetryStore";
import { Button }             from "@/components/ui/button";
import { shallow }            from "zustand/shallow";

// ─────────────────────────────────────────────────────────
//  Stable primitive selectors (no new refs every render)
// ─────────────────────────────────────────────────────────
const useOutcome      = () => useGameFlowStore(s => s.winnerMessage);
const useGameOverInfo = () => useGameFlowStore(s => s.gameOverReason);
const useResetGame    = () => useGameFlowStore(s => s.resetGame);
const useHeight       = () => useBuildingStore(s => s.getTotalHeight());
const useNetScore     = () => useBuildingStore(s => s.getCurrentNetScore());
const useTelemetry    = () => useTelemetryStore(s => s.telemetry);
// shallow ⇒ React re‑uses snapshot unless telemetry *object changed*

export default function GameOverScreen() {
  // --- Read store state (all selectors are stable) ---
  const winnerMessage   = useOutcome();
  const gameOverReason  = useGameOverInfo();
  const resetGame       = useResetGame();
  const height          = useHeight();
  const currentNetScore = useNetScore();
  const telemetry       = useTelemetry();

  // --- Choose icon / colour once ---------------------
  const { OutcomeIcon, outcomeColor } = (() => {
    if (!winnerMessage) return { OutcomeIcon: CircleHelp, outcomeColor: "text-slate-400" };
    if (winnerMessage.includes("FAVORS DEVELOPER"))  return { OutcomeIcon: Building, outcomeColor: "text-amber-400"  };
    if (winnerMessage.includes("FAVORS COMMUNITY"))  return { OutcomeIcon: Users,    outcomeColor: "text-lime-400"   };
    /* BALANCED (or fallback) */                     return { OutcomeIcon: Scale,    outcomeColor: "text-emerald-400"};
  })();

  // --- Derived display values ------------------------
  const negotiationTimes   = Object.values(telemetry.negotiationTimes);
  const avgNegotiationTime = negotiationTimes.length
      ? (negotiationTimes.reduce((sum, t) => sum + t, 0) / negotiationTimes.length).toFixed(1)
      : "N/A";

  // --- Render ---------------------------------------
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-black p-8 text-white">
      <OutcomeIcon size={64} className={`mb-4 ${outcomeColor}`} />
      <h1 className="mb-3 text-center text-4xl font-bold">Game Over</h1>

      <p className={`mb-4 text-center text-xl font-semibold ${outcomeColor}`}>
        {winnerMessage ?? "Outcome undecided."}
      </p>
      <p className="mb-8 max-w-lg text-center text-slate-400">
        {gameOverReason ?? "The game has ended."}
      </p>

      {/* ── Stats Grid ──────────────────────────────── */}
      <div className="mb-8 grid w-full max-w-2xl grid-cols-1 gap-6 md:grid-cols-2">
        {/* Final Project Stats */}
        <div className="rounded-lg border border-slate-600 bg-slate-700/50 p-4 text-center">
          <h3 className="mb-2 text-lg font-semibold text-slate-300">Final Project Stats</h3>
          <p>Height: {height} stories</p>
          <p>
            Final Balance Score:&nbsp;
            <span className={`font-bold ${outcomeColor}`}>
              {currentNetScore >= 0 ? "+" : ""}
              {currentNetScore}
            </span>
          </p>
        </div>

        {/* Negotiation Analytics */}
        <div className="rounded-lg border border-slate-600 bg-slate-700/50 p-4">
          <h3 className="mb-2 text-center text-lg font-semibold text-slate-300">
            Negotiation Analytics
          </h3>

          <div className="space-y-2 text-slate-300">
            <div className="flex items-center justify-between">
              <span className="flex items-center">
                <Clock className="mr-2 h-4 w-4 text-blue-400" /> Avg. Negotiation Time:
              </span>
              <span className="font-semibold">{avgNegotiationTime}s</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center">
                <ArrowLeftRight className="mr-2 h-4 w-4 text-purple-400" /> Recall Tokens Used:
              </span>
              <span>
                <span className="mr-2 font-semibold text-lime-400">
                  Community: {telemetry.recallsUsed.community}
                </span>
                <span className="font-semibold text-amber-400">
                  Developer: {telemetry.recallsUsed.developer}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <Button size="lg" onClick={resetGame} className="bg-emerald-600 hover:bg-emerald-700">
        <RefreshCw className="mr-2 h-5 w-5" /> Play Again
      </Button>
    </div>
  );
}
