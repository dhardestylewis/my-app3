// src/data/types.ts
// Refactored: Defines types, retains deprecated fields, applies fixes,
// defines canonical LogLevel, and re-exports logger functions.
// Cluster A: Added stack?: number to CardInstance.

import type { ReactNode } from 'react';

// --- Logger Types (Canonical Definition) ---

/**
 * Defines the severity levels for logging.
 * This is the single source of truth for the LogLevel enum.
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARNING = 2,
    ERROR = 3,
}

/**
 * Structure for log entries stored or processed by the logger system.
 * Used internally by the logger and potentially by the logger store.
 */
export interface LogEntry {
    id: string;       // Unique ID for the log entry
    timestamp: number;   // Milliseconds since epoch
    level: LogLevel;     // Severity level (numeric enum)
    message: string;     // The main log message
    category?: string;   // Optional category (e.g., 'Engine', 'UI', 'AI')
    data?: any;          // Optional structured data payload
    error?: {            // Optional serialized error info
        name: string;
        message: string;
        stack?: string;
    };
}

/**
 * @deprecated Use LogEntry and the logger store system instead. Kept for backward
 * compatibility if GameState.debugLog is still used somewhere temporarily.
 */
export interface DebugLog {
    id: string;
    timestamp: number;
    level: 'info' | 'warn' | 'error' | 'debug'; // Original literal types
    category: string;
    message: string;
    data?: any;
}


// --- Card Types --- (Retaining deprecated fields)

/**
 * Base definition of a card before instantiation.
 */
export interface CardDefinition {
    id: string; // Unique identifier for the card type (e.g., "feature-login")
    name: string;
    description?: string;
    type?: 'Feature' | 'Bug' | 'Debt'; // Or other relevant card types
    category?: string; // e.g., "Frontend", "Backend", "UX"
    imageUrl?: string; // Preferred field for web image paths
    /** @deprecated Use imageUrl instead. */
    image?: string;
    netScoreImpact?: number; // Primary field for score changes used by engine mediation/scoring
    /** @deprecated Use netScoreImpact instead. */
    value?: number;
    /** @deprecated Use netScoreImpact or specific logic if needed. */
    impact?: number;
    cost?: number;         // Cost to play (if applicable, e.g., resource cost)
    cashFlow?: number;       // Recurring effect (if applicable)
    units?: number;          // Default "size" or contribution of the card, potentially overridden by instance.
    /** @deprecated Use `units` field instead. */
    baseSqft?: number;
    /** @deprecated Use `units` field instead. */
    minSqft?: number;
    /** @deprecated Use `units` field instead. */
    minimumSqft?: number;

    // --- Display & Effects ---
    displayInfo?: {          // Optional grouped info for UI
        icon?: string;       // Icon identifier (string for compatibility, consider component later)
        cost?: string;       // Formatted cost string
        summary?: string;    // Short effect summary
    };
    // Card effect function - takes current state, should ideally return state changes or events
    effect?: (gameState: Readonly<GameState>) => Partial<GameState> | GameEvent[] | void; // Example signature

    // --- Deck Building & Placement ---
    quantity?: number;        // How many copies of this card definition exist (for deck building)
    requiresFloor?: (number | string)[]; // Floor restrictions (e.g., [1], ['roof'], ['odd'])
}

/**
 * Represents a specific instance of a card within the game context
 * (e.g., in a player's hand, proposed on a floor).
 * Extends the base definition with runtime data.
 */
export interface CardInstance extends CardDefinition {
    instanceId: string; // Unique ID for THIS specific instance of the card
    ownerId?: string;    // ID of the player who currently owns/controls this instance (e.g., in hand)
    /** @deprecated Use 'name' from base CardDefinition. */
    cardName?: string;
    // Bucket 7 & 8 Fix: Ensure 'units' is available on CardInstance (inherits from CardDefinition, can be overridden)
    units?: number;
    // Cluster A: Added stack count for cards in hand.
    // If 'stack' is present and > 1, this CardInstance represents a stack in a player's hand.
    // If 'stack' is undefined or 1, it's a single card (e.g., in deck, in play, or a single in hand).
    stack?: number;
}

// Alias CardData -> CardInstance for backward compatibility
export type CardData = CardInstance;

// --- Game State Enums --- (Retaining deprecated values)

/**
 * Status of a given floor in the building/negotiation process.
 */
export enum FloorStatus {
    Pending = 'pending',       // Not yet negotiated
    /** @deprecated Check if still used; logic might rely on GamePhase.Negotiation or turn state. */
    Negotiating = 'negotiating',
    Agreed = 'agreed',         // A card was successfully agreed upon for this floor
    Skipped = 'skipped',       // Players agreed to skip building this floor
    /** @deprecated Define clear failure conditions and logic if this status is needed. */
    Failed = 'failed',
    /** @deprecated Use Agreed or Skipped. */
    Completed = 'completed',
    Reopened = 'reopened',     // Floor was 'Agreed' but recalled using a token
}

/**
 * Identifies which player's proposal won the floor, or if it was mediated/skipped.
 */
export enum Committer {
    PlayerA = 'A',       // Player A's proposal was chosen (index 0)
    PlayerB = 'B',       // Player B's proposal was chosen (index 1)
    Auto = 'auto',     // Result of mediation (engine decided)
    None = 'none',     // Floor was skipped or has no winner yet
}

/**
 * High-level phases controlling game flow and UI views.
 */
export enum GamePhase {
    Title = 'title',         // Title screen or main menu
    Playing = 'playing',       // Core turn-by-turn play
    Negotiation = 'negotiation', // Bucket 4 Fix: Added Negotiation phase
    GameOver = 'gameOver',   // Game has ended, showing results
}

/**
 * Player roles, determining objectives or perspectives.
 */
export enum PlayerRole {
    Community = 'community',
    Developer = 'developer',
}

/**
 * Type of player entity.
 */
export enum PlayerType {
    Human = 'human',
    AI = 'ai',
}


// --- Core State Interfaces --- (Retaining deprecated fields)

/**
 * State of a single floor in the building.
 */
export interface FloorState {
    floorNumber: number;
    status: FloorStatus;
    // Proposals can hold multiple cards, though current engine logic might only use one.
    proposalA?: CardInstance[];
    proposalB?: CardInstance[];
    winnerCard?: CardInstance;     // The card agreed upon for this floor (undefined if Pending/Skipped/Reopened)
    committedBy: Committer | null; // Who committed the winnerCard or 'None'/'Auto'
    // Represents the 'size' or contribution of the floor, derived from winnerCard or default.
    units?: number;
    /** @deprecated Use winnerCard instead. */
    resolvedCard?: CardData;
    /** @deprecated Logic likely belongs on CardDefinition or derived dynamically. */
    requiredFeatures?: number;
    /** @deprecated Logic likely belongs on CardDefinition or derived dynamically. */
    allowedBugs?: number;
    /** @deprecated Logic likely belongs on CardDefinition or derived dynamically. */
    technicalDebtLimit?: number;
    /** @deprecated Logging handled externally via logger store. */
    negotiationLog?: string[];
    /** @deprecated Derive from GameState.currentFloor === floorNumber. */
    isCurrent?: boolean;
}

/**
 * Representation of a player in the game.
 */
export interface Player {
    id: string;       // Unique player identifier ('human', 'ai', or more specific IDs)
    name: string;       // Display name (e.g., "You (Developer)", "AI (Community)")
    type: PlayerType;
    role: PlayerRole;
    // Player's hand - Actual source of truth likely in PlayerStore.
    // With Cluster A, CardInstance objects in this array may have a `stack` property.
    hand: CardInstance[];
    recallTokens: number;
    // Bucket 7 Fix: Added back isLeadPlayer. Engine needs to set this appropriately.
    // Note: This can be complex to keep accurate if lead status changes frequently.
    isLeadPlayer: boolean;
}

/**
 * Overall game state managed primarily by the GameEngine.
 */
export interface GameState {
    phase: GamePhase;         // Current high-level game phase
    currentFloor: number;     // The floor currently being negotiated (or 0 before start, > MAX_STORIES if finished)
    currentPlayerIndex: number;// Index (0 or 1) of the player whose turn it is (-1 if no turn active)
    isAiTurn: boolean;         // Convenience flag, true if currentPlayerIndex points to an AI player

    // Core game entities - Initialized during START_GAME
    // Use optional types + undefined initial state, requiring guards/assertions after game starts.
    players: Player[] | undefined;
    floors: FloorState[] | undefined;

    // Game log for simple, sequential events shown to user (optional)
    gameLog: string[];

    // --- Potentially External or Derived State ---
    /** @deprecated Calculate building summary in stores/selectors based on floors state. */
    building?: BuildingState; // Keep BuildingState type below for this
    /** @deprecated Deck state (remaining cards) typically managed externally (e.g., DeckStore/PlayerStore). */
    deck?: CardInstance[]; // Or CardDefinition[] if just tracking remaining definitions
    /** @deprecated Discard pile state typically managed externally. */
    discardPile?: CardInstance[];

    // ---- Legacy / Removed ----
    /** @deprecated Use the 'phase: GamePhase' field instead. */
    gamePhase?: 'title' | 'setup' | 'negotiation' | 'resolution' | 'gameOver';
    // Bucket 2A Fix: Removed duplicate optional currentScore
    /** @deprecated Score should be calculated dynamically from finalized floors state. */
    currentScore?: number;
    /** @deprecated Turn number can be derived or managed by a turn-tracking system if needed explicitly. */
    turnNumber?: number;
    /** @deprecated Implement specific event card logic if required, separate from main deck. */
    eventDeck?: CardData[];
    /** @deprecated Use the logger store system (e.g., useLoggerStore). Kept for temporary compatibility. */
    debugLog?: DebugLog[];
    /** @deprecated Use the logger store system. Kept for temporary compatibility. */
    negotiationLog?: string[];
}


// --- Engine Interaction Types ---

/**
 * Result returned by GameEngine.handleAction.
 */
export interface GameActionResult {
    newState: GameState; // The state *after* the action (or before, if action failed)
    events: GameEvent[];   // List of events generated by the action
}

/**
 * Describes the outcome of a validation check.
 */
export interface ValidationResult {
    isValid: boolean;
    reason: string; // Explanation if isValid is false
}

// --- UI / Derived State Helper Types (Consider moving closer to UI/Stores) ---

/**
 * Represents calculated information about the current negotiation phase, potentially for UI display.
 */
export interface PhaseInfo {
    text: string;
    // Bucket 6 Fix: Changed icon type to ReactNode | undefined
    icon?: ReactNode;
    color: string;
    // Flags indicating sub-phases of negotiation
    isInitialProposalPhase: boolean;
    isResponsePhase: boolean;
    isCounterDecisionPhase: boolean;
}

/**
 * Represents calculated summary data about the building state.
 * @deprecated Calculate this data in stores/selectors based on GameState.floors instead of storing it.
 */
export interface BuildingState {
    totalFloors: number;       // Likely MAX_STORIES constant
    agreedFloors: number;      // Count floors with status Agreed
    skippedFloors: number;     // Count floors with status Skipped
    pendingFloors: number;     // Count floors with status Pending/Reopened
    currentScore: number;      // Canonical required field - Dynamically calculated score from agreed floors
    /** @deprecated Define baseline score logic if needed. */
    baselineScore?: number;
    /** @deprecated Count based on FloorStatus.Failed if used. */
    failedFloors?: number;
    // Removed duplicate optional currentScore from original type definition
}


// --- Game Events (Updated per Bucket 5 & 7) ---
// NOTE: This breaks compatibility for consumers expecting old shapes.
export type GameEvent =
    | { type: 'GAME_STARTED'; humanRole: PlayerRole; aiRole: PlayerRole; playerAId: string; playerBId: string; }
    | { type: 'TURN_STARTED'; playerId: string; floor: number; isAiTurn: boolean; }
    // NEXT_TURN removed based on Bucket 5
    | { type: 'PROPOSAL_MADE'; playerId: string; cardInstanceId: string; cardId: string; floor: number; cardName?: string; }
    | { type: 'COUNTER_MADE'; playerId: string; cardInstanceId: string; cardId: string; floor: number; cardName?: string; }
    | { type: 'PROPOSAL_ACCEPTED'; acceptedBy: string; committedBy: Committer; cardInstanceId: string; cardId: string; floor: number; cardName?: string; }
    | { type: 'PROPOSAL_PASSED'; passedBy: string; floor: number; }
    | { type: 'FLOOR_FINALIZED'; floor: number; status: FloorStatus; card?: CardInstance; committedBy: Committer | null; }
    | { type: 'DRAW_REQUESTED'; playerId: string; }
    | { type: 'CARD_DRAWN'; playerId: string; card: CardInstance; } // Uses full CardInstance
    | { type: 'RECALL_USED'; floor: number; playerId: string; recalledCard?: CardInstance; committedBy?: Committer | null; }
    | { type: 'SCORE_ADJUSTED'; amount: number; reason: string; }
    | { type: 'GAME_RESET'; }
    | { type: 'GAME_OVER'; winner: 'developer' | 'community' | 'balanced'; reason: string; finalScore: number; }
    | { type: 'ERROR'; message: string; code: string; data?: any };


// --- Re-exports for Backwards Compatibility ---
// Re-export logger functions from their actual location.
export {
    logError,
    logInfo,
    logWarn,
    logDebug,
    logGameEventDetails
} from '../utils/logger'; // Adjust path if necessary

// NOTE: Do NOT re-export useLoggerStore or LogEntry from here.
// LogLevel is defined above. useLoggerStore/LogEntry are exported from utils/logger.ts