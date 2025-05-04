"use client";

// src/components/DeckSelectorPopup.tsx

import React, { useState, useEffect } from 'react';
import { usePlayersStore } from '@/stores/usePlayersStore';
import Card from './ui/card';
import { CardData } from '@/data/types';
import { logDebug } from '@/utils/logger';
import { MAX_HAND_SIZE } from '@/data/constants';
import { X } from 'lucide-react';

interface DeckSelectorPopupProps {
  onClose: () => void;
}

export default function DeckSelectorPopup({ onClose }: DeckSelectorPopupProps) {
  // Local state for selected card IDs
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Get data from store using separate selectors to avoid re-render issues
  const deck = usePlayersStore(state => state.deck);
  const moveCardsFromDeckToHand = usePlayersStore(state => state.moveCardsFromDeckToHand);
  const getHumanPlayer = usePlayersStore(state => state.getHumanPlayer);
  const deckVersion = usePlayersStore(state => state.deckVersion);

  // Get the current player hand size to enforce limits
  const humanPlayer = getHumanPlayer();
  const currentHandSize = humanPlayer?.hand.length || 0;
  const availableSlots = Math.max(0, MAX_HAND_SIZE - currentHandSize);

  // Reset selections when deck changes or popup opens
  useEffect(() => {
    setSelectedIds(new Set());
  }, [deckVersion]);

  // Handle card selection toggle
  const handleCardClick = (cardId: string) => {
    setSelectedIds(prev => {
      const newSelection = new Set(prev);
      
      if (newSelection.has(cardId)) {
        // Remove card if already selected
        newSelection.delete(cardId);
      } else if (newSelection.size < availableSlots) {
        // Add card if we haven't reached the max selectable amount
        newSelection.add(cardId);
      } else {
        logDebug(`Cannot select more than ${availableSlots} cards`, 'DeckSelector');
      }
      
      return newSelection;
    });
  };

  // Handle confirmation and adding cards to hand
  const handleConfirm = () => {
    if (selectedIds.size === 0) {
      logDebug('No cards selected to draw', 'DeckSelector');
      return;
    }

    // Convert set to array for the store method
    const selectedIdsArray = Array.from(selectedIds);
    
    logDebug(`Drawing ${selectedIds.size} cards from deck: ${selectedIdsArray.join(', ')}`, 'DeckSelector');
    
    moveCardsFromDeckToHand(selectedIdsArray);
    onClose();
  };

  // Early return if the deck is empty
  if (deck.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-card w-full max-w-2xl rounded-lg p-6 shadow-xl border border-border">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Draw from Deck</h2>
            <button 
              onClick={onClose}
              className="p-1 rounded-full hover:bg-muted transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <p className="text-center py-8">The deck is empty!</p>
          <div className="flex justify-end mt-4">
            <button 
              onClick={onClose}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:opacity-90 transition-opacity"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card w-full max-w-4xl rounded-lg p-6 shadow-xl border border-border">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Draw from Deck</h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-muted transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="mb-4">
          <p>
            Select up to {availableSlots} card{availableSlots !== 1 ? 's' : ''} to add to your hand. 
            <span className="text-primary font-medium ml-2">
              {selectedIds.size} of {availableSlots} selected
            </span>
          </p>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 max-h-[60vh] overflow-y-auto p-2">
          {deck.map((card: CardData) => (
            <div key={card.id} className="flex justify-center">
              <Card
                card={card}
                isDraggable={false}
                isSelected={selectedIds.has(card.id)}
                onCardClick={handleCardClick}
                selectableOnly={true}
              />
            </div>
          ))}
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-muted text-muted-foreground rounded-md hover:opacity-90 transition-opacity"
          >
            Cancel
          </button>
          <button 
            onClick={handleConfirm}
            disabled={selectedIds.size === 0}
            className={`px-4 py-2 rounded-md transition-opacity ${
              selectedIds.size === 0 
                ? 'bg-muted text-muted-foreground cursor-not-allowed opacity-70' 
                : 'bg-primary text-primary-foreground hover:opacity-90'
            }`}
          >
            Confirm ({selectedIds.size})
          </button>
        </div>
      </div>
    </div>
  );
}