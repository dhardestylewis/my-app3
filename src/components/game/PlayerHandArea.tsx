// src/components/game/PlayerHandArea.tsx
// Corrected for F.4 structure and new TSC errors.

'use client';

import React, { useMemo, useCallback } from 'react';
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    useSortable,
    rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { shallow } from 'zustand/shallow';
import { useStoreWithEqualityFn } from 'zustand/traditional';

import { CardInstance, Player, PhaseInfo } from '@/data/types';
import RenderCard, { RenderCardProps } from './RenderCard';
import { usePlayersStore, PlayersStoreState } from '@/stores/usePlayersStore';
import { useFloorStore } from '@/stores/useFloorStore';
import { logDebug } from '@/utils/logger';

interface PlayerHandAreaProps {
    playerHand: CardInstance[];
    currentPlayer?: Player; // Current active player
    phaseInfo: PhaseInfo;
    isAiTurn: boolean;
    onCardClick: (handCardInstanceId: string, event: React.MouseEvent) => void; 
    currentFloor: number;
}

const CATEGORY_ORDER = ['Zoning', 'Design', 'Sustainability', 'Amenities', 'Finance', 'Special', 'Event', 'Uncategorized'];

// Props for the SortableRenderCard wrapper. It takes most of RenderCardProps.
interface SortableRenderCardWrapperProps extends Omit<RenderCardProps, 'card' | 'selectedProposalInstanceIds' | 'selectedCounterProposalInstanceIds'> {
    card: CardInstance; // The specific card instance (stack) to render
    // displayCount is already part of RenderCardProps, so it's inherited if not omitted.
    // isProposal is also part of RenderCardProps.
    isVisuallyUnplayableSection?: boolean;
}

const SortableRenderCard: React.FC<SortableRenderCardWrapperProps> = ({ 
    card, 
    isVisuallyUnplayableSection,
    // isProposal, displayCount, and other RenderCardProps are passed via ...renderCardOnlyProps or explicitly
    ...renderCardOnlyProps // Contains phaseInfo, isAiTurn, onCardClick, currentFloor, displayCount, isProposal
}) => {
    const {
        attributes, listeners, setNodeRef, transform, transition, isDragging,
    } = useSortable({ id: card.instanceId, data: { isHandCard: true } }); // Added data for dnd context

    const isSelectedForProposalOrCounter = renderCardOnlyProps.displayCount && renderCardOnlyProps.displayCount > 0;

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 100 : (isSelectedForProposalOrCounter ? 10 : 1),
        opacity: isDragging ? 0.6 : (isVisuallyUnplayableSection ? 0.7 : 1),
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className={`transition-shadow duration-150 ${isDragging ? 'shadow-2xl scale-105' : 'shadow-md hover:shadow-lg'}`}>
            <RenderCard 
                card={card} 
                {...renderCardOnlyProps} // Spreads phaseInfo, isAiTurn, onCardClick, currentFloor, displayCount, isProposal
                // selectedProposalInstanceIds and selectedCounterProposalInstanceIds were removed from RenderCardProps
                // and should not be passed here. displayCount now signals selection for proposal.
            />
        </div>
    );
};

const sortAndGroupStacks = (cardStacks: CardInstance[], categoryOrder: string[]): { category: string; cards: CardInstance[] }[] => {
    const handCopy = [...cardStacks]; // Work with a copy
    handCopy.sort((a, b) => {
        const categoryA = a.category || 'Uncategorized';
        const categoryB = b.category || 'Uncategorized';
        const indexA = categoryOrder.indexOf(categoryA);
        const indexB = categoryOrder.indexOf(categoryB);
        if (indexA !== indexB) return (indexA === -1 ? Infinity : indexA) - (indexB === -1 ? Infinity : indexB);
        return (a.name || "").localeCompare(b.name || "");
    });

    const grouped: { category: string; cards: CardInstance[] }[] = [];
    if (handCopy.length > 0) {
        let currentCategoryGroup: { category: string; cards: CardInstance[] } | null = null;
        handCopy.forEach(cardStack => {
            const category = cardStack.category || 'Uncategorized';
            if (!currentCategoryGroup || currentCategoryGroup.category !== category) {
                currentCategoryGroup = { category: category, cards: [] };
                grouped.push(currentCategoryGroup);
            }
            currentCategoryGroup.cards.push(cardStack);
        });
    }
    return grouped;
};


const PlayerHandArea: React.FC<PlayerHandAreaProps> = React.memo(({
    playerHand, currentPlayer, phaseInfo, isAiTurn, onCardClick, currentFloor
}) => {
    const { reorderHandCards } = usePlayersStore.getState();
    // Corrected: Use useStoreWithEqualityFn for objects/arrays
    const proposalCounts = useStoreWithEqualityFn(usePlayersStore, (state: PlayersStoreState) => state.proposalCounts, shallow);
    const counterProposalCounts = useStoreWithEqualityFn(usePlayersStore, (state: PlayersStoreState) => state.counterProposalCounts, shallow);
    const canPlayOnFloor = useFloorStore.getState().canPlayOnFloor;

    const { playableGrouped, unplayableGrouped, allHandInstanceIds } = useMemo(() => {
        const playableCardStacks: CardInstance[] = [];
        const unplayableCardStacks: CardInstance[] = [];
        const allIds: string[] = [];

        playerHand.forEach(cardStack => {
            allIds.push(cardStack.instanceId); // instanceId is unique for each stack
            if (canPlayOnFloor(cardStack, currentFloor)) {
                playableCardStacks.push(cardStack);
            } else {
                unplayableCardStacks.push(cardStack);
            }
        });
        return {
            playableGrouped: sortAndGroupStacks(playableCardStacks, CATEGORY_ORDER),
            unplayableGrouped: sortAndGroupStacks(unplayableCardStacks, CATEGORY_ORDER),
            allHandInstanceIds: allIds 
        };
    }, [playerHand, currentFloor, canPlayOnFloor]);

    const instructionText = phaseInfo.isInitialProposalPhase ? "Click card(s) to set proposal count"
        : phaseInfo.isResponsePhase ? "Click card(s) to set counter count"
        : "View your hand";
    
    const totalInstancesInActiveBasket = useMemo(() => {
        let total = 0;
        if (phaseInfo.isInitialProposalPhase) {
            // Ensure item.count is treated as number
            Object.values(proposalCounts).forEach(item => { total += (item?.count || 0); });
        } else if (phaseInfo.isResponsePhase) {
            Object.values(counterProposalCounts).forEach(item => { total += (item?.count || 0); });
        }
        return total;
    }, [phaseInfo, proposalCounts, counterProposalCounts]);

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
    
    const handleDragEndReorder = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        if (currentPlayer && active.id !== over?.id && over?.id) {
            // Ensure reorderHandCards is called with the correct player index if this area is generic
            // For now, assuming human player's hand from context
            const humanPlayer = usePlayersStore.getState().getHumanPlayer();
            if (humanPlayer && currentPlayer.id === humanPlayer.id) {
                 const playerIndex = usePlayersStore.getState().players.findIndex(p => p.id === humanPlayer.id);
                 if(playerIndex !== -1) {
                    reorderHandCards(playerIndex, active.id as string, over.id as string);
                 }
            }
        }
    }, [reorderHandCards, currentPlayer]);

    const renderCardGroups = (groupedCardStacks: { category: string; cards: CardInstance[] }[], isUnplayableSection: boolean) => {
        return groupedCardStacks.map(({ category, cards: cardStacksInCategory }, groupIndex) => (
            <div key={`category-${category}-${groupIndex}-${isUnplayableSection}`} className="mb-4">
                <h4 className={`text-sm font-semibold px-1 ${isUnplayableSection ? 'text-slate-500' : 'text-sky-400'} uppercase tracking-wider`}>
                    {category} ({cardStacksInCategory.reduce((acc, cardStack) => acc + (cardStack.stack || 0), 0)})
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 py-2">
                    {cardStacksInCategory.map((cardStack) => {
                        let displayCountToShow = 0;
                        if (phaseInfo.isInitialProposalPhase && proposalCounts[cardStack.instanceId]) {
                            displayCountToShow = proposalCounts[cardStack.instanceId].count;
                        } else if (phaseInfo.isResponsePhase && counterProposalCounts[cardStack.instanceId]) {
                            displayCountToShow = counterProposalCounts[cardStack.instanceId].count;
                        }
                        
                        return (
                            <SortableRenderCard
                                key={cardStack.instanceId}
                                card={cardStack}
                                // Common props for RenderCard
                                isProposal={false} // Cards in hand are not "in a proposal slot"
                                phaseInfo={phaseInfo}
                                isAiTurn={isAiTurn}
                                onCardClick={onCardClick}
                                currentFloor={currentFloor}
                                displayCount={displayCountToShow}
                                // Prop specific to SortableRenderCard wrapper
                                isVisuallyUnplayableSection={isUnplayableSection}
                            />
                        );
                    })}
                </div>
            </div>
        ));
    };

    const totalCardInstancesInHand = playerHand.reduce((acc, cardStack) => acc + (cardStack.stack || 0), 0);

    return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndReorder}>
            <div className="flex flex-col h-full w-full overflow-hidden">
                <div className="flex-shrink-0 mb-2 px-1">
                    <h3 className="font-semibold text-slate-300">
                        Your Hand ({totalCardInstancesInHand} cards in {playerHand.length} stacks)
                    </h3>
                    {!isAiTurn && <p className="text-xs text-slate-400">{instructionText}.</p>}
                    {totalInstancesInActiveBasket > 0 && !isAiTurn && (
                        <p className="text-xs text-emerald-400 mt-1 font-semibold">
                            Staged for {phaseInfo.isInitialProposalPhase ? "Proposal" : "Counter"}: {totalInstancesInActiveBasket} instance(s)
                        </p>
                    )}
                </div>

                {playerHand.length === 0 ? (
                    <div className="flex-grow flex items-center justify-center"><p className="text-slate-500 italic">Your hand is empty.</p></div>
                ) : (
                    <SortableContext items={allHandInstanceIds} strategy={rectSortingStrategy}>
                        <div className="flex-grow overflow-y-auto pb-4 pr-2 -mr-2 custom-scrollbar">
                            {playableGrouped.length > 0 && renderCardGroups(playableGrouped, false)}
                            {unplayableGrouped.length > 0 && (
                                <>
                                    {playableGrouped.length > 0 && <hr className="my-4 border-slate-700" />}
                                    <div className="mb-2 px-1 opacity-80">
                                        <h3 className="font-semibold text-slate-400 text-sm">
                                            Currently Unplayable ({unplayableGrouped.reduce((sum, group) => sum + group.cards.reduce((acc, cardStack) => acc + (cardStack.stack || 0),0), 0)} cards)
                                        </h3>
                                        <p className="text-xs text-slate-500">These cards cannot be played on the current floor or under current conditions.</p>
                                    </div>
                                    {renderCardGroups(unplayableGrouped, true)}
                                </>
                            )}
                        </div>
                    </SortableContext>
                )}
            </div>
        </DndContext>
    );
});

PlayerHandArea.displayName = 'PlayerHandArea';
export default PlayerHandArea;