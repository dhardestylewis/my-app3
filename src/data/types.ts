// data/types.ts

// Card display metadata
export interface CardDisplayInfo {
    icon: string;       // Icon name for visual representation
    cost: string;       // Cost indicator (e.g., "$", "$$", "$$$")
    summary: string;    // Brief description of card
}

// Core card data structure
export interface CardData {
    id: string;                 // Unique identifier
    name: string;               // Display name
    category: string;           // Card category (Housing, Retail/Commercial, Community Facility, etc.)
    image?: string;             // Optional path to card image
    netScoreImpact: number;     // Impact on the overall project balance score
    baseSqft: number;           // Base square footage required/used by this card
    minSqft?: number;           // Optional minimum square footage required
    maxSqft?: number;           // Optional maximum square footage allowed
    requiresFloor?: number[];   // Optional specific floors where this can be placed
    isMandatory?: boolean;      // Whether this is a mandatory card (auto-applied)
    isMutuallyExclusiveWith?: string[]; // Optional IDs of cards that can't coexist with this
    cost: number;               // Financial cost to build/implement this card
    cashFlow?: number;          // Optional ongoing financial benefit/cost
    displayInfo: CardDisplayInfo; // Display metadata
}

// Building use data for a specific card placement
export interface BuildingUse {
    cardId: string;           // ID of the card
    cardName: string;         // Name of the card
    category: string;         // Category of card
    sqft: number;             // Square footage used
    units: number;            // Number of units (especially for housing)
    impact: number;           // Score impact of this placement
    owner: string;            // Which player placed this (community/developer)
}

// Data for a single floor in the building
export interface FloorData {
    sqftUsed: number;         // Total square footage used on this floor
    uses: BuildingUse[];      // List of uses on this floor
    height: number;           // Height of this floor in feet
    score: number;            // Score impact of this floor
}

// For backward compatibility
export enum BuildingUse {
    HOUSING_AFFORDABLE = 'Housing Affordable',
    HOUSING_MARKET = 'Housing Market Rate',
    RETAIL_LUXURY = 'Retail Luxury',
    RETAIL_ESSENTIAL = 'Retail Essential',
    COMMUNITY_HIGH = 'Community High Impact',
    COMMUNITY_LOW = 'Community Low Impact',
    AMENITY = 'Amenity',
}