// src/utils/validation.ts

export interface ValidationResult {
  isValid: boolean;
  reason: string;
}

/**
 * Creates a failed validation result with the given reason
 */
export function validationFailed(reason: string): ValidationResult {
  return { isValid: false, reason };
}

/**
 * Creates a successful validation result
 */
export function validationPassed(): ValidationResult {
  return { isValid: true, reason: '' };
}

/**
 * Validates that the game is in the correct phase
 */
export function validateGamePhase(currentPhase: string, expectedPhase: string): ValidationResult {
  return currentPhase === expectedPhase 
    ? validationPassed() 
    : validationFailed(`Operation not allowed in ${currentPhase} phase`);
}

/**
 * Validates that a card ID exists in a player's hand
 */
export function validateCardInHand(hand: any[], cardId: string | null): ValidationResult {
  if (!cardId) {
    return validationFailed('No card selected');
  }
  
  const cardExists = hand.some(card => card.id === cardId);
  return cardExists 
    ? validationPassed() 
    : validationFailed(`Card ${cardId} not found in player's hand`);
}

/**
 * Validates that cards are not currently being dealt
 */
export function validateNotDealing(cardsBeingDealt: boolean): ValidationResult {
  return !cardsBeingDealt 
    ? validationPassed() 
    : validationFailed('Please wait for cards to be dealt');
}

/**
 * Validates that it's the specified player's turn
 */
export function validatePlayerTurn(
  currentPlayerId: string | undefined, 
  expectedPlayerId: string | undefined
): ValidationResult {
  return currentPlayerId === expectedPlayerId
    ? validationPassed()
    : validationFailed('Not your turn');
}

/**
 * Combines multiple validation results, stopping at the first failure
 */
export function validateAll(...validations: ValidationResult[]): ValidationResult {
  for (const validation of validations) {
    if (!validation.isValid) {
      return validation;
    }
  }
  return validationPassed();
}