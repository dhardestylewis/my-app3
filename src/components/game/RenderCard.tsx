// src/components/game/RenderCard.tsx
// F.3: Refactored for count-based selection and display.

'use client';
import React, { useMemo, useCallback } from 'react';
import { CardData, PhaseInfo, CardInstance } from '@/data/types'; // CardInstance used for card prop
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { MAX_STORIES } from '@/data/constants'; // For restriction tooltip
import CardComponent from "../ui/Card"; 
import { useFloorStore } from '@/stores/useFloorStore';
import { logDebug } from '@/utils/logger';

export interface RenderCardProps {
    card: CardInstance; // Represents a stack in hand, or a single card if played
    isProposal: boolean; 
    phaseInfo: PhaseInfo;
    // REMOVED for F.3: selectedProposalInstanceIds: string[];
    // REMOVED for F.3: selectedCounterProposalInstanceIds: string[];
    displayCount?: number; // F.3: The count to display for this card if being proposed/countered
    isAiTurn: boolean;
    onCardClick: (instanceId: string, event: React.MouseEvent) => void; 
    currentFloor: number;
}

const RenderCard: React.FC<RenderCardProps> = React.memo(({
    card,
    isProposal,
    phaseInfo,
    displayCount, // F.3: New prop
    isAiTurn,
    onCardClick,
    currentFloor
}) => {
    const canPlayCardOnThisFloorSelector = useFloorStore(state => state.canPlayOnFloor);

    if (!card || !card.instanceId) {
        logDebug("RenderCard received invalid card data", { card });
        return <div className="p-2 border border-dashed border-red-500 text-red-500 text-xs">Invalid Card Data</div>;
    }

    // F.3: Card is "selected" for highlighting if its displayCount is > 0 (and it's not a proposal display)
    const isSelected = useMemo(() => {
        if (isProposal) return false; // Cards in proposal area aren't "selected" in this context
        return !!(displayCount && displayCount > 0);
    }, [isProposal, displayCount]);

    const isAllowedOnCurrentFloor = useMemo(() => {
        if (isProposal) return true; 
        return canPlayCardOnThisFloorSelector(card, currentFloor);
    }, [isProposal, canPlayCardOnThisFloorSelector, card, currentFloor]);

    const isInteractive = !isProposal && !isAiTurn && isAllowedOnCurrentFloor &&
        (phaseInfo.isInitialProposalPhase || phaseInfo.isResponsePhase);

    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: card.instanceId, // instanceId of the hand stack
        data: { cardData: card, isHandCard: !isProposal },
        disabled: !isInteractive 
    });

    const style = useMemo(() => ({
        opacity: isDragging ? 0.75 : (isInteractive ? 1 : 0.65),
        transform: CSS.Transform.toString(transform),
        transition: isDragging ? 'none' : 'transform 0.1s ease-out, box-shadow 0.1s ease-out, opacity 0.1s ease-out',
        cursor: isInteractive ? (isDragging ? 'grabbing' : 'grab') : 'not-allowed',
        zIndex: isDragging ? 100 : (isSelected ? 10 : 1), // isSelected now based on displayCount
        position: 'relative', 
    }), [transform, isDragging, isInteractive, isSelected]);

    const handleWrapperClick = useCallback((event: React.MouseEvent) => {
        if (isInteractive) {
            onCardClick(card.instanceId, event); // instanceId of the hand stack
        } else {
            logDebug(`RenderCard wrapper click ignored (not interactive): ${card.name} (Stack ID: ${card.instanceId})`, 'RenderCard');
        }
    }, [isInteractive, onCardClick, card.instanceId, card.name]);

    const restrictionTooltip = useMemo(() => { /* ... (as before) ... */ 
        if (isProposal || isAllowedOnCurrentFloor) return undefined;
        if (!card.requiresFloor || card.requiresFloor.length === 0) return `Not playable: Unknown reason. Current floor: ${currentFloor}.`;
        
        const floorsList = card.requiresFloor.map(f => {
            if (typeof f === 'string') {
                if (f.toLowerCase() === 'ground') return 'Ground Floor (1)';
                if (f.toLowerCase() === 'roof') return `Roof (${MAX_STORIES})`;
                return f.charAt(0).toUpperCase() + f.slice(1);
            }
            return `Floor ${f}`;
        }).join(' or ');
        return `Playable only on: ${floorsList}. Current: ${currentFloor}.`;
    }, [card.requiresFloor, isAllowedOnCurrentFloor, isProposal, currentFloor]);

    const visualFloorRestricted = !isAllowedOnCurrentFloor && !isProposal;

    const cardTitle = isInteractive 
        ? `${card.name}${card.stack && card.stack > 1 && !isProposal ? ` (Stack: ${card.stack})` : ''}${displayCount && displayCount > 0 ? ` [Proposing: ${displayCount}]` : ''} - Click to cycle count` 
        : (restrictionTooltip || `${card.name}${isProposal ? '' : (card.stack && card.stack > 1 ? ` (Stack: ${card.stack})` : '')}`);


    return (
        <div
            ref={setNodeRef}
            style={style as React.CSSProperties}
            {...listeners} 
            {...attributes} 
            className={`transition-opacity duration-150 ease-in-out group ${
                isSelected && !isProposal ? 'ring-2 ring-offset-2 ring-sky-500 ring-offset-slate-800 rounded-lg shadow-xl' : ''
            }`} // isSelected now based on displayCount
            title={cardTitle}
            onClick={handleWrapperClick} 
        >
            <CardComponent 
                card={card} // Pass the CardInstance (stack)
                isSelected={isSelected && !isProposal} // Visual selection based on displayCount
                isPlayable={isInteractive} 
                isPlayed={isProposal}
                floorRestricted={visualFloorRestricted}
                displayCount={isProposal ? undefined : displayCount} // F.3: Pass displayCount to ui/Card, not for proposal displays
            />
            {/* Stack count for card in hand */}
            {!isProposal && card.stack && card.stack > 1 && (
                <span
                    className="absolute -top-1.5 -right-1.5 bg-slate-700 text-white text-[0.65rem] font-semibold px-1.5 py-0.5 rounded-full shadow-md pointer-events-none"
                    aria-label={`Stack of ${card.stack}`}
                >
                    x{card.stack}
                </span>
            )}
             {/* F.3: Display proposal count badge if not a proposal display and count > 0 - this is now responsibility of ui/Card */}
        </div>
    );
});

RenderCard.displayName = 'RenderCard';
export default RenderCard;