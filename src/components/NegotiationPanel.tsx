// src/components/NegotiationPanel.tsx
// Corrected for prop typing in sub-components, Zustand selector usage, and other TSC errors.

'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { shallow } from 'zustand/shallow';
import { useStoreWithEqualityFn } from 'zustand/traditional';

import { useFloorStore, FloorStoreState } from '@/stores/useFloorStore';
import { usePlayersStore, Player, PlayersStoreState, ProposalBasketItem, PlayerRole } from '@/stores/usePlayersStore';
import { useGameFlowStore } from '@/stores/useGameFlowStore';
import { CardInstance, PhaseInfo, FloorState as FloorDataType } from '@/data/types'; // CardData changed to CardInstance if proposals are instances
import { Button } from "@/components/ui/button";
import { Clock, Check, XCircle, Shuffle, Send, ArrowLeftRight, AlertTriangle, ThumbsUp } from 'lucide-react';
import { useDroppable, Active } from '@dnd-kit/core'; // Active might be needed for isHandCard check
import { useGameEffects } from '@/hooks/useGameEffects'; // Assuming this hook is correctly defined
import RenderCard from '@/components/game/RenderCard';
// PlayerHandAreaInternal is not directly used by NegotiationPanel in my F.4 structure, but was in user's.
// For now, I'll assume it's not directly here unless NegotiationPanel itself renders a hand.
// import PlayerHandAreaInternal from './game/PlayerHandArea'; 
import { logDebug, logError } from '@/utils/logger';
import { deepCopy } from '@/utils/deepCopy';

const LEAD_PLAYER_BLOCK_SIZE = 5;
const TIMER_ALERT_THRESHOLD = 10;
const AUTO_PASS_DELAY = 1000;

interface NegotiationPanelProps {
    isMobile?: boolean; // For responsive adjustments if needed by NegotiationPanel itself
}

interface NegotiationState {
    currentFloor: number;
    currentPlayer?: Player;
    leadPlayer?: Player;
    respondingPlayer?: Player;
    // Proposals on the floor should be CardInstance arrays if they've been "played"
    proposalA?: CardInstance[]; 
    proposalB?: CardInstance[];
    // Human player's hand for context if NegotiationPanel allows direct interaction (unlikely with F.3 counts)
    // playerHand: CardInstance[]; // This was in original structure, but interaction is via counts now
    proposalBasket: ProposalBasketItem[]; // Counts selected from hand
    counterProposalBasket: ProposalBasketItem[]; // Counts selected from hand
    isAiTurn: boolean;
    phaseInfo: PhaseInfo;
    timer: number | null; // Added timer to the shared state
}

// This custom hook encapsulates the state needed by the NegotiationPanel and its children
const useNegotiationPanelState = (timerHookValue: number | null): NegotiationState => {
    const currentFloor = useFloorStore(state => state.currentFloor);
    const floorStateData = useStoreWithEqualityFn(useFloorStore, (state: FloorStoreState) => state.getCurrentFloorState(), shallow);
    
    // Assuming proposalA and proposalB in FloorState are CardInstance[]
    const proposalA = floorStateData?.proposalA as CardInstance[] | undefined;
    const proposalB = floorStateData?.proposalB as CardInstance[] | undefined;

    const players = useStoreWithEqualityFn(usePlayersStore, (s: PlayersStoreState) => s.players, shallow);
    const currentPlayerIndex = usePlayersStore(s => s.currentPlayerIndex);
    
    const proposalBasket = useStoreWithEqualityFn(usePlayersStore, (s: PlayersStoreState) => s.getCurrentProposalBasket(), shallow);
    const counterProposalBasket = useStoreWithEqualityFn(usePlayersStore, (s: PlayersStoreState) => s.getCurrentCounterProposalBasket(), shallow);
    
    const isAiTurn = useGameFlowStore(state => state.isAiTurn);

    const currentPlayer = useMemo(() => players[currentPlayerIndex] ? deepCopy(players[currentPlayerIndex]) : undefined, [players, currentPlayerIndex]);
    
    const leadPlayer = useMemo(() => {
        if (players.length < 2) return undefined;
        const blockNumber = Math.ceil(currentFloor / LEAD_PLAYER_BLOCK_SIZE);
        const isPlayerALead = blockNumber % 2 === 1; 
        return players[isPlayerALead ? 0 : 1] ? deepCopy(players[isPlayerALead ? 0 : 1]) : undefined;
    }, [players, currentFloor]);

    const respondingPlayer = useMemo(() => {
        if (players.length < 2 || !leadPlayer) return undefined;
        const responder = players.find(p => p.id !== leadPlayer.id);
        return responder ? deepCopy(responder) : undefined;
    }, [players, leadPlayer]);
    
    const phaseInfo = useMemo((): PhaseInfo => {
        const localCurrentPlayer = currentPlayer; 
        const localLeadPlayer = leadPlayer;     
        const hasProposalA = !!proposalA?.length;
        const hasProposalB = !!proposalB?.length;
        const isLeadPlayerTurn = localCurrentPlayer?.id === localLeadPlayer?.id;
        
        const isInitialProposalPhase = isLeadPlayerTurn && !hasProposalA && !hasProposalB; 
        const isResponsePhase = !!(localCurrentPlayer && localLeadPlayer && localCurrentPlayer.id !== localLeadPlayer.id && hasProposalA && !hasProposalB);
        const isCounterDecisionPhase = isLeadPlayerTurn && hasProposalA && hasProposalB;

        if (isInitialProposalPhase) return { text: `${localLeadPlayer?.name ?? 'Lead'} to propose`, icon: <Send className="mr-2 h-5 w-5 text-blue-400" />, color: "text-blue-400", isInitialProposalPhase: true, isResponsePhase: false, isCounterDecisionPhase: false };
        if (isResponsePhase) return { text: `${localCurrentPlayer?.name ?? 'Responder'} to act`, icon: <ArrowLeftRight className="mr-2 h-5 w-5 text-purple-400" />, color: "text-purple-400", isInitialProposalPhase: false, isResponsePhase: true, isCounterDecisionPhase: false };
        if (isCounterDecisionPhase) return { text: `${localLeadPlayer?.name ?? 'Lead'} to decide on counter`, icon: <Shuffle className="mr-2 h-5 w-5 text-amber-400" />, color: "text-amber-400", isInitialProposalPhase: false, isResponsePhase: false, isCounterDecisionPhase: true };
        return { text: "Waiting...", icon: <Clock className="mr-2 h-5 w-5 text-slate-400" />, color: "text-slate-400", isInitialProposalPhase: false, isResponsePhase: false, isCounterDecisionPhase: false };
    }, [currentPlayer, leadPlayer, proposalA, proposalB]);

    return {
        currentFloor, currentPlayer, leadPlayer, respondingPlayer, proposalA, proposalB,
        proposalBasket: proposalBasket || [], 
        counterProposalBasket: counterProposalBasket || [],
        isAiTurn, phaseInfo, timer: timerHookValue,
    };
};

// --- Sub-component Prop Interfaces ---
interface DroppableZoneProps {
    id: string;
    children: React.ReactNode;
    isActive?: boolean; // Controlled by parent based on game phase
    className?: string;
    onDropCard?: (draggedItem: Active) => void; // Callback for when a card is dropped
}

const DroppableZone: React.FC<DroppableZoneProps> = React.memo(({ 
    id, children, isActive = false, className = '', onDropCard 
}: DroppableZoneProps) => {
    const { setNodeRef, isOver } = useDroppable({ 
        id, 
        disabled: !isActive,
        // data: { accepts: ['handCard'] } // Optional: specify what it accepts
    });
    
    const baseClasses = "border border-slate-700 rounded-lg p-3 min-h-[120px] sm:min-h-[150px] flex flex-col items-center justify-center bg-slate-800/60 transition-colors duration-200 space-y-2";
    const activeFeedbackClasses = isOver && isActive ? 'border-emerald-500 bg-slate-700/60 shadow-inner shadow-emerald-900/50' : '';
    const placeholderHintClasses = isActive ? 'border-dashed' : '';
    const hasContent = React.Children.count(children) > 0; 

    return (
        <div 
            ref={setNodeRef} 
            className={`${baseClasses} ${activeFeedbackClasses} ${!hasContent && isActive ? placeholderHintClasses : ''} ${className}`} 
            aria-disabled={!isActive}
        >
            {children}
        </div>
    );
});
DroppableZone.displayName = 'DroppableZone';

interface NegotiationHeaderProps {
    currentFloor: number;
    phaseInfo: PhaseInfo;
    timer: number | null;
}
const NegotiationHeader: React.FC<NegotiationHeaderProps> = React.memo(({ 
    currentFloor, phaseInfo, timer 
}: NegotiationHeaderProps) => {
    const timerColor = timer !== null && timer <= TIMER_ALERT_THRESHOLD ? 'bg-red-900/60 text-red-300 animate-pulse' : 'bg-slate-700/60 text-slate-300';
    return (
        <div className="sticky top-0 p-3 sm:p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/80 z-20 backdrop-blur-sm">
            <div className="flex items-center min-w-0">
                {phaseInfo.icon}
                <h2 className="text-md sm:text-lg font-semibold truncate">
                    <span className="text-slate-400">Floor {currentFloor}:</span>{' '}
                    <span className={`${phaseInfo.color} `}>{phaseInfo.text}</span>
                </h2>
            </div>
            {timer !== null && (
                <div className={`py-1 px-2 sm:px-3 rounded-full ${timerColor} flex items-center text-xs sm:text-sm font-medium transition-colors flex-shrink-0`}>
                    <Clock className="mr-1 h-3 w-3 sm:h-4 sm:w-4" /> {timer}s
                </div>
            )}
        </div>
    );
});
NegotiationHeader.displayName = 'NegotiationHeader';

interface TimerAlertProps {
    timer: number | null;
    showTimerAlert: boolean; // Controlled by parent
}
const TimerAlert: React.FC<TimerAlertProps> = React.memo(({ 
    timer, showTimerAlert 
}: TimerAlertProps) => {
    if (!showTimerAlert || timer === null || timer <= 0 || timer > TIMER_ALERT_THRESHOLD) return null;
    return (
        <div className="bg-red-900/40 text-red-300 p-2 text-center text-sm flex items-center justify-center border-y border-red-800/50">
            <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />Time running out! Auto-pass in {timer}s
        </div>
    );
});
TimerAlert.displayName = 'TimerAlert';


interface ProposalsAreaProps {
    leadPlayer?: Player;
    respondingPlayer?: Player;
    proposalA?: CardInstance[]; // Should be CardInstance if rendered by RenderCard
    proposalB?: CardInstance[];
    phaseInfo: PhaseInfo;
    isAiTurn: boolean;
    currentFloor: number;
    // Add callbacks for drag-and-drop if handled here
    // onDropToLeadProposal: (card: CardInstance) => void; 
    // onDropToCounterProposal: (card: CardInstance) => void;
}
const ProposalsArea: React.FC<ProposalsAreaProps> = React.memo(({
    leadPlayer, respondingPlayer, proposalA, proposalB, phaseInfo, isAiTurn, currentFloor
}: ProposalsAreaProps) => {
    const leadDropActive = phaseInfo.isInitialProposalPhase && !isAiTurn;
    const counterDropActive = phaseInfo.isResponsePhase && !isAiTurn;
    
    const leadPlaceholder = (isAiTurn && phaseInfo.isInitialProposalPhase) 
        ? "Waiting for AI proposal..." 
        : leadDropActive ? "Drag card from hand or click to set proposal count" : "Lead Proposal Area";
    
    const counterPlaceholder = (isAiTurn && phaseInfo.isResponsePhase) 
        ? "Waiting for AI response..." 
        : counterDropActive ? "Drag card from hand or click to set counter count" : "Counter Proposal Area";

    const renderProposalCards = (cards?: CardInstance[]) => {
        if (!cards || cards.length === 0) return null;
        // RenderCard expects CardInstance
        return cards.map(cardInstance => (
            <RenderCard
                key={cardInstance.instanceId}
                card={cardInstance}
                isProposal={true} // These are cards in proposal slots
                phaseInfo={phaseInfo}
                displayCount={cardInstance.stack} // If proposals are single instances, count is 1 or undefined
                isAiTurn={isAiTurn}
                onCardClick={() => { /* Click on proposal card could clear it or show info */ }} 
                currentFloor={currentFloor}
            />
        ));
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 p-3 sm:p-4 border-b border-slate-700 bg-slate-900/50">
            <div className="space-y-2">
                <h3 className="font-semibold text-slate-300 flex items-center text-sm sm:text-base">
                    <div className={`w-3 h-3 rounded-full ${leadPlayer?.role === PlayerRole.Developer ? 'bg-red-500' : 'bg-blue-500'} mr-2 flex-shrink-0`}></div>
                    Lead Proposal {leadPlayer && <span className="ml-2 text-xs text-slate-500 truncate">({leadPlayer.name})</span>}
                </h3>
                <DroppableZone id="lead-proposal" isActive={leadDropActive}>
                    {proposalA && proposalA.length > 0 
                        ? (<div className="flex flex-wrap justify-center items-start gap-2 w-full">{renderProposalCards(proposalA)}</div>) 
                        : <p className="text-slate-500 italic text-center text-xs sm:text-sm p-2 sm:p-4">{leadPlaceholder}</p>}
                </DroppableZone>
            </div>
            <div className="space-y-2">
                <h3 className="font-semibold text-slate-300 flex items-center text-sm sm:text-base">
                    <div className={`w-3 h-3 rounded-full ${respondingPlayer?.role === PlayerRole.Developer ? 'bg-red-500' : 'bg-blue-500'} mr-2 flex-shrink-0`}></div>
                    Counter Proposal {respondingPlayer && <span className="ml-2 text-xs text-slate-500 truncate">({respondingPlayer.name})</span>}
                </h3>
                <DroppableZone id="counter-proposal" isActive={counterDropActive}>
                     {proposalB && proposalB.length > 0 
                        ? (<div className="flex flex-wrap justify-center items-start gap-2 w-full">{renderProposalCards(proposalB)}</div>) 
                        : <p className="text-slate-500 italic text-center text-xs sm:text-sm p-2 sm:p-4">{counterPlaceholder}</p>}
                </DroppableZone>
            </div>
        </div>
    );
});
ProposalsArea.displayName = 'ProposalsArea';

interface ActionButtonsProps {
    phaseInfo: PhaseInfo; 
    totalInstancesInProposalBasket: number; 
    totalInstancesInCounterBasket: number;
    isAiTurn: boolean; 
    waitForPlayerAcknowledgement: boolean; 
    handlers: { 
        onSubmitProposal: () => void; onSubmitCounterProposal: () => void; 
        onAccept: () => void; onPass: () => void; 
        onPlayerAcknowledge: () => void; 
    };
}
const ActionButtons: React.FC<ActionButtonsProps> = React.memo(({ 
    phaseInfo, totalInstancesInProposalBasket, totalInstancesInCounterBasket, 
    isAiTurn, waitForPlayerAcknowledgement, handlers 
}: ActionButtonsProps) => {
    // ... (Implementation logic for buttons based on phaseInfo etc. as in F.3, using provided props) ...
    if (waitForPlayerAcknowledgement) { return (<div className="p-4 flex justify-center min-h-[68px] items-center"><Button className="bg-green-600 hover:bg-green-700" onClick={handlers.onPlayerAcknowledge}><Check className="mr-2 h-5 w-5" />Continue</Button></div>); }
    if (isAiTurn) return (<div className="p-4 flex justify-center min-h-[68px] items-center"><div className="flex items-center text-slate-400 py-2"><Clock className="animate-spin h-4 w-4 mr-2" />Waiting for AI...</div></div>);
    
    const canSubmitProposal = phaseInfo.isInitialProposalPhase && totalInstancesInProposalBasket > 0;
    const canSubmitCounter = phaseInfo.isResponsePhase && totalInstancesInCounterBasket > 0;
    const canAcceptResponse = phaseInfo.isResponsePhase; // Assumes a proposal (proposalA) exists
    const canPassResponse = phaseInfo.isResponsePhase;
    const canAcceptCounter = phaseInfo.isCounterDecisionPhase; // Assumes both proposalA and proposalB exist
    const canPassCounter = phaseInfo.isCounterDecisionPhase;

    return (
        <div className="p-3 sm:p-4 flex justify-center flex-wrap gap-2 sm:gap-3 border-b border-slate-700 bg-slate-800/60 min-h-[60px] sm:min-h-[68px] items-center">
            {phaseInfo.isInitialProposalPhase && (<Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={handlers.onSubmitProposal} disabled={!canSubmitProposal}><ThumbsUp className="mr-1.5 h-4 w-4 sm:h-5 sm:w-5" /> Submit Proposal {totalInstancesInProposalBasket > 0 ? `(${totalInstancesInProposalBasket})` : ''}</Button>)}
            {phaseInfo.isResponsePhase && (<>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handlers.onAccept} disabled={!canAcceptResponse}><Check className="mr-1.5 h-4 w-4 sm:h-5 sm:w-5" /> Accept</Button>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={handlers.onSubmitCounterProposal} disabled={!canSubmitCounter}><ThumbsUp className="mr-1.5 h-4 w-4 sm:h-5 sm:w-5" /> Counter {totalInstancesInCounterBasket > 0 ? `(${totalInstancesInCounterBasket})` : ''}</Button>
                <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-700" onClick={handlers.onPass} disabled={!canPassResponse}><XCircle className="mr-1.5 h-4 w-4 sm:h-5 sm:w-5" /> Pass</Button>
            </>)}
            {phaseInfo.isCounterDecisionPhase && (<>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={handlers.onAccept} disabled={!canAcceptCounter}><Check className="mr-1.5 h-4 w-4 sm:h-5 sm:w-5" /> Accept Counter</Button>
                <Button size="sm" variant="outline" className="border-amber-600/70 text-amber-500 hover:text-amber-400 hover:bg-slate-700" onClick={handlers.onPass} disabled={!canPassCounter}><Shuffle className="mr-1.5 h-4 w-4 sm:h-5 sm:w-5" /> Mediate</Button>
            </>)}
        </div>
    );
});
ActionButtons.displayName = 'ActionButtons';

interface DebugInfoPanelProps { // Renamed from DebugInfoPanelPropsAdapted
    currentFloor: number;
    phaseInfo: PhaseInfo;
    isAiTurn: boolean;
    // playerHandStacksCount: number; // If needed
    proposalACount: number; // Count of cards in proposalA
    proposalBCount: number; // Count of cards in proposalB
    currentPlayerName?: string;
    leadPlayerName?: string;
    respondingPlayerName?: string;
    proposalBasketCount: number; 
    counterBasketCount: number; 
}
const DebugInfoPanel: React.FC<DebugInfoPanelProps> = React.memo(({ 
    /* Destructure props here */
    currentFloor, phaseInfo, isAiTurn, proposalACount, proposalBCount, currentPlayerName, proposalBasketCount, counterBasketCount
}: DebugInfoPanelProps) => { 
    // Example debug info - kept minimal
    if (process.env.NODE_ENV !== 'development') return null;
    return (
        <div className="p-2 text-xs text-slate-500 bg-slate-950 border-t border-slate-700/50 max-h-24 overflow-y-auto custom-scrollbar-thin">
            <p>DEBUG: Floor {currentFloor}, Phase: {phaseInfo.text}, AI Turn: {isAiTurn.toString()}</p>
            <p>P.A: {proposalACount}, P.B: {proposalBCount}, CurrP: {currentPlayerName}</p>
            <p>Basket(Prop): {proposalBasketCount}, Basket(Count): {counterBasketCount}</p>
        </div>
    );
});
DebugInfoPanel.displayName = 'DebugInfoPanel';

interface HelpTextProps {
    timer: number | null;
    phaseInfo: PhaseInfo; // Added phaseInfo to provide context-specific help
    isAiTurn: boolean;
}
const HelpText: React.FC<HelpTextProps> = React.memo(({ timer, phaseInfo, isAiTurn }: HelpTextProps) => {
    let helpMessage = "Drag cards to proposal areas or click cards in hand to adjust counts.";
    if (isAiTurn) {
        helpMessage = "Waiting for AI to make a move...";
    } else if (phaseInfo.isInitialProposalPhase) {
        helpMessage = "It's your turn to propose. Click cards in your hand to set counts for your proposal, then submit.";
    } else if (phaseInfo.isResponsePhase) {
        helpMessage = "Respond to the proposal. You can accept, pass, or make a counter-offer by setting card counts.";
    } else if (phaseInfo.isCounterDecisionPhase) {
        helpMessage = "Decide on the counter-offer. Accept it, or pass to mediation.";
    }

    return (
        <div className="p-2 text-xs text-slate-500 text-center border-t border-slate-700 bg-slate-900/50">
            <p>
                {helpMessage}
                {timer !== null && timer === 0 && !isAiTurn && <span className="ml-2 text-red-400 font-semibold">Time expired! Auto-passing...</span>}
            </p>
        </div>
    );
});
HelpText.displayName = 'HelpText';

// Main NegotiationPanel component
const NegotiationPanel: React.FC<NegotiationPanelProps> = ({ isMobile }) => {
    const { timer: timerFromHook } = useGameEffects(); // Hook for timer and other effects
    const panelState = useNegotiationPanelState(timerFromHook); // Pass timer value to the state hook
    const { currentFloor, currentPlayer, leadPlayer, respondingPlayer, proposalA, proposalB, 
            proposalBasket, counterProposalBasket, isAiTurn, phaseInfo, timer } = panelState;

    const [showTimerAlert, setShowTimerAlert] = useState(false);
    const waitForPlayerAcknowledgement = useGameFlowStore(s => s.waitForPlayerAcknowledgement);

    const { proposeCard, counterPropose, acceptProposal, passProposal, playerAcknowledgeAndContinue } = useGameFlowStore.getState();
    // Card clicking is handled by PlayerHandArea, which calls cycle...Count actions from its own context.
    // This panel only submits the results from the proposalBasket/counterProposalBasket.

    useEffect(() => { setShowTimerAlert(timer !== null && timer <= TIMER_ALERT_THRESHOLD && timer > 0); }, [timer]);
    useEffect(() => { 
      let timeoutId: NodeJS.Timeout | null = null;
      if (timerFromHook === 0 && !isAiTurn && !waitForPlayerAcknowledgement) { // Use timerFromHook
          timeoutId = setTimeout(() => {
               const currentIsAiTurn = useGameFlowStore.getState().isAiTurn; 
               const currentWaitForAck = useGameFlowStore.getState().waitForPlayerAcknowledgement;
               // Use timerFromHook here as well for the re-check
               if (timerFromHook === 0 && !currentIsAiTurn && !currentWaitForAck) { 
                  logDebug("Timer expired, auto-passing.", "NegotiationPanel");
                  passProposal();
               }
          }, AUTO_PASS_DELAY);
      }
      return () => { if (timeoutId) clearTimeout(timeoutId); };
    // Add timerFromHook to dependency array if it's not just 'timer' from panelState
    }, [timerFromHook, isAiTurn, waitForPlayerAcknowledgement, passProposal]); 

    const handleSubmitProposal = useCallback(() => { if (!isAiTurn && !waitForPlayerAcknowledgement && proposalBasket.length > 0) proposeCard(); }, [isAiTurn, proposalBasket, proposeCard, waitForPlayerAcknowledgement]);
    const handleSubmitCounterProposal = useCallback(() => { if (!isAiTurn && !waitForPlayerAcknowledgement && counterProposalBasket.length > 0) counterPropose(); }, [isAiTurn, counterProposalBasket, counterPropose, waitForPlayerAcknowledgement]);
    const handleAcceptProposal = useCallback(() => { if (!isAiTurn && !waitForPlayerAcknowledgement) acceptProposal(); }, [acceptProposal, isAiTurn, waitForPlayerAcknowledgement]);
    const handlePassAction = useCallback(() => { if (!isAiTurn && !waitForPlayerAcknowledgement) passProposal(); }, [passProposal, isAiTurn, waitForPlayerAcknowledgement]);
    const handlePlayerAcknowledge = useCallback(() => playerAcknowledgeAndContinue(), [playerAcknowledgeAndContinue]);

    const actionHandlers = useMemo(() => ({
        onSubmitProposal: handleSubmitProposal, 
        onSubmitCounterProposal: handleSubmitCounterProposal,
        onAccept: handleAcceptProposal, 
        onPass: handlePassAction,
        onPlayerAcknowledge: handlePlayerAcknowledge,
    }), [handleSubmitProposal, handleSubmitCounterProposal, handleAcceptProposal, handlePassAction, handlePlayerAcknowledge]);

    const totalInstancesInProposalBasket = proposalBasket.reduce((sum, item) => sum + item.count, 0);
    const totalInstancesInCounterBasket = counterProposalBasket.reduce((sum, item) => sum + item.count, 0);

    return (
        <div className="flex flex-col w-full h-full bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-700 overflow-hidden shadow-lg">
            <NegotiationHeader currentFloor={currentFloor} phaseInfo={phaseInfo} timer={timer} />
            <TimerAlert timer={timer} showTimerAlert={showTimerAlert && !waitForPlayerAcknowledgement} />
            <ProposalsArea
                leadPlayer={leadPlayer} respondingPlayer={respondingPlayer}
                proposalA={proposalA} proposalB={proposalB} // These are CardInstance[] from useNegotiationPanelState
                phaseInfo={phaseInfo} isAiTurn={isAiTurn}
                currentFloor={currentFloor}
            />
            <ActionButtons
                phaseInfo={phaseInfo}
                totalInstancesInProposalBasket={totalInstancesInProposalBasket}
                totalInstancesInCounterBasket={totalInstancesInCounterBasket}
                isAiTurn={isAiTurn}
                waitForPlayerAcknowledgement={waitForPlayerAcknowledgement}
                handlers={actionHandlers}
            />
             {/* PlayerHandArea is not directly rendered by NegotiationPanel in F.4 structure */}
             {/* It's part of GameInterface for mobile view, or main layout */}
            <DebugInfoPanel
                 currentFloor={currentFloor} phaseInfo={phaseInfo} isAiTurn={isAiTurn}
                 proposalACount={proposalA?.length ?? 0} 
                 proposalBCount={proposalB?.length ?? 0}
                 currentPlayerName={currentPlayer?.name} 
                 leadPlayerName={leadPlayer?.name}
                 respondingPlayerName={respondingPlayer?.name}
                 proposalBasketCount={totalInstancesInProposalBasket}
                 counterBasketCount={totalInstancesInCounterBasket}
            />
            <HelpText timer={timer} phaseInfo={phaseInfo} isAiTurn={isAiTurn} />
        </div>
    );
};
export default NegotiationPanel;