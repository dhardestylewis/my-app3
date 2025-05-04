// src/data/types.ts
import { ReactNode } from 'react';
import { Player } from "@/stores/usePlayersStore";

/**
 * Represents a single card in the game
 */
export interface CardData {
  // Core identity
  id: string;
  name: string;
  description?: string;            
  
  // Grouping
  type?: 'Feature' | 'Bug' | 'Debt';  
  category?: string;                
  
  // Visuals
  imageUrl?: string;                
  image?: string;                  
  
  // Scoring / impact
  value?: number;                  
  netScoreImpact?: number;          
  impact?: number;                  
  
  // Financials
  cost?: number;                    
  cashFlow?: number;                
  
  // Sizing & placement
  baseSqft?: number;                
  minSqft?: number;                
  minimumSqft?: number;
  requiresFloor?: number[];        
  
  // Card-specific metadata
  displayInfo?: {
    icon: string;
    cost: string;
    summary: string;
  };
  
  // Runtime-only fields (e.g. in your floor uses)
  owner?: 'developer' | 'community';
  units?: number;
  cardName?: string;                
  
  // Side-effects
  effect?: (gameState: any) => void;
}

/**
 * Represents the current phase of negotiation, including
 * visual indicators and state flags.
 */
export interface PhaseInfo {
  text: string;               // Description of the current phase/action needed
  icon: ReactNode;            // Icon representing the phase
  color: string;              // Tailwind color class for text/UI elements
  
  // Phase state flags
  isInitialProposalPhase: boolean;  // Lead player making initial proposal
  isResponsePhase: boolean;         // Responding player considering options
  isCounterDecisionPhase: boolean;  // Lead player deciding on counter-proposal
}

/**
 * The state of a single floor during the negotiation process
 */
export interface FloorState {
  floorNumber: number;
  // Combining old and new status options for backward compatibility
  status: 'pending' | 'negotiating' | 'completed' | 'failed' | 'agreed' | 'skipped' | 'reopened';
  proposalA?: CardData;      // Lead player's proposal
  proposalB?: CardData;      // Response player's counter-proposal
  winnerCard?: CardData;     // The card that was ultimately placed on this floor
  resolvedCard?: CardData;   // Legacy field for backward compatibility (same as winnerCard)
  committedBy?: 'A' | 'B' | 'auto' | 'none' | null;  // Who finalized the decision
  units: number;             // How many units of the card were placed
  
  // Legacy fields for backward compatibility
  requiredFeatures?: number;
  allowedBugs?: number;
  technicalDebtLimit?: number;
  negotiationLog?: string[];
  isCurrent?: boolean;
}

/**
 * Building state represents the overall state of the constructed building
 */
export interface BuildingState {
  baselineScore?: number;    // Current score value
  currentScore?: number;     // Legacy field for backward compatibility
  totalFloors: number;       // Total floors in the building
  completedFloors: number;   // Number of floors with agreed cards
  failedFloors: number;      // Number of floors that were skipped
}

/**
 * Represents a log entry for debugging or display
 */
export interface DebugLog {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: string;
  message: string;
  data?: any;
}

/**
 * Game state represents the overall state of the game
 */
export interface GameState {
  phase?: 'title' | 'playing' | 'gameOver';
  gamePhase?: 'title' | 'setup' | 'negotiation' | 'resolution' | 'gameOver'; // Legacy field
  isAiTurn?: boolean;
  currentFloor: number;
  currentScore?: number;
  gameLog?: string[];
  
  // Legacy fields for backward compatibility
  players?: Player[];
  floors?: FloorState[];
  building?: BuildingState;
  currentPlayerIndex?: number;
  turnNumber?: number;
  eventDeck?: CardData[];
  discardPile?: CardData[];
  debugLog?: DebugLog[];
}
