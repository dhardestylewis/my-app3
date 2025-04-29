// src/types/gameTypes.ts

export interface CardData {
  id: string;
  name: string;
  netScoreImpact: number;
}

export type PlayerRole = string;
export type PlayerType = 'human' | 'AI';

/**
 * Defines all possible game actions that can be dispatched
 */
export type GameAction = 
  | { type: 'START_GAME'; humanRole: string }
  | { type: 'RESET_GAME' }
  | { type: 'PROPOSE_CARD'; cardId: string; playerId: string }
  | { type: 'COUNTER_PROPOSE'; cardId: string; playerId: string }
  | { type: 'ACCEPT_PROPOSAL'; playerId: string }
  | { type: 'PASS_PROPOSAL'; playerId: string }
  | { type: 'USE_RECALL'; floorNumber: number; playerId: string }
  | { type: 'DRAW_CARD'; playerId: string };

/**
 * Defines events emitted by the game engine in response to actions
 */
export type GameEvent =
  | { type: 'GAME_STARTED'; humanRole: string; aiRole: string }
  | { type: 'CARDS_DEALT' }
  | { type: 'PROPOSAL_MADE'; cardId: string; playerId: string; floor: number; cardName: string }
  | { type: 'COUNTER_MADE'; cardId: string; playerId: string; floor: number; cardName: string }
  | { type: 'PROPOSAL_ACCEPTED'; cardId: string; floor: number; acceptedBy: string; cardName: string }
  | { type: 'PROPOSAL_PASSED'; floor: number; passedBy: string }
  | { type: 'FLOOR_FINALIZED'; floor: number; card?: CardData; committedBy: string }
  | { type: 'NEXT_TURN'; playerId: string; isAI: boolean }
  | { type: 'CARD_DRAWN'; cardId: string; playerId: string; cardName: string }
  | { type: 'RECALL_USED'; floor: number; playerId: string; previousCard?: CardData }
  | { type: 'GAME_OVER'; reason: string; winner: 'developer' | 'community' | 'balanced'; finalScore: number }
  | { type: 'ERROR'; message: string; code?: string };

/**
 * Core game state without UI concerns
 */
export interface GameState {
  players: Player[];
  floors: Floor[];
  currentFloor: number;
  currentPlayerIndex: number;
  currentScore: number;
  deck: CardData[];
  gamePhase: 'title' | 'playing' | 'gameOver';
}

/**
 * Player data structure
 */
export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  type: PlayerType;
  hand: CardData[];
  recallTokens: number;
  isLeadPlayer: boolean;
}

/**
 * Floor data structure
 */
export interface Floor {
  floorNumber: number;
  status: 'pending' | 'agreed' | 'skipped';
  proposalA?: CardData;
  proposalB?: CardData;
  winnerCard?: CardData;
  committedBy?: string;
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  reason: string;
}

/**
 * Game engine result from handling an action
 */
export interface GameActionResult {
  newState: GameState;
  events: GameEvent[];
}

/**
 * Card analysis result
 */
export interface CardAnalysisResult {
  maxPositiveImpact: number;
  maxNegativeImpact: number;
  topPositiveCards: CardData[];
  topNegativeCards: CardData[];
  bestPossibleFinalScore: number;
  worstPossibleFinalScore: number;
  isBalanceImpossible: boolean;
}