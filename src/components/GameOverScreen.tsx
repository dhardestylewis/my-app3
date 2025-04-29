"use client";
// GameOverScreen.tsx
// This component displays the end-of-game summary, including outcome, building stats, and negotiation analytics.

import { useGameFlowStore } from "@/stores/useGameFlowStore";
import { useBuildingStore } from "@/stores/useBuildingStore";
import { useTelemetryStore } from "@/stores/useTelemetryStore";
import { Button } from "@/components/ui/button";
import {
  Award,
  Users,
  Building,
  RefreshCw,
  Scale,
  CircleHelp,
  Clock,
  ArrowLeftRight,
} from 'lucide-react';

export default function GameOverScreen() {
  // --- State Selectors ---
  const { winnerMessage, gameOverReason, resetGame } = useGameFlowStore((s) => ({
    winnerMessage: s.winnerMessage,
    gameOverReason: s.gameOverReason,
    resetGame: s.resetGame,
  }));

  const { height, currentNetScore } = useBuildingStore((s) => ({
    height: s.getTotalHeight(),           // total building height in stories
    currentNetScore: s.getCurrentNetScore(),
  }));

  const telemetry = useTelemetryStore((s) => s.telemetry);

  // --- Determine outcome icon & color ---
  let OutcomeIcon = CircleHelp;
  let outcomeColor = "text-slate-400";

  if (winnerMessage) {
    if (winnerMessage.includes("FAVORS DEVELOPER")) {
      OutcomeIcon = Building;
      outcomeColor = "text-amber-400";
    } else if (winnerMessage.includes("FAVORS COMMUNITY")) {
      OutcomeIcon = Users;
      outcomeColor = "text-lime-400";
    } else if (winnerMessage.includes("BALANCED")) {
      OutcomeIcon = Scale;
      outcomeColor = "text-emerald-400";
    }
  }

  // --- Compute average negotiation time ---
  const negotiationTimes = Object.values(telemetry.negotiationTimes);
  const avgNegotiationTime = negotiationTimes.length > 0
    ?
      (
        negotiationTimes.reduce((sum, t) => sum + t, 0) /
        negotiationTimes.length
      ).toFixed(1)
    : 'N/A';

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-800 via-slate-900 to-black text-white p-8">
      <OutcomeIcon size={64} className={`mb-4 ${outcomeColor}`} />
      <h1 className="text-4xl font-bold mb-3 text-center">Game Over</h1>
      <p className={`text-xl mb-4 text-center font-semibold ${outcomeColor}`}>
         {winnerMessage || "Outcome undecided."}
      </p>
      <p className="text-slate-400 mb-8 text-center max-w-lg">
        {gameOverReason || "The game has ended."}
      </p>

      <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
        {/* Final Project Stats */}
        <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600 text-center">
          <h3 className="text-lg font-semibold mb-2 text-slate-300">Final Project Stats</h3>
          <p>Height: {height} Stories</p>
          <p>
            Final Balance Score:{' '}
            <span className={`font-bold ${outcomeColor}`}> 
              {currentNetScore >= 0 ? '+' : ''}{currentNetScore}
            </span>
          </p>
        </div>

        {/* Negotiation Analytics */}
        <div className="bg-slate-700/50 p-4 rounded-lg border border-slate-600">
          <h3 className="text-lg font-semibold mb-2 text-slate-300 text-center">
            Negotiation Analytics
          </h3>
          <div className="space-y-2 text-slate-300">
            <div className="flex items-center justify-between">
              <span className="flex items-center">
                <Clock className="mr-2 h-4 w-4 text-blue-400" />
                Avg. Negotiation Time:
              </span>
              <span className="font-semibold">{avgNegotiationTime}s</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center">
                <ArrowLeftRight className="mr-2 h-4 w-4 text-purple-400" />
                Recall Tokens Used:
              </span>
              <span>
                <span className="text-lime-400 font-semibold mr-2">
                  Community: {telemetry.recallsUsed.community}
                </span>
                <span className="text-amber-400 font-semibold">
                  Developer: {telemetry.recallsUsed.developer}
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <Button size="lg" onClick={resetGame} className="bg-emerald-600 hover:bg-emerald-700">
        <RefreshCw className="mr-2 h-5 w-5" /> Play Again
      </Button>
    </div>
  );
}
