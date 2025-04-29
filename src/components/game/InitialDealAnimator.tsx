'use client';

// src/components/game/InitialDealAnimator.tsx

import React, { useEffect, useRef } from 'react';
import { usePlayersStore } from '@/stores/usePlayersStore';
import { logDebug } from '@/utils/logger';

const STARTING_HAND_SIZE = 5;

const DealingOverlay = () => (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
    <div className="text-white text-xl font-semibold animate-pulse">Dealing Cards...</div>
  </div>
);

export function InitialDealAnimator() {
  const cardsBeingDealt = usePlayersStore(s => s.cardsBeingDealt);
  const playersLength  = usePlayersStore(s => s.players.length);

  // Keep latest primitives in refs for async access
  const dealingFlagRef   = useRef(cardsBeingDealt);
  const playersLenRef    = useRef(playersLength);
  useEffect(() => { dealingFlagRef.current = cardsBeingDealt; }, [cardsBeingDealt]);
  useEffect(() => { playersLenRef.current  = playersLength;  }, [playersLength]);

  const timeoutRef  = useRef<NodeJS.Timeout | null>(null);
  const runningRef  = useRef(false);

  useEffect(() => {
    const clear = () => {
      runningRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    if (cardsBeingDealt && playersLength > 0 && !runningRef.current) {
      logDebug('[InitialDealAnimator] begin', 'Animation');
      runningRef.current = true;

      let dealtTotal   = 0;
      const totalToDeal = STARTING_HAND_SIZE * playersLenRef.current;
      let playerIndex  = 0;

      const tick = () => {
        if (!dealingFlagRef.current) { clear(); return; }
        if (dealtTotal >= totalToDeal) {
          usePlayersStore.getState().completeInitialDeal();
          clear();
          return;
        }

        // Perform the deal without holding onto snapshot objects
        usePlayersStore.getState().dealCardToPlayer(playerIndex);
        logDebug(`[InitialDealAnimator] dealt to player ${playerIndex}`, 'Animation');

        dealtTotal++;
        playerIndex = (playerIndex + 1) % playersLenRef.current;
        timeoutRef.current = setTimeout(tick, 150);
      };

      tick();
    } else if (!cardsBeingDealt && runningRef.current) {
      clear();
    }

    return clear;
  }, [cardsBeingDealt, playersLength]);

  return cardsBeingDealt ? <DealingOverlay /> : null;
}
