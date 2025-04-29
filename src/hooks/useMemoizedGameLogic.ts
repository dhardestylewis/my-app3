// src/hooks/useMemoizedGameLogic.ts
import { useMemo } from 'react';
import { CardData } from '@/data/types';
import { usePlayersStore } from '@/stores/usePlayersStore';
import { logDebug } from '@/utils/logger';
import { BALANCE_THRESHOLD } from '@/data/constants';

/**
 * Custom hook for memoized card analysis
 * This prevents recalculating expensive card analysis on every render
 */
export function useRemainingCardAnalysis() {
  // We need to add a version/hash to the player store to track when the deck changes
  const getRemainingCards = usePlayersStore(state => state.getRemainingCards);
  const deckVersion = usePlayersStore(state => state.deckVersion); // New field to add
  const currentScore = usePlayersStore(state => state.currentScore); // New field to derive from building store
  
  // Memoize the expensive calculation based on deck version
  return useMemo(() => {
    // Performance measurement in dev
    const startTime = performance.now();
    
    const remainingCards = getRemainingCards();
    const analysis = analyzeRemainingCards(remainingCards);
    
    // Calculate if balance is impossible based on the analysis
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
  }, [getRemainingCards, deckVersion, currentScore]);
}

/**
 * Pure function to analyze remaining cards
 * Extracted for reuse and testing
 */
export function analyzeRemainingCards(cards: CardData[]) {
  // Group cards by positive/negative impact
  const positiveCards = cards
    .filter(card => typeof card.netScoreImpact === 'number' && card.netScoreImpact > 0)
    .sort((a, b) => (b.netScoreImpact ?? 0) - (a.netScoreImpact ?? 0)); // Sort descending

  const negativeCards = cards
    .filter(card => typeof card.netScoreImpact === 'number' && card.netScoreImpact < 0)
    .sort((a, b) => (a.netScoreImpact ?? 0) - (b.netScoreImpact ?? 0)); // Sort ascending (most negative first)

  // Calculate total possible impacts
  const maxPositiveImpact = positiveCards.reduce(
    (sum, card) => sum + (card.netScoreImpact ?? 0),
    0
  );

  const maxNegativeImpact = negativeCards.reduce(
    (sum, card) => sum + (card.netScoreImpact ?? 0),
    0
  );

  // Get the most powerful cards in each direction
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

