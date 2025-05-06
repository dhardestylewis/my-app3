// src/components/game/InitialDealAnimator.tsx
// Corrected: Removed direct call to dealCardToPlayer.
// Animation is now primarily a visual overlay during the store's dealing process.

'use client';

import React, { useEffect, useState } from 'react'; // Removed useRef as direct deal triggering is gone
import { motion, AnimatePresence } from 'framer-motion';
import { usePlayersStore } from '@/stores/usePlayersStore';
import { logDebug } from '@/utils/logger';
// import CardBack from '../ui/CardBack'; // Keep if you want to animate card backs

// const STARTING_HAND_SIZE = 5; // No longer needed here for deal count

const DealingOverlay = () => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100]"> {/* Increased z-index */}
    <motion.div
      initial={{ scale: 0.8, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.8, opacity: 0, y: 20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      className="text-white text-xl font-semibold bg-slate-700/60 p-4 px-6 rounded-lg shadow-xl backdrop-blur-sm"
    >
      Dealing Cards...
    </motion.div>
  </div>
);

export function InitialDealAnimator() {
  // cardsBeingDealt is true while usePlayersStore.dealInitialCards() is running (including its internal delays)
  const cardsBeingDealt = usePlayersStore(s => s.cardsBeingDealt);
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    if (cardsBeingDealt) {
      logDebug('[InitialDealAnimator] cardsBeingDealt is true. Showing overlay.', 'Animation');
      setShowOverlay(true);
    } else {
      // When cardsBeingDealt becomes false, the store's dealInitialCards has completed.
      // We can hide the overlay after a short delay to let animations finish if any were added.
      logDebug('[InitialDealAnimator] cardsBeingDealt is false. Hiding overlay.', 'Animation');
      // Optionally add a small delay here before setShowOverlay(false) if needed for visual effect
      setShowOverlay(false); 
    }
  }, [cardsBeingDealt]);

  // The actual dealing logic (adding cards to hand with delays) is now fully encapsulated
  // within usePlayersStore.dealInitialCards(). This component just shows an overlay.
  // If card-by-card visual animation is desired (e.g., cards flying to hand areas),
  // this component would need to be much more complex, possibly by observing
  // player hand changes and animating based on diffs, or `dealInitialCards` would need
  // to emit events for each card dealt.

  return (
    <AnimatePresence>
      {showOverlay && <DealingOverlay />}
    </AnimatePresence>
  );
}