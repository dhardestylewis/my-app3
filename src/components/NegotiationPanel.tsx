'use client';

// src/components/NegotiationPanel.tsx (or your path)

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useFloorStore } from '@/stores/useFloorStore';
import { usePlayersStore, Player } from '@/stores/usePlayersStore';
import { useGameFlowStore } from '@/stores/useGameFlowStore';
// Updated Import: Make sure PhaseInfo comes from the shared types file
import { CardData, PhaseInfo } from '@/data/types';
import { Button } from "@/components/ui/button";
import { Clock, Check, XCircle, Shuffle, Send, ArrowLeftRight, AlertTriangle } from 'lucide-react';
// REMOVED: import Card from "@/components/ui/card"; // No longer directly used here for rendering list items
import { useDroppable } from '@dnd-kit/core';
import { useGameEffects } from '@/hooks/useGameEffects';
// ADDED: Import the new component
import RenderCard from '@/components/game/RenderCard'; // Adjust path if needed

// --- Constants ---
const LEAD_PLAYER_BLOCK_SIZE = 5;
const TIMER_ALERT_THRESHOLD = 10; // Seconds remaining to show alert
const AUTO_PASS_DELAY = 1000; // ms delay before auto-passing

// --- Type Definitions ---
// REMOVED: interface PhaseInfo { ... } // Moved to data/types.ts

interface NegotiationState {
  currentFloor: number;
  currentPlayer?: Player;
  leadPlayer?: Player;
  respondingPlayer?: Player;
  currentFloorState?: any; // Kept for potential future use, but less critical now
  proposalA?: CardData;
  proposalB?: CardData;
  playerHand: CardData[];
  selectedHandCardId?: string;
  selectedCounterCardId?: string;
  isAiTurn: boolean;
  phaseInfo: PhaseInfo; // Uses the imported type
}

// --- Custom Hook: useNegotiationState ---
// (No changes needed in the hook itself, assuming PhaseInfo import is updated)
const useNegotiationState = (): NegotiationState => {
  // Raw state from stores
  const currentFloor = useFloorStore(state => state.currentFloor);
  const floors = useFloorStore(state => state.floors);
  // BEFORE (problematic because it always returns a new object):
  // const { players, currentPlayerIndex, selectedHandCardId, selectedCounterCardId } =
  //   usePlayersStore(state => ({
  //     players: state.players,
  //     currentPlayerIndex: state.currentPlayerIndex,
  //     selectedHandCardId: state.selectedHandCardId,
  //     selectedCounterCardId: state.selectedCounterCardId,
  //   }));

  // AFTER (each hook returns a single, stable value):
  const players             = usePlayersStore(s => s.players);
  const currentPlayerIndex = usePlayersStore(s => s.currentPlayerIndex);
  const selectedHandCardId  = usePlayersStore(s => s.selectedHandCardId);
  const selectedCounterCardId = usePlayersStore(s => s.selectedCounterCardId);
  const isAiTurn = useGameFlowStore(state => state.isAiTurn);

  // Derived state calculations
  const currentPlayer = useMemo(() => players[currentPlayerIndex], [players, currentPlayerIndex]);

  const leadPlayer = useMemo(() => {
      const blockNumber = Math.ceil(currentFloor / LEAD_PLAYER_BLOCK_SIZE);
      const isPlayerALead = blockNumber % 2 === 1;
      return players.find(p => p.isLeadPlayer === isPlayerALead);
  }, [players, currentFloor]);

  const respondingPlayer = useMemo(() => {
      return players.find(p => p.id !== leadPlayer?.id);
  }, [players, leadPlayer]);

  const currentFloorState = useMemo(() => {
      return floors.find(f => f.floorNumber === currentFloor);
  }, [floors, currentFloor]);

  const proposalA = currentFloorState?.proposalA;
  const proposalB = currentFloorState?.proposalB;
  const playerHand = currentPlayer?.hand || [];

  // Phase calculation (Uses imported PhaseInfo type implicitly via return type)
  const phaseInfo = useMemo((): PhaseInfo => {
      const isLeadPlayerTurn = currentPlayer?.id === leadPlayer?.id;
      const hasProposalA = !!proposalA;
      const hasProposalB = !!proposalB;
      const isBothProposalsPhase = hasProposalA && hasProposalB;
      const isInitialProposalPhase = isLeadPlayerTurn && !hasProposalA && !hasProposalB;
      const isResponsePhase = !isLeadPlayerTurn && (hasProposalA || hasProposalB) && !isBothProposalsPhase; // Corrected logic: Responder's turn
      const isCounterDecisionPhase = isLeadPlayerTurn && isBothProposalsPhase;

      if (isInitialProposalPhase) {
          return {
              text: `${leadPlayer?.name || 'Lead'} to make initial proposal`,
              icon: <Send className="mr-2 h-5 w-5 text-blue-400" />,
              color: "text-blue-400",
              isInitialProposalPhase: true, isResponsePhase: false, isCounterDecisionPhase: false
          };
      } else if (isResponsePhase) {
          return {
              text: `${respondingPlayer?.name || 'Responder'} to accept, counter, or pass`,
              icon: <ArrowLeftRight className="mr-2 h-5 w-5 text-purple-400" />,
              color: "text-purple-400",
              isInitialProposalPhase: false, isResponsePhase: true, isCounterDecisionPhase: false
          };
      } else if (isCounterDecisionPhase) {
          return {
              text: `${leadPlayer?.name || 'Lead'} to accept counter-proposal or let AI mediate`,
              icon: <Shuffle className="mr-2 h-5 w-5 text-amber-400" />,
              color: "text-amber-400",
              isInitialProposalPhase: false, isResponsePhase: false, isCounterDecisionPhase: true
          };
      }

      // Default/Waiting state
      return {
          text: "Waiting...",
          icon: <Clock className="mr-2 h-5 w-5 text-slate-400" />,
          color: "text-slate-400",
          isInitialProposalPhase: false, isResponsePhase: false, isCounterDecisionPhase: false
      };
  }, [currentPlayer, leadPlayer, respondingPlayer, proposalA, proposalB]);


  return {
      currentFloor,
      currentPlayer,
      leadPlayer,
      respondingPlayer,
      currentFloorState,
      proposalA,
      proposalB,
      playerHand,
      selectedHandCardId: selectedHandCardId ?? undefined,
      selectedCounterCardId: selectedCounterCardId ?? undefined,
      isAiTurn,
      phaseInfo,
  };
};


// --- Sub-Component: DroppableZone ---
// (Keep as is, it's already well-defined)
const DroppableZone = ({
    id,
    children,
    isActive = true,
    className = ""
}: {
    id: string;
    children: React.ReactNode;
    isActive?: boolean;
    className?: string;
}) => {
    const { setNodeRef, isOver } = useDroppable({ id, disabled: !isActive });
    return (
        <div
            ref={setNodeRef}
            className={`border border-slate-700 rounded-lg p-3 min-h-[180px] flex items-center justify-center bg-slate-800/60 transition-colors duration-200 ${isOver && isActive ? 'border-emerald-500 bg-slate-700/60' : ''} ${className}`}
        >
            {children}
        </div>
    );
};


// --- Sub-Component: NegotiationHeader ---
interface NegotiationHeaderProps {
    currentFloor: number;
    phaseInfo: PhaseInfo;
    timer: number | null;
}
const NegotiationHeader: React.FC<NegotiationHeaderProps> = React.memo(({ currentFloor, phaseInfo, timer }) => {
    const timerColor = timer !== null && timer <= TIMER_ALERT_THRESHOLD ? 'bg-red-900/60 text-red-300 animate-pulse' : 'bg-slate-700/60 text-slate-300';
    return (
        <div className="sticky top-0 p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/80 z-10">
            <div className="flex items-center">
                {phaseInfo.icon}
                <h2 className="text-lg font-semibold">
                    <span className="text-slate-400">Floor {currentFloor}:</span>{' '}
                    <span className={phaseInfo.color}>{phaseInfo.text}</span>
                </h2>
            </div>
            <div className={`py-1 px-3 rounded-full ${timerColor} flex items-center`}>
                <Clock className="mr-1 h-4 w-4" /> {timer ?? 0}s
            </div>
        </div>
    );
});
NegotiationHeader.displayName = 'NegotiationHeader';


// --- Sub-Component: TimerAlert ---
interface TimerAlertProps {
    timer: number | null;
    showTimerAlert: boolean;
}
const TimerAlert: React.FC<TimerAlertProps> = React.memo(({ timer, showTimerAlert }) => {
    if (!showTimerAlert || timer === null || timer <= 0 || timer > TIMER_ALERT_THRESHOLD) {
        return null;
    }
    return (
        <div className="bg-red-900/40 text-red-300 p-2 text-center text-sm flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Time running out! Auto-pass will occur at 0s
        </div>
    );
});
TimerAlert.displayName = 'TimerAlert';


// --- REMOVED: Sub-Component: RenderCard Helper ---
// This logic is now in RenderCard.tsx


// --- Sub-Component: ProposalsArea ---
interface ProposalsAreaProps {
  leadPlayer?: Player;
  respondingPlayer?: Player;
  proposalA?: CardData;
  proposalB?: CardData;
  phaseInfo: PhaseInfo; // Use imported type
  isAiTurn: boolean;
  // REMOVED: renderCard: (card: CardData, index: number, isProposal: boolean) => JSX.Element;
  // ADDED: Props needed by RenderCard
  selectedHandCardId?: string;
  selectedCounterCardId?: string;
  onCardClick: (cardId: string) => void; // Pass down the click handler
}
const ProposalsArea: React.FC<ProposalsAreaProps> = React.memo(({
  leadPlayer, respondingPlayer, proposalA, proposalB, phaseInfo, isAiTurn,
  // Destructure new props
  selectedHandCardId, selectedCounterCardId, onCardClick
}) => {
  const leadDropActive = phaseInfo.isInitialProposalPhase && !isAiTurn;
  const counterDropActive = phaseInfo.isResponsePhase && !isAiTurn;

  const leadPlaceholder = leadDropActive ? "Drag a card here to propose" : (isAiTurn && phaseInfo.isInitialProposalPhase) ? "Waiting for AI to propose..." : "No proposal yet";
  const counterPlaceholder = counterDropActive ? "Drag a card here to counter" : (isAiTurn && phaseInfo.isResponsePhase) ? "Waiting for AI to respond..." : "No counter yet";

  return (
      <div className="grid grid-cols-2 gap-4 p-4 border-b border-slate-700 bg-slate-900/50">
          {/* Lead Proposal */}
          <div className="space-y-2">
              <h3 className="font-semibold text-slate-300 flex items-center">
                   <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
                   Lead Proposal {leadPlayer && <span className="ml-2 text-xs text-slate-500">({leadPlayer.role})</span>}
               </h3>
              <DroppableZone
                  id="lead-proposal"
                  isActive={leadDropActive}
                  className={leadDropActive && !proposalA ? "border-blue-500/30 border-dashed animate-pulse" : ""}
              >
                  {proposalA ? (
                      // Use RenderCard component
                      <RenderCard
                          key={proposalA.id} // Key needed for React lists/conditional rendering
                          card={proposalA}
                          isProposal={true} // Indicate this is a proposal card
                          phaseInfo={phaseInfo}
                          selectedHandCardId={selectedHandCardId}
                          selectedCounterCardId={selectedCounterCardId}
                          isAiTurn={isAiTurn}
                          onCardClick={onCardClick} // Pass handler (RenderCard internal logic prevents click)
                      />
                  ) : (
                      <p className="text-slate-500 italic">{leadPlaceholder}</p>
                  )}
              </DroppableZone>
          </div>

          {/* Counter Proposal */}
          <div className="space-y-2">
               <h3 className="font-semibold text-slate-300 flex items-center">
                   <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
                   Counter Proposal {respondingPlayer && <span className="ml-2 text-xs text-slate-500">({respondingPlayer.role})</span>}
               </h3>
              <DroppableZone
                  id="counter-proposal"
                  isActive={counterDropActive}
                  className={counterDropActive && !proposalB ? "border-purple-500/30 border-dashed animate-pulse" : ""}
              >
                  {proposalB ? (
                       // Use RenderCard component
                      <RenderCard
                          key={proposalB.id}
                          card={proposalB}
                          isProposal={true}
                          phaseInfo={phaseInfo}
                          selectedHandCardId={selectedHandCardId}
                          selectedCounterCardId={selectedCounterCardId}
                          isAiTurn={isAiTurn}
                          onCardClick={onCardClick}
                      />
                  ) : (
                      <p className="text-slate-500 italic">{counterPlaceholder}</p>
                  )}
              </DroppableZone>
          </div>
      </div>
  );
});
ProposalsArea.displayName = 'ProposalsArea';

// --- Sub-Component: ActionButtons ---
interface ActionButtonsProps {
    phaseInfo: PhaseInfo;
    selectedHandCardId?: string;
    selectedCounterCardId?: string;
    isAiTurn: boolean;
    handlers: {
        onPropose: () => void;
        onCounterPropose: () => void;
        onAccept: () => void;
        onPass: () => void;
    };
}
const ActionButtons: React.FC<ActionButtonsProps> = React.memo(({
    phaseInfo, selectedHandCardId, selectedCounterCardId, isAiTurn, handlers
}) => {
    if (isAiTurn) {
        return (
            <div className="p-4 flex justify-center gap-4 border-b border-slate-700 bg-slate-800/60 min-h-[68px]"> {/* Added min-height */}
                <div className="flex items-center justify-center text-slate-400 py-2">
                    <Clock className="animate-spin h-4 w-4 mr-2" />
                    Waiting for AI's decision...
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 flex justify-center gap-4 border-b border-slate-700 bg-slate-800/60 min-h-[68px]"> {/* Added min-height */}
            {phaseInfo.isInitialProposalPhase && selectedHandCardId && (
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={handlers.onPropose}>
                    <Send className="mr-2 h-5 w-5" /> Propose
                </Button>
            )}

            {phaseInfo.isResponsePhase && (
                <>
                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handlers.onAccept}>
                        <Check className="mr-2 h-5 w-5" /> Accept
                    </Button>
                    {selectedCounterCardId && (
                        <Button className="bg-purple-600 hover:bg-purple-700" onClick={handlers.onCounterPropose}>
                            <ArrowLeftRight className="mr-2 h-5 w-5" /> Counter
                        </Button>
                    )}
                    <Button variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700" onClick={handlers.onPass}>
                        <XCircle className="mr-2 h-5 w-5" /> Pass
                    </Button>
                </>
            )}

            {phaseInfo.isCounterDecisionPhase && (
                <>
                    <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handlers.onAccept}>
                        <Check className="mr-2 h-5 w-5" /> Accept Counter
                    </Button>
                    <Button variant="outline" className="border-amber-600/70 text-amber-500 hover:text-amber-400 hover:bg-slate-700" onClick={handlers.onPass}>
                        <Shuffle className="mr-2 h-5 w-5" /> Let AI Decide
                    </Button>
                </>
            )}
        </div>
    );
});
ActionButtons.displayName = 'ActionButtons';


// --- Sub-Component: PlayerHandArea ---
interface PlayerHandAreaProps {
  playerHand: CardData[];
  currentPlayer?: Player;
  phaseInfo: PhaseInfo; // Use imported type
  // REMOVED: renderCard: (card: CardData, index: number, isProposal?: boolean) => JSX.Element;
  // ADDED: Props needed by RenderCard
  selectedHandCardId?: string;
  selectedCounterCardId?: string;
  isAiTurn: boolean;
  onCardClick: (cardId: string) => void; // Pass down the click handler
}
const PlayerHandArea: React.FC<PlayerHandAreaProps> = React.memo(({
  playerHand, currentPlayer, phaseInfo,
  // Destructure new props
  selectedHandCardId, selectedCounterCardId, isAiTurn, onCardClick
}) => {
  const instructionText = phaseInfo.isInitialProposalPhase ? "Drag a card to the Lead Proposal area or Click to select"
      : phaseInfo.isResponsePhase ? "Drag a card to the Counter Proposal area or Click to select"
      : "Select your action";

  return (
      <div className="flex flex-col flex-grow p-4 overflow-hidden bg-slate-800"> {/* Added bg */}
          <h3 className="font-semibold text-slate-300 mb-3 sticky top-0 bg-slate-800/90 py-1 z-10">
              Your Hand
              <span className="ml-3 text-xs text-slate-500">{instructionText}</span>
          </h3>
          {playerHand.length === 0 ? (
              <p className="text-slate-500 italic text-center mt-4">
                  Your hand is empty
                  {process.env.NODE_ENV === 'development' && ` (Current player: ${currentPlayer?.name}, Role: ${currentPlayer?.role})`}
              </p>
          ) : (
              <div className="overflow-y-auto flex-grow min-h-0 pr-2 pb-4"> {/* Ensure scrolling works */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {playerHand.map((card) => (
                          // Apply layout wrapper if needed (like flex-shrink)
                          <div key={card.id} className="flex-shrink-0">
                              {/* Use RenderCard component */}
                              <RenderCard
                                  // No need for separate key on RenderCard itself when wrapper has key
                                  card={card}
                                  isProposal={false} // These are hand cards
                                  phaseInfo={phaseInfo}
                                  selectedHandCardId={selectedHandCardId}
                                  selectedCounterCardId={selectedCounterCardId}
                                  isAiTurn={isAiTurn}
                                  onCardClick={onCardClick} // Pass the actual handler
                              />
                          </div>
                      ))}
                  </div>
              </div>
          )}
      </div>
  );
});
PlayerHandArea.displayName = 'PlayerHandArea';


// --- Sub-Component: DebugInfoPanel ---
interface DebugInfoPanelProps extends Omit<NegotiationState, 'currentFloorState' | 'playerHand'> { // Omit complex objects if needed
    playerHandCount: number;
    hasProposalA: boolean;
    hasProposalB: boolean;
}
const DebugInfoPanel: React.FC<DebugInfoPanelProps> = React.memo(({
    phaseInfo, isAiTurn, playerHandCount, hasProposalA, hasProposalB, currentPlayer, leadPlayer, respondingPlayer
}) => {
    if (process.env.NODE_ENV !== 'development') return null;

    const phaseName = phaseInfo.isInitialProposalPhase ? 'Initial' : phaseInfo.isResponsePhase ? 'Response' : phaseInfo.isCounterDecisionPhase ? 'Counter' : 'Unknown';

    return (
        <div className="p-2 bg-slate-900/80 text-xs border-t border-slate-700 overflow-auto max-h-24">
            <p className="font-mono text-slate-400">
                DEBUG: Phase={phaseName} | AI Turn={isAiTurn.toString()} | Hand={playerHandCount} | Proposals: A={hasProposalA.toString()} B={hasProposalB.toString()} | Current={currentPlayer?.name} | Lead={leadPlayer?.name} | Responder={respondingPlayer?.name}
            </p>
        </div>
    );
});
DebugInfoPanel.displayName = 'DebugInfoPanel';


// --- Sub-Component: HelpText ---
interface HelpTextProps {
    timer: number | null;
}
const HelpText: React.FC<HelpTextProps> = React.memo(({ timer }) => {
    return (
        <div className="p-2 text-xs text-slate-500 text-center border-t border-slate-700 bg-slate-900/50">
            <p>
                Drag and drop cards to make your move, or click to select and use the buttons.
                {timer === 0 && <span className="ml-2 text-red-400">Time expired! Auto-passing...</span>}
            </p>
        </div>
    );
});
HelpText.displayName = 'HelpText';


// --- Main Component: NegotiationPanel ---
const NegotiationPanel = () => {
  // --- State & Effects ---
  const { timer } = useGameEffects();
  const [showTimerAlert, setShowTimerAlert] = useState(false);
  const state = useNegotiationState(); // Uses the hook with derived state

  // Actions from stores
  const selectHandCard = usePlayersStore(state => state.selectHandCard);
  const selectCounterCard = usePlayersStore(state => state.selectCounterCard);
  const proposeCard = useGameFlowStore(state => state.proposeCard);
  const counterPropose = useGameFlowStore(state => state.counterPropose);
  const acceptProposal = useGameFlowStore(state => state.acceptProposal);
  const passProposal = useGameFlowStore(state => state.passProposal);

  // --- Effects ---
  useEffect(() => {
      setShowTimerAlert(timer !== null && timer <= TIMER_ALERT_THRESHOLD && timer > 0); // Don't show at exactly 0
  }, [timer]);

  const handlePassProposalForTimeout = useCallback(() => {
      // Avoid passing if state changed just before timeout execution
      if (timer === 0 && !state.isAiTurn && passProposal) {
           console.log("Auto-passing due to timeout");
           passProposal();
      }
  }, [passProposal, state.isAiTurn, timer]); // Add timer dependency

  useEffect(() => {
      let timeoutId: NodeJS.Timeout | null = null;
      if (timer === 0 && !state.isAiTurn) {
          console.log(`Scheduling auto-pass in ${AUTO_PASS_DELAY}ms`);
          timeoutId = setTimeout(handlePassProposalForTimeout, AUTO_PASS_DELAY);
      }
      return () => {
          if (timeoutId) {
              console.log("Clearing scheduled auto-pass");
              clearTimeout(timeoutId);
          }
      };
  }, [timer, state.isAiTurn, handlePassProposalForTimeout]);


  // --- Memoized Handlers ---
  // This is the single click handler passed down
  const handleCardClick = useCallback((cardId: string) => {
      if (state.isAiTurn) return; // Ignore clicks during AI turn

      // Logic depends on the current phase
      if (state.phaseInfo.isInitialProposalPhase) {
          selectHandCard(cardId); // Selects for initial proposal
      } else if (state.phaseInfo.isResponsePhase) {
          selectCounterCard(cardId); // Selects for counter proposal
      }
      // No action needed in other phases on card click
  }, [state.isAiTurn, state.phaseInfo, selectHandCard, selectCounterCard]);

  // Action button handlers
  const handleProposeCard = useCallback(() => {
      if (proposeCard && !state.isAiTurn && state.selectedHandCardId) proposeCard(); // Check selection
  }, [proposeCard, state.isAiTurn, state.selectedHandCardId]);

  const handleCounterPropose = useCallback(() => {
      if (counterPropose && !state.isAiTurn && state.selectedCounterCardId) counterPropose(); // Check selection
  }, [counterPropose, state.isAiTurn, state.selectedCounterCardId]);

  const handleAcceptProposal = useCallback(() => {
      if (acceptProposal && !state.isAiTurn) acceptProposal();
  }, [acceptProposal, state.isAiTurn]);

  const handlePassProposal = useCallback(() => {
      if (passProposal && !state.isAiTurn) passProposal();
  }, [passProposal, state.isAiTurn]);

  // Group handlers for the ActionButtons component
  const actionHandlers = useMemo(() => ({
      onPropose: handleProposeCard,
      onCounterPropose: handleCounterPropose,
      onAccept: handleAcceptProposal,
      onPass: handlePassProposal,
  }), [handleProposeCard, handleCounterPropose, handleAcceptProposal, handlePassProposal]);


  // --- REMOVED: Memoized Card Renderer (useCallback) ---
  // const renderCard = useCallback(...); // Deleted


  // --- Render ---
  return (
      <div className="flex flex-col w-full h-full bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-700 overflow-hidden">
          <NegotiationHeader
              currentFloor={state.currentFloor}
              phaseInfo={state.phaseInfo}
              timer={timer}
          />
          <TimerAlert timer={timer} showTimerAlert={showTimerAlert} />
          <ProposalsArea
              leadPlayer={state.leadPlayer}
              respondingPlayer={state.respondingPlayer}
              proposalA={state.proposalA}
              proposalB={state.proposalB}
              phaseInfo={state.phaseInfo}
              isAiTurn={state.isAiTurn}
              // Pass down necessary state and the click handler
              selectedHandCardId={state.selectedHandCardId}
              selectedCounterCardId={state.selectedCounterCardId}
              onCardClick={handleCardClick} // Pass the callback here
          />
          <ActionButtons
              phaseInfo={state.phaseInfo}
              selectedHandCardId={state.selectedHandCardId}
              selectedCounterCardId={state.selectedCounterCardId}
              isAiTurn={state.isAiTurn}
              handlers={actionHandlers}
          />
          {/* Player hand area shown only when it's not AI's turn */}
          {!state.isAiTurn && (
              <PlayerHandArea
                  playerHand={state.playerHand}
                  currentPlayer={state.currentPlayer}
                  phaseInfo={state.phaseInfo}
                  // Pass down necessary state and the click handler
                  selectedHandCardId={state.selectedHandCardId}
                  selectedCounterCardId={state.selectedCounterCardId}
                  isAiTurn={state.isAiTurn} // Although isAiTurn is false here, RenderCard might need it
                  onCardClick={handleCardClick} // Pass the callback here
              />
          )}
          <DebugInfoPanel
              // Pass necessary debug info (ensure props match DebugInfoPanelProps)
              phaseInfo={state.phaseInfo}
              isAiTurn={state.isAiTurn}
              playerHandCount={state.playerHand.length}
              hasProposalA={!!state.proposalA}
              hasProposalB={!!state.proposalB}
              currentPlayer={state.currentPlayer}
              leadPlayer={state.leadPlayer}
              respondingPlayer={state.respondingPlayer}
              selectedHandCardId={state.selectedHandCardId} // Added for debug
              selectedCounterCardId={state.selectedCounterCardId} // Added for debug
              currentFloor={state.currentFloor} // Added for debug
          />
          <HelpText timer={timer} />
      </div>
  );
};

export default NegotiationPanel;