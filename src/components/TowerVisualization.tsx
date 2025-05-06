// src/components/TowerVisualization.tsx
// Corrected React.cloneElement and PlayerRoleType issues.

"use client";
import React, { useState, useEffect, useMemo } from 'react';
import { useBuildingStore, BuildingUse } from '@/stores/useBuildingStore';
import { Building, Users, Scale, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayerRole } from '@/data/types'; // Import PlayerRole

const getCardHeight = (category: string | undefined): number => {
  return category === 'Housing' ? 12 : 15;
};

export interface FloorSummaryItem {
  floor: number;
  sqft: number;
  uses: BuildingUse[];
  score: number;
}

export interface TowerVisualizationProps {
  floors: FloorSummaryItem[];
  currentFloor: number;
}

const TowerVisualization: React.FC<TowerVisualizationProps> = ({ 
  floors: floorSummaryFromProps, 
  currentFloor: currentNegotiationFloor 
}) => {
  const buildingStateForTotals = useBuildingStore(state => state.building);
  
  const totalScore = useMemo(() => {
    let netScore = buildingStateForTotals.baselineScore + buildingStateForTotals.scorePenaltiesTotal;
    floorSummaryFromProps.forEach(floorData => {
        netScore += floorData.score;
    });
    return netScore;
  }, [floorSummaryFromProps, buildingStateForTotals.baselineScore, buildingStateForTotals.scorePenaltiesTotal]);

  const [compactView, setCompactView] = useState(false);

  useEffect(() => {
    const checkWindowSize = () => setCompactView(window.innerWidth < 768);
    checkWindowSize();
    window.addEventListener('resize', checkWindowSize);
    return () => window.removeEventListener('resize', checkWindowSize);
  }, []);

  const getFloorStyles = useMemo(() => (score: number): { bgColor: string; textColor: string; borderColor: string; icon: React.ReactNode; } => {
    let bgColor, textColor, borderColor, iconNode: React.ReactNode;
    let iconBaseClass = "h-4 w-4 sm:h-5 sm:w-5"; // Base class for icons

    if (score > 0) {
      const intensity = Math.min(Math.abs(score) / 20, 1);
      bgColor = `rgba(245, 158, 11, ${0.3 + intensity * 0.3})`; 
      borderColor = "border-amber-600"; 
      textColor = "text-amber-300"; 
      iconNode = <Building className={`${iconBaseClass} ${textColor}`} />;
    } else if (score < 0) {
      const intensity = Math.min(Math.abs(score) / 20, 1);
      bgColor = `rgba(16, 185, 129, ${0.3 + intensity * 0.3})`; 
      borderColor = "border-emerald-600"; 
      textColor = "text-emerald-300"; 
      iconNode = <Users className={`${iconBaseClass} ${textColor}`} />;
    } else { 
      bgColor = "rgba(51, 65, 85, 0.6)"; 
      borderColor = "border-slate-600"; 
      textColor = "text-slate-300"; 
      iconNode = <Scale className={`${iconBaseClass} ${textColor}`} />;
    }
    return { bgColor, textColor, borderColor, icon: iconNode };
  }, []);

  const formatScore = (score: number) => (score > 0 ? `+${score}` : score.toString());

  return (
    <div className="w-full h-full flex flex-col p-2 sm:p-4 bg-slate-800/30 rounded-lg">
      <div className="flex justify-between items-center mb-4 bg-slate-700/50 p-3 rounded-md border border-slate-600 sticky top-0 z-10 backdrop-blur-sm">
        {/* Header Content ... */}
        <div className="flex items-center">
          <Layers className="h-5 w-5 text-slate-400 mr-2" />
          <h2 className="text-base sm:text-lg font-semibold text-slate-200">Building Status</h2>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="text-center">
            <p className="text-xs text-slate-400">Balance</p>
            <p className={`text-md sm:text-lg font-bold ${totalScore > 0 ? 'text-amber-400' : totalScore < 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
              {formatScore(totalScore)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-400">Floors</p>
            <p className="text-md sm:text-lg font-bold text-slate-200">
              {floorSummaryFromProps.length}
            </p>
          </div>
          <button
            className="text-xs text-slate-300 border border-slate-600 rounded px-2 py-1 hover:bg-slate-600/70 transition-colors"
            onClick={() => setCompactView(!compactView)}
            title={compactView ? "Show Full View" : "Show Compact View"}
          >
            {compactView ? "Full" : "Compact"}
          </button>
        </div>
      </div>

      {floorSummaryFromProps.length === 0 && (
          <div className="flex-grow flex items-center justify-center">
            <div className="text-center text-slate-500 italic p-8 bg-slate-700/30 rounded-lg border border-slate-600">
                <Layers className="h-12 w-12 mx-auto mb-3 text-slate-500" />
                <p className="mb-2 text-slate-300">No floors built yet.</p>
                <p className="text-xs">Start negotiating to construct your building!</p>
            </div>
          </div>
      )}

      <div className="flex-grow relative flex flex-col justify-end overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent pb-2 pr-1">
        <div className="h-1 sm:h-2 w-full bg-slate-600 mb-1 sm:mb-2 rounded-sm"></div>
        <AnimatePresence>
          {floorSummaryFromProps.map((floor) => {
            const { bgColor, textColor, borderColor, icon } = getFloorStyles(floor.score);
            const isCurrent = floor.floor === currentNegotiationFloor;
            return (
              <motion.div
                key={`floor-${floor.floor}`}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20, transition: {duration: 0.2} }}
                transition={{ type: "spring", stiffness: 260, damping: 20, duration: 0.3 }}
                className={`mb-1.5 sm:mb-2 rounded-md border ${borderColor} ${isCurrent ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-800 shadow-lg' : 'shadow-md'} overflow-hidden`}
                style={{ backgroundColor: bgColor }}
              >
                {compactView ? (
                    <div className={`py-1.5 sm:py-2 px-2 sm:px-3 flex items-center justify-between ${isCurrent ? 'bg-sky-500/10': ''}`}>
                        <div className="flex items-center">
                            <div className={`flex-shrink-0 w-6 h-6 sm:w-7 sm:h-7 bg-slate-800/70 rounded-full flex items-center justify-center mr-2 border ${isCurrent ? 'border-sky-400' : 'border-slate-600'}`}>
                                <span className={`font-semibold text-xs sm:text-sm ${isCurrent ? 'text-sky-300' : 'text-slate-200'}`}>{floor.floor}</span>
                            </div>
                            <span className={`text-xs sm:text-sm font-medium ${textColor} ${isCurrent ? 'font-bold' : ''}`}>Floor {floor.floor}</span>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2">
                            {icon} {/* Render the icon directly */}
                            <span className={`font-bold text-sm sm:text-base ${textColor}`}>{formatScore(floor.score)}</span>
                        </div>
                    </div>
                ) : (
                    <div className={`p-2 sm:p-3 flex items-center ${isCurrent ? 'bg-sky-500/10': ''}`}>
                        <div className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 bg-slate-800/70 rounded-full flex items-center justify-center mr-2 sm:mr-3 border ${isCurrent ? 'border-sky-400' : 'border-slate-600'}`}>
                            <span className={`font-semibold text-sm sm:text-base ${isCurrent ? 'text-sky-300' : 'text-slate-200'}`}>{floor.floor}</span>
                        </div>
                        <div className="flex-grow min-w-0">
                            <div className="flex items-center">
                                {icon} {/* Render the icon directly */}
                                <span className={`ml-1.5 font-semibold ${textColor} truncate text-sm sm:text-base ${isCurrent ? 'font-bold' : ''}`}>
                                    Floor {floor.floor}
                                    <span className="text-slate-400 ml-1.5 sm:ml-2 text-xs">({Math.round(floor.sqft).toLocaleString()} sq.ft)</span>
                                </span>
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1 text-xs">
                                {floor.uses.map((use, idx) => (
                                    <span key={`use-${floor.floor}-${idx}`}
                                        className={`px-1.5 py-0.5 rounded truncate max-w-[100px] sm:max-w-[150px] border text-xs ${
                                            // Corrected: Use imported PlayerRole enum
                                            use.owner === PlayerRole.Developer 
                                            ? 'bg-amber-950/60 text-amber-300 border-amber-700/50' 
                                            : 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
                                        }`}
                                        title={`${(use.units || 0) > 1 ? `${use.units}× ` : ''}${use.cardName} (${use.owner})`}>
                                        {(use.units || 0) > 1 ? `${use.units}× ` : ''}{use.cardName}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="flex-shrink-0 ml-2 text-right">
                            <span className={`font-bold text-sm sm:text-base ${textColor}`}>{formatScore(floor.score)}</span>
                        </div>
                    </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="mt-3 bg-slate-700/50 p-2 rounded-md border border-slate-600 flex justify-around text-xs">
        {/* ... (Legend as before) ... */}
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-amber-500/70 rounded-sm border border-amber-700/50"></div><span className="text-amber-300">Developer</span></div>
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-emerald-500/70 rounded-sm border border-emerald-700/50"></div><span className="text-emerald-300">Community</span></div>
        <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-slate-500/70 rounded-sm border border-slate-600/50"></div><span className="text-slate-300">Neutral</span></div>
      </div>
    </div>
  );
};

export default TowerVisualization;