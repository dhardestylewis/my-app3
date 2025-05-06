// src/components/GameInterface.tsx
// Corrected useBuildingStore import and selector typing.

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { shallow } from 'zustand/shallow';
import { useStoreWithEqualityFn } from 'zustand/traditional';

// State Stores
import { useGameFlowStore, GamePhase } from '@/stores/useGameFlowStore';
import { usePlayersStore, Player, PlayersStoreState, PlayerRole as PlayerRoleFromStore } from '@/stores/usePlayersStore';
import { useUIPopupStore }  from '@/stores/useUIPopupStore';
import { useFloorStore, FloorState as FloorDataType, FloorStoreState } from '@/stores/useFloorStore';
import { useBuildingStore, BuildingStoreState } from '@/stores/useBuildingStore'; // Corrected: Added import

// Components
import PlayerHandArea from './game/PlayerHandArea'; 
import NegotiationPanel from './NegotiationPanel';
import DeckSelectorPopup from './DeckSelectorPopup';
import TowerVisualization, { TowerVisualizationProps, FloorSummaryItem } from './TowerVisualization';
import FloorTimeline from './FloorTimeline';
import PlayerStatsPanel, { PlayerStatsPanelProps } from './PlayerStatsPanel';   
import ScoreDisplay from './ScoreDisplay';           
import GameLog from './GameLog';                     
import FloorProgressionIndicator, { FloorProgressionIndicatorProps } from './FloorProgressionIndicator'; 
import LoadingIndicator from './ui/LoadingIndicator';

// Icon Imports
import { 
    Hand, BookOpen, X as LucideX, Landmark, Users, Recycle, Sparkles, Banknote, HelpCircle, 
    RotateCcw, Info, MessageSquare, PackagePlus, ChevronDown, ChevronUp,
    Send, ArrowLeftRight, Shuffle 
} from 'lucide-react';
import { Button } from "@/components/ui/button";

// Types
import { CardInstance, PhaseInfo, PlayerType, PlayerRole } from '@/data/types';
import { MAX_STORIES } from '@/data/constants';
import { logDebug, logWarn } from '@/utils/logger';

const MOBILE_BREAKPOINT = 768;

interface GameInterfaceProps {
  onResetGame: () => void;
}

export default function GameInterface({ onResetGame }: GameInterfaceProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [isHandExpanded, setIsHandExpanded] = useState(false);

  const { gamePhase, isAiTurn, waitForPlayerAcknowledgement, canAccessDeckSelector } = 
    useStoreWithEqualityFn(useGameFlowStore, state => ({
        gamePhase: state.gamePhase,
        isAiTurn: state.isAiTurn,
        waitForPlayerAcknowledgement: state.waitForPlayerAcknowledgement,
        canAccessDeckSelector: state.canAccessDeckSelector,
    }), shallow);

  const { humanPlayer, deckCardDefinitionsCount, players, currentPlayer } = 
    useStoreWithEqualityFn(usePlayersStore, (state: PlayersStoreState) => ({
        humanPlayer: state.getHumanPlayer(),
        deckCardDefinitionsCount: state.deckCardDefinitions.length,
        players: state.players,
        currentPlayer: state.getCurrentPlayer(),
    }), shallow);

  const { cycleProposalCountForCard, cycleCounterProposalCountForCard } = usePlayersStore.getState();

  const { currentFloor, floors: rawFloorStates, getCurrentFloorState } = 
    useStoreWithEqualityFn(useFloorStore, (state: FloorStoreState) => ({
        currentFloor: state.currentFloor,
        floors: state.floors,
        getCurrentFloorState: state.getCurrentFloorState,
    }), shallow);
  
  // Corrected: Added BuildingStoreState type to selector
  const buildingFloorSummary = useStoreWithEqualityFn(
    useBuildingStore, 
    (state: BuildingStoreState): FloorSummaryItem[] => state.getFloorSummary(), 
    shallow
  );
  
  const isDeckSelectorOpen = useUIPopupStore(state => state.isDeckSelectorOpen);
  const openDeckSelector   = useUIPopupStore(state => state.openDeckSelector);
  const closeDeckSelector  = useUIPopupStore(state => state.closeDeckSelector);

  useEffect(() => { 
    const handleResize = () => {
        const mobileCheck = window.innerWidth < MOBILE_BREAKPOINT;
        if (mobileCheck !== isMobile) setIsMobile(mobileCheck);
        if (!mobileCheck && isHandExpanded) setIsHandExpanded(false);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile, isHandExpanded]);

  const toggleHandExpansion = useCallback(() => setIsHandExpanded(prev => !prev), []);
  
  const handleToggleDeckSelector = useCallback(() => {
    if (canAccessDeckSelector()) { 
        isDeckSelectorOpen ? closeDeckSelector() : openDeckSelector();
    } else {
        logDebug("Deck selector access denied.", "GameInterface");
    }
  }, [canAccessDeckSelector, isDeckSelectorOpen, openDeckSelector, closeDeckSelector]);

  const handleMobileHandCardClick = useCallback((instanceId: string, event: React.MouseEvent) => { 
    if (isAiTurn || waitForPlayerAcknowledgement || !humanPlayer) return;
    const floorDataForPhase = getCurrentFloorState(); 
    const leadPlayer = usePlayersStore.getState().getLeadPlayer(currentFloor); 
    const localCurrentPlayer = usePlayersStore.getState().getCurrentPlayer();
    if (!localCurrentPlayer || !floorDataForPhase) return;
    const isLeadPlayerTurn = localCurrentPlayer.id === leadPlayer?.id;
    const hasProposalA = !!floorDataForPhase.proposalA?.length;
    const hasProposalB = !!floorDataForPhase.proposalB?.length;
    if (isLeadPlayerTurn && !hasProposalA && !hasProposalB) cycleProposalCountForCard(instanceId);
    else if (!isLeadPlayerTurn && hasProposalA && !hasProposalB) cycleCounterProposalCountForCard(instanceId);
    else if(isLeadPlayerTurn) cycleProposalCountForCard(instanceId);
  }, [isAiTurn, waitForPlayerAcknowledgement, humanPlayer, currentFloor, getCurrentFloorState, cycleProposalCountForCard, cycleCounterProposalCountForCard]);

  const mobileHandPhaseInfo = useMemo((): PhaseInfo => { 
    const cFloorData = getCurrentFloorState();
    const cLeadPlayer = usePlayersStore.getState().getLeadPlayer(currentFloor);
    const cCurrentPlayer = usePlayersStore.getState().getCurrentPlayer();
    if (!cCurrentPlayer || !cFloorData) return { text: "Loading phase...", icon: <Info size={16}/>, color: "text-slate-400", isInitialProposalPhase: false, isResponsePhase: false, isCounterDecisionPhase: false };
    const hasProposalA = !!cFloorData.proposalA?.length;
    const hasProposalB = !!cFloorData.proposalB?.length;
    const isLeadPlayerTurn = cCurrentPlayer.id === cLeadPlayer?.id;
    if (isLeadPlayerTurn && !hasProposalA && !hasProposalB) return { text: "Set Proposal Count", icon: <Send size={16}/>, color: "text-blue-300", isInitialProposalPhase: true, isResponsePhase: false, isCounterDecisionPhase: false};
    if (!isLeadPlayerTurn && hasProposalA && !hasProposalB) return { text: "Set Counter Count", icon: <ArrowLeftRight size={16}/>, color: "text-purple-300", isInitialProposalPhase: false, isResponsePhase: true, isCounterDecisionPhase: false};
    if (isLeadPlayerTurn && hasProposalA && hasProposalB) return { text: "Decide on Counter", icon: <Shuffle size={16}/>, color: "text-amber-300", isInitialProposalPhase: false, isResponsePhase: false, isCounterDecisionPhase: true};
    return { text: "View Hand", icon: <Hand size={16}/>, color: "text-slate-400", isInitialProposalPhase: false, isResponsePhase: false, isCounterDecisionPhase: false};
  }, [currentFloor, getCurrentFloorState]);

  if (!humanPlayer || !currentPlayer) {
    return <div className="flex items-center justify-center h-screen"><LoadingIndicator /> Initializing Player Data...</div>;
  }
  
  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-50 overflow-hidden">
      <header className="p-3 border-b border-slate-700 bg-slate-800/70 backdrop-blur-sm flex justify-between items-center flex-shrink-0">
        <div className='flex items-center'>
          <Landmark className="h-7 w-7 text-sky-400 mr-2" />
          <h1 className="text-xl font-bold">Urban Balance</h1>
        </div>
        <div className="flex items-center space-x-3">
          <ScoreDisplay />
          <Button variant="outline" size="sm" onClick={onResetGame} className="border-slate-600 hover:bg-slate-700">
            <RotateCcw className="h-4 w-4 mr-1.5" /> Reset
          </Button>
        </div>
      </header>

      <div className={`flex-grow grid ${isMobile ? 'grid-rows-[auto_1fr_auto]' : 'grid-cols-[1fr_350px]'} gap-0 overflow-hidden`}>
        <main className="flex flex-col overflow-hidden bg-slate-800">
          <div className="p-2 sm:p-4 flex-shrink-0">
            <FloorProgressionIndicator currentFloor={currentFloor} maxFloors={MAX_STORIES} />
          </div>
          <div className="flex-grow p-1 md:p-2 overflow-y-auto custom-scrollbar relative">
            <TowerVisualization floors={buildingFloorSummary} currentFloor={currentFloor} />
          </div>
          <div className="border-t border-slate-700 flex-shrink-0">
            <NegotiationPanel isMobile={isMobile && !isHandExpanded} />
          </div>
        </main>

        {!isMobile && (
          <aside className="w-[350px] border-l border-slate-700 bg-slate-800 flex flex-col overflow-hidden">
            <PlayerStatsPanel 
                humanPlayer={humanPlayer} 
                aiPlayer={players.find(p => p.type === PlayerType.AI)}
                currentPlayerId={currentPlayer.id} 
            />
            <div className="p-3 border-b border-slate-700">
                <Button 
                    onClick={handleToggleDeckSelector} 
                    disabled={!canAccessDeckSelector()} 
                    className="w-full bg-sky-600 hover:bg-sky-700"
                    title={!canAccessDeckSelector() ? "Cannot access deck now" : `View Deck (${deckCardDefinitionsCount} card types)`}
                >
                    <PackagePlus className="mr-2 h-5 w-5" /> View Deck ({deckCardDefinitionsCount} Types)
                </Button>
            </div>
            <GameLog enableDevMode={process.env.NODE_ENV === 'development'} />
          </aside>
        )}
      </div>

      {isMobile && ( /* ... Mobile Footer ... */ 
         <footer className="p-2 border-t border-slate-700 bg-slate-800 flex justify-around items-center flex-shrink-0 z-50">
          <Button variant="ghost" onClick={toggleHandExpansion} className="flex flex-col items-center h-auto py-1">
            {isHandExpanded ? <ChevronDown size={20}/> : <ChevronUp size={20}/> }
            <span className="text-xs mt-0.5">Hand ({humanPlayer.hand.reduce((acc, card) => acc + (card.stack || 0), 0)})</span>
          </Button>
          <Button variant="ghost" onClick={() => logDebug("Mobile Log Clicked", "GameInterface")}  className="flex flex-col items-center h-auto py-1">
            <MessageSquare size={20}/> <span className="text-xs mt-0.5">Log</span>
          </Button>
           <Button 
                variant="ghost" 
                onClick={handleToggleDeckSelector} 
                disabled={!canAccessDeckSelector()}
                className="flex flex-col items-center h-auto py-1"
                title={!canAccessDeckSelector() ? "Cannot access deck now" : `View Deck (${deckCardDefinitionsCount} card types)`}
            >
                <PackagePlus size={20}/> <span className="text-xs mt-0.5">Deck ({deckCardDefinitionsCount})</span>
            </Button>
          <Button variant="ghost" onClick={() => logDebug("Mobile Stats Clicked", "GameInterface")}  className="flex flex-col items-center h-auto py-1">
            <Users size={20}/> <span className="text-xs mt-0.5">Stats</span>
          </Button>
        </footer>
      )}

      {isMobile && isHandExpanded && !isAiTurn && humanPlayer && ( /* ... Mobile Hand Overlay ... */ 
        <div className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] top-16 bg-slate-800/95 backdrop-blur-sm z-40 p-3 overflow-y-auto border-t border-slate-700">
          <PlayerHandArea
            playerHand={humanPlayer.hand}
            currentPlayer={humanPlayer}
            phaseInfo={mobileHandPhaseInfo}
            isAiTurn={isAiTurn}
            onCardClick={handleMobileHandCardClick}
            currentFloor={currentFloor}
          />
        </div>
      )}

      {isDeckSelectorOpen && (
        <DeckSelectorPopup onClose={closeDeckSelector} />
      )}
    </div>
  );
}