// src/components/GameOverScreen.tsx
// Corrected TelemetryState import.

"use client";

import React from 'react';
import { RefreshCw, Building, Users, Scale, CircleHelp, Clock } from "lucide-react";
import { useGameFlowStore } from "@/stores/useGameFlowStore";
import { useBuildingStore } from "@/stores/useBuildingStore";
// Corrected: Import TelemetryStoreState
import { useTelemetryStore, TelemetryStoreState, GameTelemetry } from "@/stores/useTelemetryStore"; 
import { Button } from "@/components/ui/button";
import { shallow } from 'zustand/shallow'; 
import { useStoreWithEqualityFn } from 'zustand/traditional';

export interface GameOverScreenProps {
  reason: string;
  winnerMessage: string;
  onRestart: () => void;
}

const GameOverScreen: React.FC<GameOverScreenProps> = ({ reason, winnerMessage, onRestart }) => {
    const winnerMessageFromStore = useGameFlowStore(s => s.winnerMessage);
    const gameOverReasonFromStore = useGameFlowStore(s => s.gameOverReason);
    
    const height = useBuildingStore(s => s.getTotalHeight());
    const currentNetScore = useBuildingStore(s => s.getCurrentNetScore());
    
    const telemetryData = useStoreWithEqualityFn(
        useTelemetryStore, 
        (state: TelemetryStoreState): GameTelemetry => state.telemetry, 
        shallow
    );

    const finalWinnerMessage = winnerMessage || winnerMessageFromStore || "Outcome Undetermined";
    const finalGameOverReason = reason || gameOverReasonFromStore || "The game has ended.";

    const { OutcomeIcon, outcomeColor, outcomeText } = React.useMemo(() => {
        const defaultResult = { OutcomeIcon: CircleHelp, outcomeColor: "text-slate-400", outcomeText: "Outcome Undecided" };
        if (!finalWinnerMessage) return defaultResult;
        const lowerWinnerMessage = finalWinnerMessage.toLowerCase();
        if (lowerWinnerMessage.includes("developer")) return { OutcomeIcon: Building, outcomeColor: "text-amber-400", outcomeText: finalWinnerMessage };
        if (lowerWinnerMessage.includes("community")) return { OutcomeIcon: Users, outcomeColor: "text-lime-400", outcomeText: finalWinnerMessage };
        if (lowerWinnerMessage.includes("balanced")) return { OutcomeIcon: Scale, outcomeColor: "text-emerald-400", outcomeText: finalWinnerMessage };
        return { ...defaultResult, outcomeText: finalWinnerMessage };
    }, [finalWinnerMessage]);

    const negotiationTimesArray: number[] = telemetryData.negotiationTimes 
        ? Object.values(telemetryData.negotiationTimes) 
        : [];

    const avgNegotiationTime = negotiationTimesArray.length
        ? (negotiationTimesArray.reduce((sum: number, t: number) => sum + t, 0) / negotiationTimesArray.length).toFixed(1)
        : "N/A";
    
    const recallsCommunity = telemetryData.recallsUsed?.community ?? 0;
    const recallsDeveloper = telemetryData.recallsUsed?.developer ?? 0;

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-800 via-slate-900 to-black p-6 sm:p-8 text-white">
            <OutcomeIcon size={64} className={`mb-4 ${outcomeColor} drop-shadow-lg`} />
            <h1 className="mb-3 text-center text-4xl md:text-5xl font-bold">Game Over</h1>
            <p className={`mb-4 text-center text-xl font-semibold ${outcomeColor}`}>{outcomeText}</p>
            <p className="mb-8 max-w-lg text-center text-base text-slate-400">{finalGameOverReason}</p>

            <div className="mb-8 grid w-full max-w-2xl grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-lg border border-slate-600 bg-slate-700/40 p-4 text-center shadow-md">
                    <h3 className="mb-3 text-lg font-semibold text-slate-300 border-b border-slate-600 pb-2">Final Project</h3>
                    <p className="text-slate-200 text-lg">Height: <span className='font-bold'>{height}</span> stories</p>
                    <p className="text-slate-200 text-lg mt-1">
                        Final Balance: <span className={`font-bold ${outcomeColor}`}>{currentNetScore >= 0 ? "+" : ""}{currentNetScore}</span>
                    </p>
                </div>
                <div className="rounded-lg border border-slate-600 bg-slate-700/40 p-4 shadow-md">
                    <h3 className="mb-3 text-center text-lg font-semibold text-slate-300 border-b border-slate-600 pb-2">Analytics</h3>
                    <div className="space-y-2 text-slate-300 text-sm">
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-blue-400" /> Avg. Negotiation:</span>
                            <span className="font-semibold">{avgNegotiationTime}s</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5"><RefreshCw className="h-4 w-4 text-red-400" /> Recalls Used:</span>
                            <span className='flex gap-3'>
                                <span className="font-semibold text-lime-400">Comm: {recallsCommunity}</span>
                                <span className="font-semibold text-amber-400">Dev: {recallsDeveloper}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
            <Button size="lg" onClick={onRestart} className="bg-emerald-600 hover:bg-emerald-500 text-lg font-semibold tracking-wide py-3 px-6 shadow-lg hover:shadow-emerald-500/30 transition-shadow">
                <RefreshCw className="mr-2 h-5 w-5" /> Play Again
            </Button>
        </div>
    );
};

export default GameOverScreen;