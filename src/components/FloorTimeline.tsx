// src/components/FloorTimeline.tsx
// Refactored for E.2: Improved Recall UX - More direct recall action from the tile.

'use client';
import React, { useState, useMemo, useCallback } from 'react';
import { useFloorStore } from '@/stores/useFloorStore';
import { useGameFlowStore } from '@/stores/useGameFlowStore';
import { usePlayersStore } from '@/stores/usePlayersStore';
import { FloorState, FloorStatus, Committer } from '@/data/types';
import { Button } from "@/components/ui/button";
import { Layers, RefreshCcw, Check, Clock, AlertTriangle, Info, X as IconX, ArrowUp, Ban, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RECALL_MAX_FLOOR, MAX_STORIES } from '@/data/constants';
import { logDebug } from '@/utils/logger';

const FloorTimeline = () => {
    const floors = useFloorStore(state => state.floors);
    const currentFloorNum = useFloorStore(state => state.currentFloor);
    const validateRecallSelector = useFloorStore(state => state.validateRecall);
    
    const useRecallTokenAction = useGameFlowStore(state => state.useRecallToken);
    const isAiTurn = useGameFlowStore(state => state.isAiTurn);
    
    const players = usePlayersStore(state => state.players);
    const currentPlayerIndex = usePlayersStore(state => state.currentPlayerIndex);

    const [hoveredFloor, setHoveredFloor] = useState<number | null>(null);
    const [activeTooltip, setActiveTooltip] = useState<number | null>(null);

    const currentPlayer = useMemo(() => players[currentPlayerIndex], [players, currentPlayerIndex]);
    const hasRecallTokens = useMemo(() => (currentPlayer?.recallTokens || 0) > 0, [currentPlayer?.recallTokens]);

    const visibleFloors = useMemo(() => {
        const range = 3;
        const visibleSet = new Set<number>([1]);
        for (let i = Math.max(1, currentFloorNum - range); i <= Math.min(MAX_STORIES, currentFloorNum + range); i++) {
            visibleSet.add(i);
        }
        if (MAX_STORIES > 0) visibleSet.add(MAX_STORIES);
        return floors.filter(f => visibleSet.has(f.floorNumber)).sort((a, b) => a.floorNumber - b.floorNumber);
    }, [floors, currentFloorNum]);

    const handleTileClick = useCallback((floorNumber: number) => {
        setActiveTooltip(prev => (prev === floorNumber ? null : floorNumber));
    }, []);

    const handleRecallIconClick = useCallback((e: React.MouseEvent, floorNumber: number) => {
        e.stopPropagation(); // Prevent tile click from also firing
        const validation = validateRecallSelector(floorNumber);
        if (!isAiTurn && hasRecallTokens && validation.isValid) {
            logDebug(`Recall icon clicked for floor ${floorNumber}. Validation: ${validation.reason}`, 'FloorTimeline');
            useRecallTokenAction(floorNumber);
            setActiveTooltip(null); // Close tooltip if open
        } else {
            logDebug(`Recall icon condition not met for floor ${floorNumber}. Reason: ${validation.reason}`, 'FloorTimeline');
            // Optionally, briefly show the tooltip with the reason if the icon was clicked when disabled
            if (!validation.isValid) {
                 setActiveTooltip(floorNumber);
            }
        }
    }, [isAiTurn, hasRecallTokens, validateRecallSelector, useRecallTokenAction]);

    const getFloorClasses = useCallback((floor: FloorState): string => {
        const base = "relative flex items-center justify-center rounded-md border shadow-sm transition-all duration-200 w-10 h-10 text-sm font-medium";
        let statusClasses = "";
        if (floor.status === FloorStatus.Agreed) statusClasses = "bg-emerald-700/80 border-emerald-500 text-white hover:bg-emerald-600";
        else if (floor.status === FloorStatus.Reopened) statusClasses = "bg-yellow-600/80 border-yellow-400 text-white hover:bg-yellow-500 animate-pulse";
        else if (floor.status === FloorStatus.Skipped) statusClasses = "bg-slate-600/70 border-slate-500 text-slate-400 hover:bg-slate-500";
        else if (floor.floorNumber === currentFloorNum) statusClasses = "bg-blue-600 border-blue-400 text-white hover:bg-blue-500 ring-2 ring-offset-2 ring-blue-400 ring-offset-slate-800";
        else statusClasses = "bg-slate-700/80 border-slate-600 text-slate-300 hover:bg-slate-600";
        
        const interaction = `${hoveredFloor === floor.floorNumber ? 'scale-105 shadow-lg' : ''} ${activeTooltip === floor.floorNumber ? 'scale-110 ring-2 ring-white ring-offset-1 ring-offset-slate-800' : ''}`;
        return `${base} ${statusClasses} ${interaction}`;
    }, [currentFloorNum, hoveredFloor, activeTooltip]);

    const getTooltipContent = useCallback((floor: FloorState): React.ReactNode => {
        const commonHeader = (title: string, titleColor: string, icon: React.ReactNode) => (
            <div className="flex justify-between items-center mb-2">
                <h3 className={`font-bold text-sm ${titleColor} flex items-center`}>{icon}{title}</h3>
                <button className="text-slate-400 hover:text-white p-0.5" onClick={() => setActiveTooltip(null)}><IconX size={14} /></button>
            </div>
        );

        if (floor.status === FloorStatus.Agreed && floor.winnerCard) {
            const recallValidation = validateRecallSelector(floor.floorNumber);
            const canPlayerInitiateRecall = !isAiTurn && hasRecallTokens;
            const isRecallPossible = canPlayerInitiateRecall && recallValidation.isValid;
            
            let recallInfoText = "";
            if (isRecallPossible) {
                recallInfoText = `Recall available (${currentPlayer?.recallTokens} token${currentPlayer?.recallTokens === 1 ? '' : 's'} left).`;
            } else {
                if (!canPlayerInitiateRecall) recallInfoText = isAiTurn ? "Recall not available for AI." : "No recall tokens left.";
                else recallInfoText = `Recall not possible: ${recallValidation.reason}`;
            }

            const impact = floor.winnerCard.netScoreImpact ?? 0;
            const committerDisplay = floor.committedBy === Committer.PlayerA ? 'Player A' : floor.committedBy === Committer.PlayerB ? 'Player B' : floor.committedBy === Committer.Auto ? 'Mediator' : 'Unknown';
            
            return (
                <div className="w-60 p-3 text-xs">
                    {commonHeader(`Floor ${floor.floorNumber} Agreed`, "text-emerald-300", <Check size={14} className="mr-1.5" />)}
                    <div className="bg-slate-700/70 p-2 rounded mb-2 space-y-1">
                        <p className="font-semibold text-white">{floor.winnerCard.name}</p>
                        <div className="flex justify-between text-slate-300">
                            <span>Impact: <span className={impact >= 0 ? 'text-amber-400' : 'text-emerald-400'}>{impact >= 0 ? '+' : ''}{impact}</span></span>
                            <span>By: {committerDisplay}</span>
                        </div>
                    </div>
                    <p className={`text-xs ${isRecallPossible ? 'text-sky-300' : 'text-slate-400'} italic mt-1`}>
                        {recallInfoText}
                    </p>
                </div>
            );
        }
        if (floor.status === FloorStatus.Skipped) { /* ... (same as before) ... */ 
            return (
                <div className="w-52 p-3 text-xs">
                    {commonHeader(`Floor ${floor.floorNumber} Skipped`, "text-slate-400", <Ban size={14} className="mr-1.5" />)}
                    <p className="text-slate-300 italic">No card was placed on this floor.</p>
                </div>
            );
        }
        if (floor.floorNumber === currentFloorNum) { /* ... (same as before) ... */ 
            const proposalACard = floor.proposalA?.[0];
            const proposalBCard = floor.proposalB?.[0];
            return (
                <div className="w-56 p-3 text-xs">
                    {commonHeader(`Floor ${floor.floorNumber} Current`, "text-blue-300", <Clock size={14} className="mr-1.5" />)}
                    <p className="text-slate-300 mb-1">In negotiation...</p>
                    {proposalACard && (<div className="mt-1 p-1.5 bg-slate-700/70 rounded">
                        <p className="font-medium text-xs">Lead: <span className="text-blue-400">{proposalACard.name}</span></p>
                        {floor.proposalA!.length > 1 && <p className='text-[0.65rem] italic text-slate-400'> + {floor.proposalA!.length - 1} more</p>}
                    </div>)}
                    {proposalBCard && (<div className="mt-1 p-1.5 bg-slate-700/70 rounded">
                        <p className="font-medium text-xs">Counter: <span className="text-purple-400">{proposalBCard.name}</span></p>
                        {floor.proposalB!.length > 1 && <p className='text-[0.65rem] italic text-slate-400'> + {floor.proposalB!.length - 1} more</p>}
                    </div>)}
                    {!proposalACard && !proposalBCard && <p className="italic text-slate-400">No proposals yet.</p>}
                </div>
            );
        }
        if (floor.status === FloorStatus.Reopened) { /* ... (same as before) ... */ 
            return (
                <div className="w-56 p-3 text-xs">
                     {commonHeader(`Floor ${floor.floorNumber} Reopened`, "text-yellow-300", <RefreshCcw size={14} className="mr-1.5" />)}
                    <p className="text-slate-300 italic">This floor was reopened and is pending negotiation.</p>
                </div>
            );
        }
        // Pending Floor or other unhandled status
        return (
            <div className="w-48 p-3 text-xs">
                {commonHeader(`Floor ${floor.floorNumber} Pending`, "text-slate-400", <Layers size={14} className="mr-1.5" />)}
                <p className="text-slate-300 italic">Not yet built.</p>
            </div>
        );
    }, [isAiTurn, hasRecallTokens, currentFloorNum, currentPlayer?.recallTokens, validateRecallSelector]);

    return (
        <div className="p-3 bg-slate-800/70 rounded-lg border border-slate-700 h-full flex flex-col">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-slate-300 flex items-center"><Layers className="mr-2 h-5 w-5 text-slate-400" />Floor Timeline</h2>
                <div className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded-full">Recall Tokens: <span className="font-bold text-white">{currentPlayer?.recallTokens ?? 0}</span></div>
            </div>
            <div className="overflow-x-auto overflow-y-hidden pb-2 -mb-2 flex-grow min-h-0">
                <div className="flex gap-2 items-center h-full pb-1">
                    {visibleFloors.map((floor) => {
                        const recallValidation = floor.status === FloorStatus.Agreed ? validateRecallSelector(floor.floorNumber) : { isValid: false, reason: "Not an agreed floor." };
                        const canPlayerInitiateRecall = !isAiTurn && hasRecallTokens;
                        const showRecallIcon = floor.status === FloorStatus.Agreed && hoveredFloor === floor.floorNumber && canPlayerInitiateRecall && recallValidation.isValid;
                        const recallIconTitle = canPlayerInitiateRecall && recallValidation.isValid ? `Recall Floor ${floor.floorNumber} (${currentPlayer?.recallTokens} left)` : recallValidation.reason;

                        return (
                            <div 
                                key={`floor-${floor.floorNumber}`} 
                                className="relative flex-shrink-0" 
                                onMouseEnter={() => setHoveredFloor(floor.floorNumber)} 
                                onMouseLeave={() => setHoveredFloor(null)}
                            >
                                <button 
                                    className={getFloorClasses(floor)} 
                                    onClick={() => handleTileClick(floor.floorNumber)} 
                                    title={`Floor ${floor.floorNumber} (${floor.status}) - Click for details`}
                                >
                                    {floor.floorNumber}
                                    {floor.floorNumber === currentFloorNum && <div className="absolute -top-1.5 left-1/2 -translate-x-1/2"><ArrowUp size={12} className="text-white drop-shadow-md" /></div>}
                                   
                                    {/* Recall Icon directly on tile */}
                                    {showRecallIcon && (
                                        <Button
                                            variant="destructive"
                                            size="icon"
                                            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 bg-red-600 hover:bg-red-500 opacity-90 hover:opacity-100 z-10 shadow-lg"
                                            onClick={(e) => handleRecallIconClick(e, floor.floorNumber)}
                                            title={recallIconTitle}
                                        >
                                            <RefreshCcw size={14} />
                                        </Button>
                                    )}
                                    {/* Visual cue if recallable but not hovered (optional) */}
                                    {floor.status === FloorStatus.Agreed && canPlayerInitiateRecall && recallValidation.isValid && hoveredFloor !== floor.floorNumber && (
                                        <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-sky-400 rounded-full opacity-70" title="Recall available"></div>
                                    )}
                                </button>
                                <AnimatePresence>
                                    {activeTooltip === floor.floorNumber && (
                                        <motion.div 
                                            initial={{ opacity: 0, y: 10 }} 
                                            animate={{ opacity: 1, y: 0 }} 
                                            exit={{ opacity: 0, y: 10 }} 
                                            transition={{ duration: 0.2 }} 
                                            className="absolute z-50 bottom-full mb-2 left-1/2 -translate-x-1/2" 
                                            style={{ minWidth: '12rem' }}
                                        >
                                            <div className="bg-slate-800 border border-slate-600 rounded-md shadow-xl">
                                                {getTooltipContent(floor)}
                                            </div>
                                            <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 w-3 h-3 bg-slate-800 border-b border-r border-slate-600 transform rotate-45"></div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        );
                    })}
                    {visibleFloors.length < floors.length && floors.length > 0 && <div className="text-slate-500 text-xs ml-2">...</div>}
                </div>
            </div>
            <div className="mt-auto pt-2 border-t border-slate-700/50">
                { /* Legend (same as before) */ }
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs text-slate-400 mb-2">
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-emerald-700 rounded-sm border border-emerald-500"></div>Agreed</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-yellow-600 rounded-sm border border-yellow-400"></div>Reopened</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-blue-600 rounded-sm border border-blue-400"></div>Current</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-slate-600 rounded-sm border border-slate-500"></div>Skipped</div>
                    <div className="flex items-center gap-1"><div className="w-2.5 h-2.5 bg-slate-700 rounded-sm border border-slate-600"></div>Pending</div>
                </div>
                {currentFloorNum >= RECALL_MAX_FLOOR && hasRecallTokens && (
                    <div className="flex items-center justify-center text-[0.7rem] text-amber-400/80 mt-1">
                        <AlertTriangle size={11} className="mr-1 flex-shrink-0" />
                        <span>Recall only usable up to Floor {RECALL_MAX_FLOOR - 1}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FloorTimeline;