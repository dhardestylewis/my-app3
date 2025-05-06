// src/components/PlayerStatsPanel.tsx (Corrected)
"use client";
import React from 'react';
import { Player, PlayerRole, PlayerType } from '@/data/types'; // Import PlayerRole
import { User, Bot, Users as UsersIcon } from 'lucide-react'; // Changed Users to UsersIcon to avoid conflict

export interface PlayerStatsPanelProps {
  humanPlayer?: Player;
  aiPlayer?: Player;
  currentPlayerId?: string;
}

const PlayerStatsPanel: React.FC<PlayerStatsPanelProps> = ({ humanPlayer, aiPlayer, currentPlayerId }) => {
  const renderPlayerInfo = (player?: Player, isHuman = false) => {
    if (!player) return null;
    const isActive = player.id === currentPlayerId;
    const bgColor = isActive ? 'bg-sky-700/30' : 'bg-slate-700/50';
    const borderColor = isActive ? 'border-sky-500' : 'border-slate-600';
    const roleText = player.role === PlayerRole.Developer ? "Developer" : "Community"; // Use imported PlayerRole

    return (
      <div className={`p-3 rounded mb-2 border ${borderColor} ${bgColor} transition-all`}>
        <div className="flex items-center justify-between mb-1">
            <p className="font-medium text-slate-100 flex items-center">
                {isHuman ? <User size={16} className="mr-2 text-sky-400"/> : <Bot size={16} className="mr-2 text-red-400"/>}
                {player.name} {isHuman && "(You)"}
            </p>
            {isActive && <span className="text-xs bg-sky-500 text-white px-2 py-0.5 rounded-full">Active</span>}
        </div>
        <p className="text-xs text-slate-300">Role: <span className="font-medium">{roleText}</span></p>
        <p className="text-xs text-slate-400">Recall Tokens: <span className="font-semibold text-slate-200">{player.recallTokens}</span></p>
      </div>
    );
  };

  return (
    <div className="p-3 border-b border-slate-700 bg-slate-800">
      <h3 className="text-md font-semibold text-slate-200 mb-3 flex items-center">
        <UsersIcon className="h-5 w-5 mr-2 text-slate-400"/>Player Status {/* Corrected to UsersIcon */}
      </h3>
      {renderPlayerInfo(humanPlayer, true)}
      {renderPlayerInfo(aiPlayer, false)}
    </div>
  );
};
export default PlayerStatsPanel;