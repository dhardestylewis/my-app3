// src/components/ScoreDisplay.tsx (Basic Placeholder)
"use client";
import React from 'react';
import { useBuildingStore } from '@/stores/useBuildingStore';
import { Scale } from 'lucide-react';

const ScoreDisplay: React.FC = () => {
  const netScore = useBuildingStore(state => state.getCurrentNetScore());
  const scoreColor = netScore > 0 ? 'text-amber-400' : netScore < 0 ? 'text-emerald-400' : 'text-slate-300';

  return (
    <div className="flex items-center gap-1.5 text-sm font-medium px-2 py-1 bg-slate-700/50 rounded-md border border-slate-600/50">
      <Scale className={`h-4 w-4 ${scoreColor} flex-shrink-0`} />
      <span className={`font-bold ${scoreColor}`}>{netScore >= 0 ? "+" : ""}{netScore}</span>
      <span className="text-xs text-slate-400 ml-1">Balance</span>
    </div>
  );
};
export default ScoreDisplay;