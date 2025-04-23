"use client";
import { useState, useEffect, useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { Building, Users, Scale, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const TowerVisualization = () => {
  const getFloorSummary = useGameStore(state => state.getFloorSummary);
  const [buildingData, setBuildingData] = useState({
    floorData: [],
    totalScore: 0
  });
  const [compactView, setCompactView] = useState(false);

  // Update building data when the game state changes
  useEffect(() => {
    const updateBuildingData = () => {
      const summary = getFloorSummary();
      setBuildingData(summary);
    };

    // Initial update
    updateBuildingData();

    // Set up interval for regular updates
    const intervalId = setInterval(updateBuildingData, 1000);
    
    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, [getFloorSummary]);
  
  // Check if screen is small to automatically toggle compact view
  useEffect(() => {
    const checkWindowSize = () => {
      setCompactView(window.innerWidth < 768);
    };
    
    // Initial check
    checkWindowSize();
    
    // Set up listener for window resize
    window.addEventListener('resize', checkWindowSize);
    
    // Clean up
    return () => window.removeEventListener('resize', checkWindowSize);
  }, []);

  // Function to determine floor color based on score
  const getFloorStyles = useMemo(() => (score: number) => {
    let bgColor, textColor, borderColor, icon;
    
    if (score > 0) {
      // Developer-favoring (positive score) - amber/gold
      const intensity = Math.min(Math.abs(score) / 20, 1);
      bgColor = `rgba(245, 158, 11, ${0.3 + intensity * 0.3})`;
      borderColor = "border-amber-600";
      textColor = "text-amber-400";
      icon = <Building className="h-4 w-4 text-amber-400" />;
    } else if (score < 0) {
      // Community-favoring (negative score) - green
      const intensity = Math.min(Math.abs(score) / 20, 1);
      bgColor = `rgba(16, 185, 129, ${0.2 + intensity * 0.3})`;
      borderColor = "border-emerald-700";
      textColor = "text-emerald-400";
      icon = <Users className="h-4 w-4 text-emerald-400" />;
    } else {
      // Neutral - slate
      bgColor = "rgba(51, 65, 85, 0.5)";
      borderColor = "border-slate-600";
      textColor = "text-slate-400";
      icon = <Scale className="h-4 w-4 text-slate-400" />;
    }
    
    return { bgColor, textColor, borderColor, icon };
  }, []);

  // Format score with sign
  const formatScore = (score: number) => {
    return score > 0 ? `+${score}` : score.toString();
  };

  return (
    <div className="w-full h-full flex flex-col p-4">
      {/* Building Info Header */}
      <div className="flex justify-between items-center mb-4 bg-slate-800/70 p-3 rounded-lg border border-slate-700 sticky top-0 z-10">
        <div className="flex items-center">
          <Layers className="h-5 w-5 text-slate-400 mr-2" />
          <h2 className="text-lg font-semibold text-slate-300">Building Visualization</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-xs text-slate-400">Balance Score</p>
            <p className={`text-lg font-bold ${
              buildingData.totalScore > 0 
                ? 'text-amber-400' 
                : buildingData.totalScore < 0 
                  ? 'text-emerald-400' 
                  : 'text-slate-300'
            }`}>
              {formatScore(buildingData.totalScore)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-400">Floors</p>
            <p className="text-lg font-bold text-slate-300">
              {buildingData.floorData.length}
            </p>
          </div>
          {/* Toggle for compact view */}
          <button 
            className="text-xs text-slate-400 border border-slate-700 rounded px-2 py-1 hover:bg-slate-700"
            onClick={() => setCompactView(!compactView)}
            title={compactView ? "Show full view" : "Show compact view"}
          >
            {compactView ? "Expand" : "Compact"}
          </button>
        </div>
      </div>
      
      {/* Empty state message */}
      {buildingData.floorData.length === 0 && (
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center text-slate-500 italic p-8 bg-slate-800/40 rounded-lg border border-slate-700">
            <Layers className="h-12 w-12 mx-auto mb-3 text-slate-600" />
            <p className="mb-2">No floors built yet</p>
            <p className="text-xs">Start negotiating to construct your building!</p>
          </div>
        </div>
      )}
      
      {/* Tower Visualization */}
      <div className="flex-grow relative flex flex-col justify-end overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-transparent pb-2 pr-2">
        {/* Ground Level */}
        <div className="h-2 w-full bg-slate-700 mb-2 rounded-sm"></div>
        
        {/* Floors from bottom to top */}
        <AnimatePresence>
          {buildingData.floorData.map((floor) => {
            const { bgColor, textColor, borderColor, icon } = getFloorStyles(floor.score);
            
            return (
              <motion.div 
                key={`floor-${floor.floor}`}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                className={`mb-2 rounded-md border ${borderColor} overflow-hidden`}
                style={{ backgroundColor: bgColor }}
              >
                {compactView ? (
                  // Compact view for small screens
                  <div className="py-2 px-3 flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center mr-2 border border-slate-600">
                        <span className="font-semibold text-sm">{floor.floor}</span>
                      </div>
                      <div>
                        <span className={`text-sm font-medium ${textColor}`}>
                          Floor {floor.floor}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {icon}
                      <span className={`font-bold ${textColor}`}>
                        {formatScore(floor.score)}
                      </span>
                    </div>
                  </div>
                ) : (
                  // Full view with details
                  <div className="p-3 flex items-center">
                    {/* Floor Number */}
                    <div className="flex-shrink-0 w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center mr-3 border border-slate-600">
                      <span className="font-semibold">{floor.floor}</span>
                    </div>
                    
                    {/* Floor Info */}
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center">
                        {icon}
                        <span className={`ml-1 font-semibold ${textColor} truncate`}>
                          Floor {floor.floor} 
                          <span className="text-slate-500 ml-2 text-xs">
                            ({Math.round(floor.sqft).toLocaleString()} sq.ft.)
                          </span>
                        </span>
                      </div>
                      
                      {/* Uses */}
                      <div className="mt-1 flex flex-wrap gap-1 text-xs">
                        {floor.uses.map((use, idx) => (
                          <span 
                            key={`use-${floor.floor}-${idx}`}
                            className={`px-1.5 py-0.5 rounded truncate max-w-[150px] ${
                              use.owner === 'developer' 
                                ? 'bg-amber-950/50 text-amber-400 border border-amber-800/50' 
                                : 'bg-emerald-950/50 text-emerald-400 border border-emerald-800/50'
                            }`}
                            title={`${use.units > 1 ? `${use.units}× ` : ''}${use.cardName}`}
                          >
                            {use.units > 1 ? `${use.units}× ` : ''}{use.cardName}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    {/* Score */}
                    <div className="flex-shrink-0 ml-2">
                      <span className={`font-bold ${textColor}`}>
                        {formatScore(floor.score)}
                      </span>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      
      {/* Legend */}
      <div className="mt-3 bg-slate-800/70 p-2 rounded-md border border-slate-700 flex justify-around text-xs">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-amber-500/70 rounded mr-1"></div>
          <span className="text-amber-400">Developer</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-emerald-500/70 rounded mr-1"></div>
          <span className="text-emerald-400">Community</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-slate-600 rounded mr-1"></div>
          <span className="text-slate-400">Neutral</span>
        </div>
      </div>
    </div>
  );
};

export default TowerVisualization;