// src/hooks/useMemoizedGameLogic.ts
// Corrected for usePlayersStore API changes (removed deckVersion).

import { useMemo } from 'react';
import { CardData } from '@/data/types'; // CardData is CardInstance
import { usePlayersStore } from '@/stores/usePlayersStore';
import { logDebug } from '@/utils/logger';
import { BALANCE_THRESHOLD } from '@/data/constants';

/**
 * Custom hook for memoized card analysis.
 * This prevents recalculating expensive card analysis on every render.
 */
export function useRemainingCardAnalysis() {
  const getRemainingCards = usePlayersStore(state => state.getRemainingCards);
  // deckVersion is removed from usePlayersStore as deckCardDefinitions is static.
  // Re-memoization will depend on changes to currentScore or the output of getRemainingCards if its dependencies change.
  const currentScore = usePlayersStore(state => state.currentScore); // Assuming this is the relevant score

  return useMemo(() => {
    const startTime = performance.now();
    
    const remainingCards = getRemainingCards(); // Call inside useMemo to get fresh data when dependencies change
    const analysis = analyzeRemainingCards(remainingCards);
    
    const bestPossibleFinalScore = currentScore + analysis.maxPositiveImpact;
    const worstPossibleFinalScore = currentScore + analysis.maxNegativeImpact;
    
    const isBalanceImpossible = (
      worstPossibleFinalScore > BALANCE_THRESHOLD || 
      bestPossibleFinalScore < -BALANCE_THRESHOLD
    );
    
    const endTime = performance.now();
    logDebug(`Card analysis took ${(endTime - startTime).toFixed(2)}ms (memoized)`, 'Performance');
    
    return {
      ...analysis,
      bestPossibleFinalScore,
      worstPossibleFinalScore,
      isBalanceImpossible,
      balanceRange: [worstPossibleFinalScore, bestPossibleFinalScore]
    };
  }, [getRemainingCards, currentScore]); // Dependencies: getRemainingCards function ref, currentScore
}

/**
 * Pure function to analyze remaining cards.
 * Extracted for reuse and testing.
 */
export function analyzeRemainingCards(cards: CardData[]) {
  const positiveCards = cards
    .filter(card => typeof card.netScoreImpact === 'number' && card.netScoreImpact > 0)
    .sort((a, b) => (b.netScoreImpact ?? 0) - (a.netScoreImpact ?? 0));

  const negativeCards = cards
    .filter(card => typeof card.netScoreImpact === 'number' && card.netScoreImpact < 0)
    .sort((a, b) => (a.netScoreImpact ?? 0) - (b.netScoreImpact ?? 0));

  const maxPositiveImpact = positiveCards.reduce(
    (sum, card) => sum + (card.netScoreImpact ?? 0),
    0
  );

  const maxNegativeImpact = negativeCards.reduce(
    (sum, card) => sum + (card.netScoreImpact ?? 0),
    0
  );

  const topPositiveCards = positiveCards.slice(0, 5);
  const topNegativeCards = negativeCards.slice(0, 5);

  return {
    maxPositiveImpact,
    maxNegativeImpact,
    topPositiveCards,
    topNegativeCards,
    cardCount: cards.length,
    positiveCardCount: positiveCards.length,
    negativeCardCount: negativeCards.length
  };
}