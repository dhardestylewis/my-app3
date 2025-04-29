'use client';

import React from 'react';
import { CardData, PhaseInfo } from '@/data/types';
import Card from "@/components/ui/card"; // Import your Card UI component
import { useDraggable } from '@dnd-kit/core'; // Import for drag capabilities

// Define the props interface for the RenderCard component
interface RenderCardProps {
  card: CardData;
  isProposal: boolean; // Is this card being displayed as a proposal?
  phaseInfo: PhaseInfo; // Current negotiation phase details
  selectedHandCardId?: string; // ID of the card selected from hand (for initial proposal)
  selectedCounterCardId?: string; // ID of the card selected from hand (for counter proposal)
  isAiTurn: boolean; // Is it currently the AI's turn?
  onCardClick: (cardId: string) => void; // Callback function when an interactive card is clicked
}

/**
 * RenderCard component handles the display and interaction logic for a single card
 * in the NegotiationPanel. This includes selection state, drag-and-drop, and visual styling.
 */
const RenderCard: React.FC<RenderCardProps> = React.memo(({
  card,
  isProposal,
  phaseInfo,
  selectedHandCardId,
  selectedCounterCardId,
  isAiTurn,
  onCardClick
}) => {
  // Determine if this card is currently selected
  const isSelected = phaseInfo.isInitialProposalPhase
    ? selectedHandCardId === card.id
    : phaseInfo.isResponsePhase
      ? selectedCounterCardId === card.id
      : false;

  // Determine if the card should be interactive (clickable/draggable)
  // Only hand cards (not proposals) during the player's turn in the correct phase are interactive
  const isInteractive = !isProposal && !isAiTurn &&
    (phaseInfo.isInitialProposalPhase || phaseInfo.isResponsePhase);

  // Set up draggable functionality
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.id,
    data: { card },
    disabled: !isInteractive // Only allow dragging if the card is interactive
  });

  // Format the impact score for display
  const impactValue = card.netScoreImpact ?? 0;
  const formattedImpact = impactValue > 0
    ? `+${impactValue}`
    : impactValue.toString();

  // Handle the click event, only calling the passed handler if interactive
  const handleClick = () => {
    if (isInteractive) {
      onCardClick(card.id);
    }
  };

  // Determine card style based on state
  const cardStyle = {
    transform: isDragging ? 'scale(1.05)' : 'scale(1)',
    opacity: isDragging ? 0.8 : 1,
    cursor: isInteractive ? 'pointer' : 'default'
  };

  return (
    <div 
      ref={setNodeRef}
      {...(isInteractive ? { ...attributes, ...listeners } : {})}
      className={`flex-shrink-0 transition-all duration-150 ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
      style={cardStyle}
      onClick={handleClick}
    >
      <Card
        card={card}
        isSelected={isSelected}
        isPlayable={isInteractive} // Visually indicate if playable
        isDraggable={isInteractive}
      />
      
      {/* Optional debug info for development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="text-xs text-slate-500 mt-1 text-center">
          ID: {card.id.substring(0, 6)}... | Impact: {formattedImpact}
        </div>
      )}
    </div>
  );
});

// Set display name for better debugging
RenderCard.displayName = 'RenderCard';

export default RenderCard;