"use client";
import { useState, useMemo } from 'react';
import { useGameStore } from '@/store/useGameStore';
import { Button } from "@/components/ui/button";
import { 
  Layers, 
  RefreshCcw, 
  Check, 
  Clock, 
  AlertTriangle, 
  ChevronRight, 
  ChevronLeft,
  ArrowUp,
  X,
  Info
} from 'lucide-react';
import { FloorState } from '@/data/types';
import { motion, AnimatePresence } from 'framer-motion';

const FloorTimeline = () => {
  // State from store
  const floors = useGameStore(state => state.floors);
  const currentFloor = useGameStore(state => state.currentFloor);
  const useRecallToken = useGameStore(state => state.useRecallToken);
  const players = useGameStore(state => state.players);
  const currentPlayerIndex = useGameStore(state => state.currentPlayerIndex);
  
  // Local state
  const [hoveredFloor, setHoveredFloor] = useState<number | null>(null);
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'compact' | 'normal' | 'expanded'>('normal');
  const [tooltipPosition, setTooltipPosition] = useState<'top' | 'bottom'>('top');
  
  // Derived state
  const currentPlayer = useMemo(() => 
    players[currentPlayerIndex], 
  [players, currentPlayerIndex]);
  
  const hasRecallTokens = useMemo(() => 
    (currentPlayer?.recallTokens || 0) > 0,
  [currentPlayer?.recallTokens]);
  
  const RECALL_MAX_FLOOR = 12; // Same as in store
  
  // Calculate visible floors based on view mode and current floor
  const visibleFloors = useMemo(() => {
    // All floors available in the game
    const allFloors = floors.slice(0, 25);
    
    // Show all floors in expanded mode
    if (viewMode === 'expanded') {
      return allFloors;
    }
    
    // Only show current and adjacent floors in compact mode
    if (viewMode === 'compact') {
      const startFloor = Math.max(1, currentFloor - 1);
      const endFloor = Math.min(25, currentFloor + 1);
      return allFloors.filter(f => 
        f.floorNumber >= startFloor && f.floorNumber <= endFloor
      );
    }
    
    // Normal mode: show a range around current floor
    const startFloor = Math.max(1, currentFloor - 2);
    const endFloor = Math.min(25, currentFloor + 4);
    return allFloors.filter(f => 
      f.floorNumber >= startFloor && f.floorNumber <= endFloor
    );
  }, [floors, currentFloor, viewMode]);
  
  // Toggle tooltip position based on floor position
  const getTooltipPosition = (floorNumber: number) => {
    return floorNumber >= 15 ? 'bottom' : 'top';
  };
  
  // Get appropriate styling classes based on floor status
  const getFloorClasses = (floor: FloorState) => {
    const baseClasses = "flex items-center justify-center rounded-md border shadow-md transition-all duration-200";
    
    // Size classes based on view mode
    const sizeClasses = viewMode === 'compact' 
      ? "w-8 h-8 text-xs" 
      : "w-10 h-10 text-sm";
    
    // Color classes based on status
    let statusClasses = "";
    if (floor.status === 'agreed') {
      statusClasses = "bg-emerald-600 border-emerald-400 text-white";
    } else if (floor.status === 'reopened') {
      statusClasses = "bg-yellow-600 border-yellow-400 text-white";
    } else if (floor.floorNumber === currentFloor) {
      statusClasses = "bg-blue-600 border-blue-400 text-white animate-pulse";
    } else {
      statusClasses = "bg-slate-700 border-slate-500 text-slate-300";
    }
    
    // Hover and active classes
    const interactionClasses = `
      ${hoveredFloor === floor.floorNumber ? 'ring-2 ring-white' : ''}
      ${activeTooltip === floor.floorNumber ? 'ring-2 ring-white scale-110' : ''}
      hover:scale-105 hover:shadow-lg
    `;
    
    return `${baseClasses} ${sizeClasses} ${statusClasses} ${interactionClasses}`;
  };
  
  // Get tooltip content for a floor
  const getTooltipContent = (floor: FloorState) => {
    // For completed floors
    if (floor.status === 'agreed' && floor.winnerCard) {
      return (
        <div className="w-64 p-3">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center">
              <Check size={16} className="text-emerald-400 mr-2" />
              <h3 className="font-bold text-white text-sm">Floor {floor.floorNumber}</h3>
            </div>
            <button 
              className="text-slate-400 hover:text-white"
              onClick={() => setActiveTooltip(null)}
            >
              <X size={14} />
            </button>
          </div>
          
          <div className="bg-slate-700/70 p-2 rounded mb-2">
            <p className="font-semibold text-emerald-300 text-sm">{floor.winnerCard.name}</p>
            <div className="flex justify-between text-xs mt-1">
              <span>Impact: <span className={floor.winnerCard.netScoreImpact > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                {floor.winnerCard.netScoreImpact > 0 ? '+' : ''}{floor.winnerCard.netScoreImpact}
              </span></span>
              <span>Committed by: {
                floor.committedBy === 'A' ? 'Player A' : 
                floor.committedBy === 'B' ? 'Player B' : 
                'AI Mediator'
              }</span>
            </div>
          </div>
          
          {hasRecallTokens && floor.floorNumber < currentFloor && floor.floorNumber < RECALL_MAX_FLOOR && (
            <Button 
              variant="destructive"
              size="sm"
              className="w-full bg-red-800 hover:bg-red-700 text-xs h-7"
              onClick={(e) => {
                e.stopPropagation();
                useRecallToken(floor.floorNumber);
                setActiveTooltip(null);
              }}
            >
              <RefreshCcw className="mr-1 h-3 w-3" /> Use Recall Token
            </Button>
          )}
        </div>
      );
    }
    
    // For current floor
    if (floor.floorNumber === currentFloor) {
      return (
        <div className="w-56 p-3">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center">
              <Clock size={16} className="text-blue-400 mr-2" />
              <h3 className="font-bold text-white text-sm">Current Floor</h3>
            </div>
            <button 
              className="text-slate-400 hover:text-white"
              onClick={() => setActiveTooltip(null)}
            >
              <X size={14} />
            </button>
          </div>
          
          <div className="text-xs text-slate-300">
            <p>Currently in negotiation</p>
            {floor.proposalA && (
              <div className="mt-2 p-1.5 bg-slate-700/70 rounded">
                <p className="font-medium">Lead proposal: <span className="text-blue-400">{floor.proposalA.name}</span></p>
              </div>
            )}
            {floor.proposalB && (
              <div className="mt-1 p-1.5 bg-slate-700/70 rounded">
                <p className="font-medium">Counter proposal: <span className="text-purple-400">{floor.proposalB.name}</span></p>
              </div>
            )}
          </div>
        </div>
      );
    }
    
    // For reopened floors
    if (floor.status === 'reopened') {
      return (
        <div className="w-56 p-3">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center">
              <RefreshCcw size={16} className="text-yellow-400 mr-2" />
              <h3 className="font-bold text-white text-sm">Reopened Floor</h3>
            </div>
            <button 
              className="text-slate-400 hover:text-white"
              onClick={() => setActiveTooltip(null)}
            >
              <X size={14} />
            </button>
          </div>
          
          <div className="text-xs text-slate-300">
            <p>This floor is being renegotiated</p>
            <p className="mt-1 italic text-yellow-300">A recall token was used to reopen this floor</p>
          </div>
        </div>
      );
    }
    
    // For future floors
    return (
      <div className="w-48 p-3">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center">
            <Info size={16} className="text-slate-400 mr-2" />
            <h3 className="font-bold text-white text-sm">Floor {floor.floorNumber}</h3>
          </div>
          <button 
            className="text-slate-400 hover:text-white"
            onClick={() => setActiveTooltip(null)}
          >
            <X size={14} />
          </button>
        </div>
        
        <div className="text-xs text-slate-300">
          <p>Not yet built</p>
          {floor.floorNumber > currentFloor && (
            <p className="mt-1 italic">Will be negotiated after current floor</p>
          )}
        </div>
      </div>
    );
  };
  
  // Cycle through view modes
  const cycleViewMode = () => {
    if (viewMode === 'compact') setViewMode('normal');
    else if (viewMode === 'normal') setViewMode('expanded');
    else setViewMode('compact');
  };
  
  return (
    <div className="p-4 bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-700 h-full">
      {/* Header with title and controls */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-slate-300 flex items-center">
          <Layers className="mr-2 h-5 w-5 text-slate-400" />
          Floor Timeline
        </h2>
        <div className="flex items-center gap-2">
          {/* Recall tokens badge */}
          <div className="text-xs text-slate-400 bg-slate-700 px-2 py-1 rounded-full">
            Recall: <span className="font-bold">{currentPlayer?.recallTokens || 0}/2</span>
          </div>
          
          {/* View mode toggle */}
          <Button 
            variant="outline" 
            size="sm" 
            className="h-7 text-xs border-slate-600 text-slate-300"
            onClick={cycleViewMode}
          >
            {viewMode === 'compact' ? 'Normal' : viewMode === 'normal' ? 'Expand' : 'Compact'}
          </Button>
        </div>
      </div>
      
      {/* Navigation for expanded view */}
      {viewMode === 'expanded' && visibleFloors.length > 10 && (
        <div className="flex justify-between items-center mb-2 text-xs text-slate-400">
          <span>Floors {visibleFloors[0]?.floorNumber} - {visibleFloors[visibleFloors.length-1]?.floorNumber}</span>
          <span>Total: {floors.length}</span>
        </div>
      )}
      
      {/* Scrollable floor tiles */}
      <div className="overflow-x-auto pb-2 mb-2">
        <div className="flex gap-2 pr-2 flex-wrap">
          {visibleFloors.map((floor) => (
            <div 
              key={`floor-${floor.floorNumber}`}
              className="relative"
              onMouseEnter={() => setHoveredFloor(floor.floorNumber)}
              onMouseLeave={() => setHoveredFloor(null)}
            >
              {/* Floor tile */}
              <button
                className={getFloorClasses(floor)}
                onClick={() => {
                  // Toggle tooltip on/off when clicked
                  setActiveTooltip(activeTooltip === floor.floorNumber ? null : floor.floorNumber);
                  setTooltipPosition(getTooltipPosition(floor.floorNumber));
                }}
                title={`Floor ${floor.floorNumber}`}
              >
                {floor.floorNumber}
                
                {/* Small indicator for floor with cards */}
                {floor.status === 'agreed' && (
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white rounded-full border border-slate-700"></div>
                )}
                
                {/* Current floor indicator */}
                {floor.floorNumber === currentFloor && (
                  <div className="absolute -top-1 -right-1">
                    <ArrowUp size={10} className="text-white" />
                  </div>
                )}
              </button>
              
              {/* Tooltip */}
              <AnimatePresence>
                {activeTooltip === floor.floorNumber && (
                  <motion.div 
                    initial={{ opacity: 0, y: tooltipPosition === 'top' ? -10 : 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    className={`absolute z-50 ${
                      tooltipPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
                    } left-0`}
                  >
                    <div className="bg-slate-800 border border-slate-600 rounded-md shadow-xl">
                      {getTooltipContent(floor)}
                    </div>
                    
                    {/* Tooltip arrow */}
                    <div 
                      className={`absolute left-3 w-3 h-3 bg-slate-800 border-slate-600 transform rotate-45 ${
                        tooltipPosition === 'top' ? 'bottom-0 translate-y-1.5 border-b border-r' : 'top-0 -translate-y-1.5 border-t border-l'
                      }`}
                    ></div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
          
          {/* Indicator for more floors */}
          {viewMode !== 'expanded' && currentFloor < 22 && (
            <div className="flex items-center justify-center w-8 h-8 bg-slate-800 text-slate-400 rounded border border-slate-700">
              <ChevronRight size={14} />
            </div>
          )}
        </div>
      </div>
      
      {/* Legend */}
      <div className="grid grid-cols-4 gap-2 text-xs text-slate-400 mt-2">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-emerald-600 rounded-sm border border-emerald-400"></div>
          <span>Agreed</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-600 rounded-sm border border-yellow-400"></div>
          <span>Reopened</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-blue-600 rounded-sm border border-blue-400"></div>
          <span>Current</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-slate-700 rounded-sm border border-slate-500"></div>
          <span>Pending</span>
        </div>
      </div>
      
      {/* Recall token warning */}
      {currentFloor >= RECALL_MAX_FLOOR && hasRecallTokens && (
        <div className="mt-3 flex items-center text-xs text-amber-400">
          <AlertTriangle size={12} className="mr-1" />
          <span>Recall tokens can only be used until floor {RECALL_MAX_FLOOR}</span>
        </div>
      )}
      
      {/* Help text */}
      <div className="mt-3 text-xs text-slate-500 text-center">
        Click on a floor tile to see details and options
      </div>
    </div>
  );
};

export default FloorTimeline;