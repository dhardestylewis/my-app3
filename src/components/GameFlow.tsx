'use client';

// src/components/GameFlow.tsx

import { useGameStateMachine } from '@/hooks/useGameStateMachine'; // Assuming path alias '@/' points to 'src/'

function GameFlow() {
  const { state, matches, can } = useGameStateMachine();
  
  const isAwaitingProposal = matches('playing.waitingForProposal');
  const isAwaitingResponse = matches('playing.waitingForResponse');
  const canAccept = can('ACCEPT');
  const canPropose = can('PROPOSE');
  
  // Render game UI based on current state
  return (
    <div>
      <div className="game-state">Current State: {String(state)}</div>
      
      {isAwaitingProposal && (
        <div className="phase-info">
          <h3>Proposal Phase</h3>
          <p>Select a card from your hand to propose for this floor.</p>
        </div>
      )}
      
      {isAwaitingResponse && (
        <div className="phase-info">
          <h3>Response Phase</h3>
          <p>Accept the proposal, make a counter-proposal, or pass.</p>
        </div>
      )}
      
      {/* Action buttons enabled/disabled based on state */}
      <div className="actions">
        <button disabled={!canPropose}>
          Propose Selected Card
        </button>
        
        <button disabled={!canAccept}>
          Accept Proposal
        </button>
        
        <button disabled={!can('COUNTER')}>
          Counter Propose
        </button>
        
        <button disabled={!can('PASS')}>
          Pass
        </button>
      </div>
    </div>
  );
}