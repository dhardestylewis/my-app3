// src/data/constants.ts
// Centralized constants for the Urban Balance game

// -----------------------------------------------------------------------------
// GAME STRUCTURE
// -----------------------------------------------------------------------------
export const MAX_STORIES = 30;               // Maximum building height in floors
export const BUILDING_FOOTPRINT = 10000;      // Square feet per floor

// -----------------------------------------------------------------------------
// DECK & HAND MANAGEMENT
// -----------------------------------------------------------------------------
export const MAX_HAND_SIZE = 5;               // Maximum cards in hand
export const INITIAL_HAND_SIZE = 3;           // Cards dealt at start

// -----------------------------------------------------------------------------
// SCORING & BALANCE
// -----------------------------------------------------------------------------
export const BALANCE_THRESHOLD = 10;          // Score threshold for "balanced" outcome

// -----------------------------------------------------------------------------
// RECALL TOKENS
// -----------------------------------------------------------------------------
export const INITIAL_RECALL_TOKENS = 2;       // Number of recall tokens per player
export const MAX_RECALL_TOKENS = 2;
export const RECALL_SCORE_PENALTY = 3;        // Score penalty for using a token
export const RECALL_MAX_FLOOR = 12;           // Tokens cannot be used after this floor

// -----------------------------------------------------------------------------
// TIMERS & DURATIONS (all in milliseconds)
// -----------------------------------------------------------------------------
export const PROPOSAL_TIMER_MS = 30_000;              // Time for each proposal/response
export const AI_TURN_DELAY_MS = 1_000;                // Delay before AI takes turn
export const COUNTER_RESPONSE_DELAY_MS = 1_500;       // Delay before AI counter
export const STARTUP_DELAY_MS = 1_000;                // Game startup delay
export const CARD_DEAL_INTERVAL_MS = 200;             // Interval between dealing cards

// -----------------------------------------------------------------------------
// UI & TELEMETRY
// -----------------------------------------------------------------------------
export const MAX_LOG_ENTRIES = 50;             // Maximum lines in the game log
export const MAX_TELEMETRY_HISTORY = 100;      // Max stored telemetry events
export const ENABLE_DEBUG_LOGGING = process.env.NODE_ENV !== 'production';
export const ENABLE_PERFORMANCE_METRICS = false;

// -----------------------------------------------------------------------------
// IMPACT TARGETS (per sq ft for balanced gameplay)
// -----------------------------------------------------------------------------
export const IMPACT_PER_SQFT = {
  HOUSING_AFFORDABLE:  -0.5,   // Community benefit but moderate
  HOUSING_MARKET:       1.0,   // Developer profit but reasonable
  RETAIL_LUXURY:        4.0,   // High profit per sqft
  RETAIL_ESSENTIAL:    -1.5,   // Community benefit
  COMMUNITY_HIGH:      -2.0,   // High community value
  COMMUNITY_LOW:       -0.5,   // Modest community value
  AMENITY:             -1.0,   // Amenities slightly negative
};

// -----------------------------------------------------------------------------
// TYPICAL SQUARE FOOTAGE (by use)
// -----------------------------------------------------------------------------
export const TYPICAL_SQFT = {
  HOUSING_UNIT:      1_000,
  RETAIL_SMALL:      2_500,
  RETAIL_MEDIUM:     5_000,
  RETAIL_LARGE:      7_500,
  COMMUNITY_SMALL:   3_000,
  COMMUNITY_MEDIUM:  5_000,
  COMMUNITY_LARGE:   7_000,
};

// -----------------------------------------------------------------------------
// CONSTRUCTION COSTS (per sq ft)
// -----------------------------------------------------------------------------
export const COST_PER_SQFT = {
  HOUSING_AFFORDABLE: 300,
  HOUSING_MARKET:     400,
  RETAIL_BASIC:       250,
  RETAIL_LUXURY:      350,
  COMMUNITY:          200,
  AMENITY:            150,
};

// -----------------------------------------------------------------------------
// CASH FLOW (per sq ft)
// -----------------------------------------------------------------------------
export const CASH_FLOW_PER_SQFT = {
  HOUSING_AFFORDABLE:   15,
  HOUSING_MARKET:       30,
  RETAIL_ESSENTIAL:     20,
  RETAIL_LUXURY:        40,
  COMMUNITY_SUBSIDIZED:  5,
  COMMUNITY_MARKET:     15,
};

// -----------------------------------------------------------------------------
// AI STRATEGY PARAMETERS
// -----------------------------------------------------------------------------
export const AI_COUNTER_THRESHOLD = 3;         // Score improvement needed to counter
export const AI_ACCEPTANCE_THRESHOLD = 0.6;    // Probability threshold to accept

// -----------------------------------------------------------------------------
// MANDATORY BASELINE IMPACTS (climate requirements)
// -----------------------------------------------------------------------------
export const MANDATORY_IMPACTS = [
  {
    id: "energy-efficient-systems",
    name: "Base Energy Efficiency",
    netScoreImpact: -8,  // Marginal cost for efficiency
  },
  {
    id: "onsite-renewable-energy",
    name: "Base Renewable Energy",
    netScoreImpact: -7,  // Marginal cost for renewables
  },
];
