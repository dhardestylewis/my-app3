"use client";
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useGameStore } from '../store/useGameStore';
import { CardData } from '@/data/types';
import { Button } from "@/components/ui/button";
import { Clock, Check, XCircle, Shuffle, Send, ArrowLeftRight, AlertTriangle } from 'lucide-react';
import Card from "@/components/ui/card"; // Assuming this is your card component

const NegotiationPanel = () => {
  // Use individual selectors to prevent infinite loops
  const currentFloor = useGameStore(state => state.currentFloor);
  const proposalTimer = useGameStore(state => state.proposalTimer);
  const selectedHandCardId = useGameStore(state => state.selectedHandCardId);
  const selectedCounterCardId = useGameStore(state => state.selectedCounterCardId);
  // choose the right store action based on phase
  const selectProposalCard   = useGameStore(s => s.selectProposalCard);
  const selectCounterCard    = useGameStore(s => s.selectCounterCard);
  const proposeCard = useGameStore(state => state.proposeCard);
  const counterPropose = useGameStore(state => state.counterPropose);
  const acceptProposal = useGameStore(state => state.acceptProposal);
  const passProposal = useGameStore(state => state.passProposal);
  const isAiTurn = useGameStore(state => state.isAiTurn);
  
  // Get player data and floor state with useCallback
  const players = useGameStore(state => state.players);
  const floors = useGameStore(state => state.floors);
  const currentPlayerIndex = useGameStore(state => state.currentPlayerIndex);
  
  // Calculate derived state in component with useMemo to avoid recalculations
  const currentPlayer = useMemo(() => {
    return players[currentPlayerIndex];
  }, [players, currentPlayerIndex]);
  
  const leadPlayer = useMemo(() => {
    // Determine lead player based on floor blocks (1-5: Player A, 6-10: Player B, etc.)
    const blockSize = 5;
    const blockNumber = Math.ceil(currentFloor / blockSize);
    const isPlayerALead = blockNumber % 2 === 1; // Odd blocks: A leads, Even blocks: B leads
    
    return players.find(p => p.isLeadPlayer === isPlayerALead);
  }, [players, currentFloor]);
  
  const respondingPlayer = useMemo(() => {
    return players.find(p => p.id !== leadPlayer?.id);
  }, [players, leadPlayer]);
  
  const currentFloorState = useMemo(() => {
    return floors.find(f => f.floorNumber === currentFloor);
  }, [floors, currentFloor]);
  
  const [timeLeft, setTimeLeft] = useState(30);
  const [showTimerAlert, setShowTimerAlert] = useState(false);
  
  // Update timeLeft when proposalTimer changes
  useEffect(() => {
    if (proposalTimer !== null) {
      setTimeLeft(proposalTimer);
      setShowTimerAlert(false);
    }
  }, [proposalTimer]);
  
  // Memoize passProposal to avoid infinite updates
  const handlePassProposal = useCallback(() => {
    if (passProposal) {
      passProposal();
    }
  }, [passProposal]);
  
  // Timer effect with useCallback
  useEffect(() => {
    if (proposalTimer === null) return;
    
    let timerId: NodeJS.Timeout | null = null;
    
    if (proposalTimer > 0) {
      timerId = setInterval(() => {
        setTimeLeft(prevTime => {
          // Show timer alert when time is running low
          if (prevTime <= 10 && prevTime > 5 && !showTimerAlert) {
            setShowTimerAlert(true);
          }
          
          if (prevTime <= 1) {
            if (timerId) clearInterval(timerId);
            // Auto-pass on timeout but schedule it to avoid React warnings
            setTimeout(() => {
              handlePassProposal();
            }, 0);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }
    
    return () => {
      if (timerId) clearInterval(timerId);
    };
  }, [proposalTimer, handlePassProposal, showTimerAlert]);
  
  // Determine negotiation phase - use useMemo to cache calculations
  const phaseInfo = useMemo(() => {
    const isLeadPlayerTurn = currentPlayer?.id === leadPlayer?.id;
    const hasProposalA = !!currentFloorState?.proposalA;
    const hasProposalB = !!currentFloorState?.proposalB;
    const isBothProposalsPhase = hasProposalA && hasProposalB;
    const isInitialProposalPhase = isLeadPlayerTurn && !hasProposalA && !hasProposalB;
    const isResponsePhase = !isLeadPlayerTurn && (hasProposalA || hasProposalB) && !(hasProposalA && hasProposalB);
    const isCounterDecisionPhase = isLeadPlayerTurn && isBothProposalsPhase;
    
    // Calculate phase text and color
    if (isInitialProposalPhase) {
      return {
        text: `${leadPlayer?.name || 'Lead player'} to make initial proposal`,
        icon: <Send className="mr-2 h-5 w-5 text-blue-400" />,
        color: "text-blue-400",
        isInitialProposalPhase: true,
        isResponsePhase: false,
        isCounterDecisionPhase: false
      };
    } else if (isResponsePhase) {
      return {
        text: `${respondingPlayer?.name || 'Responding player'} to accept, counter, or pass`,
        icon: <ArrowLeftRight className="mr-2 h-5 w-5 text-purple-400" />,
        color: "text-purple-400",
        isInitialProposalPhase: false,
        isResponsePhase: true,
        isCounterDecisionPhase: false
      };
    } else if (isCounterDecisionPhase) {
      return {
        text: `${leadPlayer?.name || 'Lead player'} to accept counter-proposal or let AI mediate`,
        icon: <Shuffle className="mr-2 h-5 w-5 text-amber-400" />,
        color: "text-amber-400",
        isInitialProposalPhase: false,
        isResponsePhase: false,
        isCounterDecisionPhase: true
      };
    }
    
    return {
      text: "Waiting...",
      icon: <Clock className="mr-2 h-5 w-5 text-slate-400" />,
      color: "text-slate-400",
      isInitialProposalPhase: false,
      isResponsePhase: false,
      isCounterDecisionPhase: false
    };
  }, [currentPlayer, leadPlayer, respondingPlayer, currentFloorState]);

  // Get relevant cards
  const proposalA  = currentFloorState?.proposalA;
  const proposalB  = currentFloorState?.proposalB;
  const playerHand = currentPlayer?.hand || [];

  // Pull in the two real selectors from the store
  const selectProposal = useGameStore(s => s.selectProposalCard);
  const selectCounter  = useGameStore(s => s.selectCounterCard);

  // Safe handler for clicking (or later dragging) a card
  const handleCardClick = useCallback((cardId: string) => {
    if (isAiTurn) return;                    // never select on AI’s turn

    if (phaseInfo.isInitialProposalPhase) {
      selectProposal(cardId);
    } else if (phaseInfo.isResponsePhase) {
      selectCounter(cardId);
    }
  }, [
    isAiTurn,
    phaseInfo.isInitialProposalPhase,
    phaseInfo.isResponsePhase,
    selectProposal,
    selectCounter,
  ]);
  
  // Safe handlers for buttons
  const handleProposeCard = useCallback(() => {
    if (proposeCard && !isAiTurn) {
      proposeCard();
    }
  }, [proposeCard, isAiTurn]);
  
  const handleCounterPropose = useCallback(() => {
    if (counterPropose && !isAiTurn) {
      counterPropose();
    }
  }, [counterPropose, isAiTurn]);
  
  const handleAcceptProposal = useCallback(() => {
    if (acceptProposal && !isAiTurn) {
      acceptProposal();
    }
  }, [acceptProposal, isAiTurn]);
  
  // Render a card with proper key and draggable behavior
  const renderCard = useCallback((card: CardData, index: number, isProposal: boolean = false) => {
    const isSelected = phaseInfo.isInitialProposalPhase 
      ? selectedHandCardId === card.id 
      : phaseInfo.isResponsePhase 
        ? selectedCounterCardId === card.id 
        : false;
    
    // Determine if card is interactive - only for player's turn and not proposals
    const isInteractive = !isProposal && !isAiTurn && 
      (phaseInfo.isInitialProposalPhase || phaseInfo.isResponsePhase);
    
    return (
      <div 
        key={`card-${card.id}-${index}`} 
        className={`flex-shrink-0 transition-all duration-150 ${
          isInteractive ? 'cursor-pointer hover:scale-105 hover:shadow-lg active:scale-95' : ''
        } ${isSelected ? 'ring-2 ring-yellow-400' : ''}`}
        onClick={() => isInteractive && handleCardClick(card.id)}
      >
        <Card
          card={card}
          isSelected={isSelected}
          isPlayable={isInteractive}
          onCardClick={() => isInteractive && handleCardClick(card.id)}
        />
      </div>
    );
  }, [phaseInfo, selectedHandCardId, selectedCounterCardId, handleCardClick, isAiTurn]);
  
  // Auto-accept/pass on timeout
  useEffect(() => {
    // If timer has expired (0s) and it's not AI's turn, auto-pass
    if (timeLeft === 0 && !isAiTurn) {
      // Wait a moment to avoid UI conflicts
      const timeoutId = setTimeout(() => {
        handlePassProposal();
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [timeLeft, isAiTurn, handlePassProposal]);
  
  return (
    <div className="flex flex-col w-full h-full bg-slate-800/90 backdrop-blur-sm rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="sticky top-0 p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/80 z-10">
        <div className="flex items-center">
          {phaseInfo.icon}
          <h2 className="text-lg font-semibold">
            <span className="text-slate-400">Floor {currentFloor}:</span>{' '}
            <span className={phaseInfo.color}>{phaseInfo.text}</span>
          </h2>
        </div>
        <div className={`py-1 px-3 rounded-full ${timeLeft <= 10 ? 'bg-red-900/60 text-red-300 animate-pulse' : 'bg-slate-700/60 text-slate-300'} flex items-center`}>
          <Clock className="mr-1 h-4 w-4" /> {timeLeft}s
        </div>
      </div>
      
      {/* Timer alert */}
      {showTimerAlert && timeLeft <= 10 && timeLeft > 0 && (
        <div className="bg-red-900/40 text-red-300 p-2 text-center text-sm flex items-center justify-center">
          <AlertTriangle className="h-4 w-4 mr-2" />
          Time running out! Auto-pass will occur at 0s
        </div>
      )}
      
      {/* Proposals Area */}
      <div className="grid grid-cols-2 gap-4 p-4 border-b border-slate-700 bg-slate-900/50">
        <div className="space-y-2">
          <h3 className="font-semibold text-slate-300 flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
            Lead Proposal
            {leadPlayer && <span className="ml-2 text-xs text-slate-500">({leadPlayer.role})</span>}
          </h3>
          <div className="border border-slate-700 rounded-lg p-3 min-h-[180px] flex items-center justify-center bg-slate-800/60">
            {proposalA ? (
              renderCard(proposalA, 0, true)
            ) : (
              <p className="text-slate-500 italic">No proposal yet</p>
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          <h3 className="font-semibold text-slate-300 flex items-center">
            <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
            Counter Proposal
            {respondingPlayer && <span className="ml-2 text-xs text-slate-500">({respondingPlayer.role})</span>}
          </h3>
          <div className="border border-slate-700 rounded-lg p-3 min-h-[180px] flex items-center justify-center bg-slate-800/60">
            {proposalB ? (
              renderCard(proposalB, 1, true)
            ) : (
              <p className="text-slate-500 italic">No counter yet</p>
            )}
          </div>
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="p-4 flex justify-center gap-4 border-b border-slate-700 bg-slate-800/60">
        {phaseInfo.isInitialProposalPhase && selectedHandCardId && !isAiTurn && (
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            onClick={handleProposeCard}
          >
            <Send className="mr-2 h-5 w-5" /> Propose
          </Button>
        )}
        
        {phaseInfo.isResponsePhase && !isAiTurn && (
          <>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleAcceptProposal}
            >
              <Check className="mr-2 h-5 w-5" /> Accept
            </Button>
            
            {selectedCounterCardId && (
              <Button
                className="bg-purple-600 hover:bg-purple-700"
                onClick={handleCounterPropose}
              >
                <ArrowLeftRight className="mr-2 h-5 w-5" /> Counter
              </Button>
            )}
            
            <Button
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
              onClick={handlePassProposal}
            >
              <XCircle className="mr-2 h-5 w-5" /> Pass
            </Button>
          </>
        )}
        
        {phaseInfo.isCounterDecisionPhase && !isAiTurn && (
          <>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleAcceptProposal}
            >
              <Check className="mr-2 h-5 w-5" /> Accept Counter
            </Button>
            
            <Button
              variant="outline"
              className="border-amber-600/70 text-amber-500 hover:text-amber-400 hover:bg-slate-700"
              onClick={handlePassProposal}
            >
              <Shuffle className="mr-2 h-5 w-5" /> Let AI Decide
            </Button>
          </>
        )}
        
        {/* Show waiting message when it's AI's turn */}
        {isAiTurn && (
          <div className="flex items-center justify-center text-slate-400 py-2">
            <Clock className="animate-spin h-4 w-4 mr-2" />
            Waiting for AI's decision...
          </div>
        )}
      </div>
      
      {/* Hand Cards Area - Improved for scrolling and visibility */}
      {(phaseInfo.isInitialProposalPhase || phaseInfo.isResponsePhase) && !isAiTurn && (
        <div className="flex flex-col flex-grow p-4 overflow-hidden">
          <h3 className="font-semibold text-slate-300 mb-3 sticky top-0">Your Hand</h3>
          {playerHand.length === 0 ? (
            <p className="text-slate-500 italic text-center mt-4">Your hand is empty</p>
          ) : (
            <div className="overflow-y-auto max-h-[calc(100%-2rem)] pr-2 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {playerHand.map((card, index) => renderCard(card, index))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Message when not your turn */}
      {!phaseInfo.isInitialProposalPhase && !phaseInfo.isResponsePhase && !phaseInfo.isCounterDecisionPhase && !isAiTurn && (
        <div className="flex-grow flex items-center justify-center p-8">
          <div className="text-slate-500 italic text-center bg-slate-800/60 p-6 rounded-lg border border-slate-700">
            <Clock className="h-10 w-10 mx-auto mb-4 text-slate-400" />
            <p className="mb-2">Waiting for other player's action...</p>
            <p className="text-xs">The AI will make its decision automatically.</p>
          </div>
        </div>
      )}
      
      {/* Help text for responsive view */}
      <div className="p-2 text-xs text-slate-500 text-center border-t border-slate-700 bg-slate-900/50">
        Click on a card in your hand to select it, then use the buttons above to make your move.
        {timeLeft === 0 && <div className="mt-1 text-red-400">Time expired! Auto-passing...</div>}
      </div>
    </div>
  );
};

export default NegotiationPanel;