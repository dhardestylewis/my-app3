// src/App.tsx
"use client"; // Assuming this runs client-side

import React from 'react';
import {
    DndContext,
    DragEndEvent,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors
} from '@dnd-kit/core';
import GameInterface from './components/GameInterface'; // Main UI router
import { InitialDealAnimator } from './components/game/InitialDealAnimator'; // Import the new animator
import { useGameFlowStore, GamePhase } from './stores/useGameFlowStore';
import { usePlayersStore } from './stores/usePlayersStore';
import { useFloorStore } from './stores/useFloorStore';
import { useGameEffects } from './hooks/useGameEffects'; // Handles timers etc.
import { logDebug } from '@/utils/logger'; // Assuming logger is set up

function App() {
    // Initialize game effects (like timers)
    useGameEffects();

    // Get necessary state/actions for drag handling and animator rendering
    const { selectHandCard, selectCounterCard } = usePlayersStore.getState();
    const isAiTurn = useGameFlowStore(state => state.isAiTurn);
    const gamePhase = useGameFlowStore(state => state.gamePhase);

    // Configure sensors for dnd-kit (improved touch/pointer interaction)
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 250, tolerance: 5 },
        })
    );

    // Handle the end of a drag operation
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        // Exit if drag was cancelled, no target, or if it's AI's turn
        if (!over || !active || isAiTurn) {
            return;
        }

        const cardId = String(active.id);
        const dropZoneId = String(over.id);

        // Get necessary state *at the time of drop*
        const { currentFloor } = useFloorStore.getState();
        const { getLeadPlayer, getRespondingPlayer, players, currentPlayerIndex } = usePlayersStore.getState();
        const floorState = useFloorStore.getState().getCurrentFloorState(); // Get current floor details

        const currentPlayer = players[currentPlayerIndex];
        const leadPlayer = getLeadPlayer(currentFloor);
        // const respondingPlayer = getRespondingPlayer(currentFloor); // Not strictly needed here

        if (!currentPlayer || !leadPlayer || !floorState) {
             logDebug('[App - handleDragEnd] Missing player/floor state, cannot process drop.', 'DragDrop');
             return; // Cannot determine phase without state
        }

        // Determine phase logic (simplified version needed for drop target validation)
         const isLeadPlayerTurn = currentPlayer.id === leadPlayer.id;
         const hasProposalA = !!floorState.proposalA;
         const hasProposalB = !!floorState.proposalB;
         const isInitialProposalPhase = isLeadPlayerTurn && !hasProposalA && !hasProposalB;
         // Responding player's turn, and only one proposal exists
         const isResponsePhase = !isLeadPlayerTurn && (hasProposalA || hasProposalB) && !(hasProposalA && hasProposalB);

        logDebug(`[App - handleDragEnd] Drop detected: Card ${cardId} onto ${dropZoneId}. Phase: ${isInitialProposalPhase ? 'Initial' : isResponsePhase ? 'Response' : 'Other'}.`, 'DragDrop');

        // Select card based on the *phase* and the *drop zone ID*
        if (isInitialProposalPhase && dropZoneId === 'lead-proposal') {
            logDebug(`[App - handleDragEnd] Selecting card ${cardId} for lead proposal.`, 'DragDrop');
            selectHandCard(cardId);
            // Note: The actual "Propose" action is triggered by button click in NegotiationPanel
        } else if (isResponsePhase && dropZoneId === 'counter-proposal') {
            logDebug(`[App - handleDragEnd] Selecting card ${cardId} for counter proposal.`, 'DragDrop');
            selectCounterCard(cardId);
             // Note: The actual "Counter" action is triggered by button click in NegotiationPanel
        } else {
            logDebug(`[App - handleDragEnd] Drop ignored: Zone ${dropZoneId} invalid for current phase.`, 'DragDrop');
        }
    };

    return (
        // DndContext wraps the part of the app using drag and drop
        <DndContext onDragEnd={handleDragEnd} sensors={sensors}>
            {/* Main container */}
            <div className="min-h-screen bg-slate-900 text-slate-200 font-sans"> {/* Updated background */}
                 {/* GameStateInitializer and ClientLayout should wrap this in your main layout file if needed */}

                {/* Render the main game interface */}
                <GameInterface />

                {/* Render the animator conditionally when game is playing */}
                {/* It will show an overlay and handle dealing automatically */}
                {gamePhase === GamePhase.Playing && <InitialDealAnimator />}

                {/* PlayerStateDebugger can be included conditionally for dev builds */}
                {/* {process.env.NODE_ENV === 'development' && <PlayerStateDebugger />} */}
            </div>
        </DndContext>
    );
}

export default App;