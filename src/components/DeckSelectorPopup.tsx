// src/components/DeckSelectorPopup.tsx
// F.4: Added visual cues for card definitions not immediately playable on the current floor.

'use client';
import React, { FC, useCallback } from 'react';
import { usePlayersStore, Player } from '@/stores/usePlayersStore';
import { useFloorStore } from '@/stores/useFloorStore'; // F.4: Import useFloorStore
import CardComponent from './ui/Card'; 
import { CardDefinition, CardData } from '@/data/types'; // CardData might be used for casting
import { logDebug, logError } from '@/utils/logger';
import { X, PackagePlus, Layers, Info } from 'lucide-react';

interface DeckSelectorPopupProps {
  onClose: () => void;
}

const DeckSelectorPopup: FC<DeckSelectorPopupProps> = ({ onClose }) => {
  const deckCardDefinitions = usePlayersStore(state => state.deckCardDefinitions);
  const drawCardInstanceToHandById = usePlayersStore(state => state.drawCardInstanceToHandById);
  const humanPlayer = usePlayersStore(state => state.getHumanPlayer());

  // F.4: Get current floor context for playability check
  const currentFloor = useFloorStore(state => state.currentFloor);
  const canPlayOnFloorSelector = useFloorStore.getState().canPlayOnFloor; // Get the function directly

  const handleCardDefinitionClick = useCallback((definitionId: string, event?: React.MouseEvent) => {
    if (!humanPlayer) {
      logError("DeckSelectorPopup: Cannot draw card, human player not found.", undefined);
      return;
    }
    // Determine playerIndex for the human player
    const players = usePlayersStore.getState().players;
    const humanPlayerIndex = players.findIndex(p => p.id === humanPlayer.id);
    if (humanPlayerIndex === -1) {
      logError("DeckSelectorPopup: Human player index not found.", undefined);
      return;
    }

    const definition = deckCardDefinitions.find(def => def.id === definitionId);
    if (!definition) {
        logError(`DeckSelectorPopup: Clicked card definition ID '${definitionId}' not found.`, undefined);
        return;
    }

    const drawCount = event?.shiftKey ? 5 : 1;
    logDebug(`${event?.shiftKey ? "Shift+Click" : "Click"} on '${definition.name}' (ID: ${definitionId}): Attempting to draw ${drawCount} instance(s).`, 'DeckSelector');

    for (let i = 0; i < drawCount; i++) {
      const drawnInstance = drawCardInstanceToHandById(humanPlayerIndex, definitionId);
      if (!drawnInstance) {
        logDebug(`DeckSelectorPopup: Failed to draw instance ${i+1} of ${definition.name}.`, 'DeckSelector');
        break; 
      }
    }
    if (event?.shiftKey && drawCount > 0) {
        onClose();
    }
  }, [humanPlayer, deckCardDefinitions, drawCardInstanceToHandById, onClose]);


  if (deckCardDefinitions.length === 0) {
    // ... (empty state as before)
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-card max-w-lg w-full rounded-lg p-6 shadow-xl border">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold flex items-center"><PackagePlus className="mr-2 h-6 w-6 text-primary" /> Draw New Card Instances</h2>
            <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-muted rounded-full"><X size={20} /></button>
          </div>
          <p className="text-center py-8 text-muted-foreground">No card definitions available in the deck!</p>
          <div className="flex justify-end">
            <button onClick={onClose} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:opacity-90">Close</button>
          </div>
        </div>
      </div>
    );
  }

  const helpText = "Click a card to draw one instance. Shift+Click for five. Dimmed cards may not be playable on the current floor.";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-4xl rounded-lg shadow-xl border p-6 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold flex items-center"><PackagePlus className="mr-2 h-6 w-6 text-primary" /> Draw New Card Instances ({deckCardDefinitions.length} types available)</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-muted rounded-full"><X size={20} /></button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {helpText}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 overflow-y-auto flex-grow p-1 custom-scrollbar">
          {deckCardDefinitions.map((definition: CardDefinition) => {
            // F.4: Check if this definition is playable on the current negotiation floor
            const isPlayableOnCurrentFloor = canPlayOnFloorSelector(definition, currentFloor);
            
            return (
              <div key={definition.id} className="flex justify-center items-center" 
                   title={!isPlayableOnCurrentFloor ? `${definition.name} - May not be playable on current floor ${currentFloor}.` : definition.name}>
                <div 
                  onClick={(e) => handleCardDefinitionClick(definition.id, e)} 
                  className="cursor-pointer transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardDefinitionClick(definition.id, undefined);}}
                  aria-label={`Draw ${definition.name}${!isPlayableOnCurrentFloor ? ' (may not be playable on current floor)' : ''}`}
                >
                  <CardComponent
                    card={definition as CardData} // Cast for prop compatibility
                    isSelected={false} 
                    // F.4: Use isPlayableOnCurrentFloor for visual hint (dimming)
                    isPlayable={isPlayableOnCurrentFloor} 
                    floorRestricted={!isPlayableOnCurrentFloor && !!definition.requiresFloor?.length} // Indicate if restriction is floor-based
                    isPlayed={false}
                    // displayCount is not relevant for deck definitions
                  />
                  {!isPlayableOnCurrentFloor && (
                    <div className="absolute top-1 left-1 p-0.5 bg-amber-500/80 rounded-full text-white" title="Not playable on current floor">
                        <Info size={12} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
          <button onClick={onClose} className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 flex items-center">
            <Layers className="mr-2 h-5 w-5" /> Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeckSelectorPopup;