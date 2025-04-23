// data/deckData.ts
import { CardData } from "./types";

// ------------------------------
// BALANCE CONFIGURATION 
// ------------------------------

// Per-square-foot impact targets for balanced gameplay
const IMPACT_PER_SQFT = {
    HOUSING_AFFORDABLE: -0.5,   // Community benefit but moderate
    HOUSING_MARKET: 1.0,        // Developer profit but reasonable
    RETAIL_LUXURY: 4.0,         // High profit per sqft
    RETAIL_ESSENTIAL: -1.5,     // Community benefit
    COMMUNITY_HIGH: -2.0,       // High community value
    COMMUNITY_LOW: -0.5,        // Modest community value
    AMENITY: -1.0,              // Community amenities are slight negative
};

// Typical square footage by use
const TYPICAL_SQFT = {
    HOUSING_UNIT: 1000,         // 1000 sq ft per housing unit
    RETAIL_SMALL: 2500,         // Small retail space
    RETAIL_MEDIUM: 5000,        // Medium retail space
    RETAIL_LARGE: 7500,         // Large retail space
    COMMUNITY_SMALL: 3000,      // Small community facility
    COMMUNITY_MEDIUM: 5000,     // Medium community facility
    COMMUNITY_LARGE: 7000,      // Large community facility
};

// Cost per square foot by use (construction costs)
const COST_PER_SQFT = {
    HOUSING_AFFORDABLE: 300,    // Affordable housing costs less to build
    HOUSING_MARKET: 400,        // Market rate costs more to build
    RETAIL_BASIC: 250,          // Basic retail build-out
    RETAIL_LUXURY: 350,         // Luxury retail build-out
    COMMUNITY: 200,             // Community spaces cost less
    AMENITY: 150,               // Amenities are lower cost
};

// Cash flow per square foot (for financial viability)
const CASH_FLOW_PER_SQFT = {
    HOUSING_AFFORDABLE: 15,     // Lower but positive cash flow
    HOUSING_MARKET: 30,         // Higher cash flow
    RETAIL_ESSENTIAL: 20,       // Essential retail modest cash flow
    RETAIL_LUXURY: 40,          // Luxury retail high cash flow
    COMMUNITY_SUBSIDIZED: 5,    // Subsidized - barely breaks even
    COMMUNITY_MARKET: 15,       // Market rate community spaces
};

// ------------------------------
// CORE CARD DEFINITIONS
// ------------------------------

// Calculate the mandatory baseline impacts (climate requirements)
// These now have a marginal cost associated
export const MANDATORY_IMPACTS = [
    {
        id: "energy-efficient-systems",
        name: "Base Energy Efficiency",
        netScoreImpact: -8, // Down from -10, still significant
    },
    {
        id: "onsite-renewable-energy",
        name: "Base Renewable Energy",
        netScoreImpact: -7, // Down from -8, still significant
    },
];

// Helper function to calculate card values based on square footage
const calculateCardValues = (
    sqft: number, 
    impactPerSqft: number, 
    costPerSqft: number, 
    cashFlowPerSqft?: number
) => {
    return {
        netScoreImpact: Math.round(sqft * impactPerSqft / 1000), // Scale for better gameplay
        cost: sqft * costPerSqft,
        cashFlow: cashFlowPerSqft ? sqft * cashFlowPerSqft : undefined
    };
};

// Playable cards with BALANCED IMPACT and FINANCIAL metrics
export const deckCards: CardData[] = [
    // --- HOUSING: Now with proper density economics ---
    {
        id: "affordable-condo-unit",
        name: "Affordable Condo Unit",
        category: "Housing",
        image: "/cards/affordable-condo-1.png",
        ...calculateCardValues(
            TYPICAL_SQFT.HOUSING_UNIT, 
            IMPACT_PER_SQFT.HOUSING_AFFORDABLE,
            COST_PER_SQFT.HOUSING_AFFORDABLE,
            CASH_FLOW_PER_SQFT.HOUSING_AFFORDABLE
        ),
        baseSqft: TYPICAL_SQFT.HOUSING_UNIT,
        displayInfo: { 
            icon: "Home", 
            cost: "$$", 
            summary: "Community-focused condo (stackable)" 
        },
    },
    {
        id: "market-condo-unit",
        name: "Market Rate Condo Unit",
        category: "Housing",
        image: "/cards/market-condo-1.png",
        ...calculateCardValues(
            TYPICAL_SQFT.HOUSING_UNIT, 
            IMPACT_PER_SQFT.HOUSING_MARKET,
            COST_PER_SQFT.HOUSING_MARKET,
            CASH_FLOW_PER_SQFT.HOUSING_MARKET
        ),
        baseSqft: TYPICAL_SQFT.HOUSING_UNIT,
        displayInfo: { 
            icon: "Building", 
            cost: "$$$", 
            summary: "Profit-focused condo (stackable)" 
        },
    },
    {
        id: "affordable-rental-unit",
        name: "Affordable Rental Unit",
        category: "Housing",
        image: "/cards/affordable-rental.png",
        ...calculateCardValues(
            TYPICAL_SQFT.HOUSING_UNIT, 
            IMPACT_PER_SQFT.HOUSING_AFFORDABLE * 0.8, // Slightly more community-focused
            COST_PER_SQFT.HOUSING_AFFORDABLE * 0.9,   // Slightly cheaper
            CASH_FLOW_PER_SQFT.HOUSING_AFFORDABLE * 0.8 // Lower cash flow
        ),
        baseSqft: TYPICAL_SQFT.HOUSING_UNIT,
        displayInfo: { 
            icon: "Key", 
            cost: "$", 
            summary: "Community rental housing (stackable)" 
        },
    },
    {
        id: "luxury-condo-unit",
        name: "Luxury Condo Unit",
        category: "Housing",
        image: "/cards/luxury-condo.png",
        ...calculateCardValues(
            TYPICAL_SQFT.HOUSING_UNIT * 1.5, // Larger units
            IMPACT_PER_SQFT.HOUSING_MARKET * 1.5, // Much more profit-focused
            COST_PER_SQFT.HOUSING_MARKET * 1.5,  // More expensive
            CASH_FLOW_PER_SQFT.HOUSING_MARKET * 2 // Much higher cash flow
        ),
        baseSqft: TYPICAL_SQFT.HOUSING_UNIT * 1.5,
        displayInfo: {
            icon: "Star",
            cost: "$$$$",
            summary: "High-end luxury condos (stackable)"
        },
    },

    // --- RETAIL/COMMERCIAL: Balanced by sq ft and viability ---
    {
        id: "vendor-market",
        name: "Vendor Market",
        category: "Retail/Commercial",
        image: "/cards/vendor-market.png",
        ...calculateCardValues(
            TYPICAL_SQFT.RETAIL_MEDIUM,
            IMPACT_PER_SQFT.RETAIL_ESSENTIAL,
            COST_PER_SQFT.RETAIL_BASIC,
            CASH_FLOW_PER_SQFT.RETAIL_ESSENTIAL
        ),
        baseSqft: TYPICAL_SQFT.RETAIL_MEDIUM,
        minSqft: TYPICAL_SQFT.RETAIL_MEDIUM,
        requiresFloor: [1, 2],
        displayInfo: { 
            icon: "ShoppingBasket", 
            cost: "$", 
            summary: "Local vendors, community-focused" 
        },
    },
    {
        id: "big-box-store",
        name: "Big Box Retail",
        category: "Retail/Commercial",
        image: "/cards/big-box-store.png",
        ...calculateCardValues(
            TYPICAL_SQFT.RETAIL_LARGE,
            IMPACT_PER_SQFT.RETAIL_LUXURY,
            COST_PER_SQFT.RETAIL_BASIC,
            CASH_FLOW_PER_SQFT.RETAIL_LUXURY
        ),
        baseSqft: TYPICAL_SQFT.RETAIL_LARGE,
        minSqft: TYPICAL_SQFT.RETAIL_LARGE,
        requiresFloor: [1, 2],
        displayInfo: { 
            icon: "Store", 
            cost: "$$$", 
            summary: "Chain store, developer-focused" 
        },
    },
    {
        id: "grocery-store",
        name: "Grocery Store",
        category: "Retail/Commercial",
        image: "/cards/grocery-store.png",
        ...calculateCardValues(
            TYPICAL_SQFT.RETAIL_MEDIUM,
            IMPACT_PER_SQFT.RETAIL_ESSENTIAL,
            COST_PER_SQFT.RETAIL_BASIC,
            CASH_FLOW_PER_SQFT.RETAIL_ESSENTIAL * 1.3 // Essential but profitable
        ),
        baseSqft: TYPICAL_SQFT.RETAIL_MEDIUM,
        minSqft: TYPICAL_SQFT.RETAIL_MEDIUM,
        requiresFloor: [1, 2],
        displayInfo: { 
            icon: "ShoppingCart", 
            cost: "$$", 
            summary: "Essential retail, balanced impact" 
        },
    },
    {
        id: "restaurant",
        name: "Restaurant",
        category: "Retail/Commercial",
        image: "/cards/restaurant.png",
        ...calculateCardValues(
            TYPICAL_SQFT.RETAIL_SMALL,
            IMPACT_PER_SQFT.RETAIL_ESSENTIAL * 0.8, // Slightly more community-focused
            COST_PER_SQFT.RETAIL_BASIC * 1.1,      // Slightly more expensive
            CASH_FLOW_PER_SQFT.RETAIL_ESSENTIAL * 1.2 // Decent cash flow
        ),
        baseSqft: TYPICAL_SQFT.RETAIL_SMALL,
        requiresFloor: [1, 2],
        displayInfo: { 
            icon: "Coffee", 
            cost: "$$", 
            summary: "Public eatery, balanced impact" 
        },
    },
    {
        id: "boutique-retail",
        name: "Boutique Retail",
        category: "Retail/Commercial",
        image: "/cards/boutique-retail.png",
        ...calculateCardValues(
            TYPICAL_SQFT.RETAIL_SMALL,
            IMPACT_PER_SQFT.RETAIL_LUXURY * 0.7, // Somewhat developer-focused
            COST_PER_SQFT.RETAIL_LUXURY,
            CASH_FLOW_PER_SQFT.RETAIL_LUXURY * 0.8
        ),
        baseSqft: TYPICAL_SQFT.RETAIL_SMALL,
        requiresFloor: [1, 2],
        displayInfo: {
            icon: "ShoppingBag",
            cost: "$$$",
            summary: "Upscale shopping, developer-focused"
        },
    },
    {
        id: "bank",
        name: "Bank",
        category: "Retail/Commercial",
        image: "/cards/bank.png",
        ...calculateCardValues(
            TYPICAL_SQFT.RETAIL_SMALL,
            IMPACT_PER_SQFT.RETAIL_LUXURY * 0.5, // Somewhat developer-focused
            COST_PER_SQFT.RETAIL_BASIC,
            CASH_FLOW_PER_SQFT.RETAIL_LUXURY * 0.6
        ),
        baseSqft: TYPICAL_SQFT.RETAIL_SMALL,
        minSqft: TYPICAL_SQFT.RETAIL_SMALL,
        requiresFloor: [1, 2],
        displayInfo: { 
            icon: "CreditCard", 
            cost: "$$", 
            summary: "Financial service, balanced impact" 
        },
    },

    // --- COMMUNITY FACILITIES: More viable economics ---
    {
        id: "art-gallery",
        name: "Art Gallery",
        category: "Community Facility",
        image: "/cards/art-gallery.png",
        ...calculateCardValues(
            TYPICAL_SQFT.COMMUNITY_LARGE,
            IMPACT_PER_SQFT.COMMUNITY_HIGH,
            COST_PER_SQFT.COMMUNITY,
            CASH_FLOW_PER_SQFT.COMMUNITY_SUBSIDIZED
        ),
        baseSqft: TYPICAL_SQFT.COMMUNITY_LARGE,
        minSqft: TYPICAL_SQFT.COMMUNITY_MEDIUM,
        requiresFloor: [1, 2],
        displayInfo: { 
            icon: "Palette", 
            cost: "$$", 
            summary: "Local art space, community-focused" 
        },
    },
    {
        id: "dance-studio",
        name: "Dance Studio",
        category: "Community Facility",
        image: "/cards/dance-studio.png",
        ...calculateCardValues(
            TYPICAL_SQFT.COMMUNITY_MEDIUM,
            IMPACT_PER_SQFT.COMMUNITY_HIGH * 0.8,
            COST_PER_SQFT.COMMUNITY,
            CASH_FLOW_PER_SQFT.COMMUNITY_MARKET * 0.7
        ),
        baseSqft: TYPICAL_SQFT.COMMUNITY_MEDIUM,
        minSqft: TYPICAL_SQFT.COMMUNITY_MEDIUM,
        requiresFloor: [1, 2],
        displayInfo: { 
            icon: "MusicNote", 
            cost: "$$", 
            summary: "Community studio, balanced impact" 
        },
    },
    {
        id: "vocational-school",
        name: "Vocational School",
        category: "Community Facility",
        image: "/cards/vocational-school.png",
        ...calculateCardValues(
            TYPICAL_SQFT.COMMUNITY_LARGE,
            IMPACT_PER_SQFT.COMMUNITY_HIGH * 0.7,
            COST_PER_SQFT.COMMUNITY,
            CASH_FLOW_PER_SQFT.COMMUNITY_MARKET
        ),
        baseSqft: TYPICAL_SQFT.COMMUNITY_LARGE,
        minSqft: TYPICAL_SQFT.COMMUNITY_LARGE,
        requiresFloor: [1, 2],
        displayInfo: { 
            icon: "BookOpen", 
            cost: "$$", 
            summary: "Skills training, community-focused" 
        },
    },
    {
        id: "daycare",
        name: "Daycare",
        category: "Community Facility",
        image: "/cards/daycare.png",
        ...calculateCardValues(
            TYPICAL_SQFT.COMMUNITY_MEDIUM,
            IMPACT_PER_SQFT.COMMUNITY_HIGH * 0.7,
            COST_PER_SQFT.COMMUNITY,
            CASH_FLOW_PER_SQFT.COMMUNITY_MARKET
        ),
        baseSqft: TYPICAL_SQFT.COMMUNITY_MEDIUM,
        minSqft: TYPICAL_SQFT.COMMUNITY_MEDIUM,
        requiresFloor: [1, 2],
        displayInfo: { 
            icon: "Users", 
            cost: "$$", 
            summary: "Childcare facility, community-focused" 
        },
    },
    {
        id: "performance-space",
        name: "Small Performance Space",
        category: "Community Facility",
        image: "/cards/performance-space.png",
        ...calculateCardValues(
            TYPICAL_SQFT.COMMUNITY_LARGE,
            IMPACT_PER_SQFT.COMMUNITY_HIGH,
            COST_PER_SQFT.COMMUNITY * 1.2,
            CASH_FLOW_PER_SQFT.COMMUNITY_SUBSIDIZED
        ),
        baseSqft: TYPICAL_SQFT.COMMUNITY_LARGE,
        minSqft: TYPICAL_SQFT.COMMUNITY_LARGE,
        requiresFloor: [1, 2],
        displayInfo: { 
            icon: "Theater", 
            cost: "$$", 
            summary: "Cultural venue, community-focused" 
        },
    },

    // --- AMENITIES: Both roof and ground level ---
    {
        id: "roof-garden",
        name: "Roof Garden",
        category: "Roof Amenity",
        image: "/cards/roof-garden.png",
        ...calculateCardValues(
            TYPICAL_SQFT.RETAIL_SMALL,
            IMPACT_PER_SQFT.AMENITY,
            COST_PER_SQFT.AMENITY,
            0 // No direct cash flow
        ),
        baseSqft: TYPICAL_SQFT.RETAIL_SMALL,
        displayInfo: { 
            icon: "Sprout", 
            cost: "$", 
            summary: "Rooftop green space, community-focused" 
        },
    },
    {
        id: "green-plaza",
        name: "Green Plaza",
        category: "Ground Amenity",
        image: "/cards/green-plaza.png",
        ...calculateCardValues(
            TYPICAL_SQFT.RETAIL_SMALL,
            IMPACT_PER_SQFT.AMENITY * 1.5,
            COST_PER_SQFT.AMENITY,
            0 // No direct cash flow
        ),
        baseSqft: TYPICAL_SQFT.RETAIL_SMALL,
        displayInfo: {
            icon: "TreePine",
            cost: "$",
            summary: "Ground-level green space, community-focused"
        },
    },
    {
        id: "bike-facility",
        name: "Bike Facility",
        category: "Ground Amenity",
        image: "/cards/bike-facility.png",
        ...calculateCardValues(
            TYPICAL_SQFT.RETAIL_SMALL * 0.5, // Small footprint
            IMPACT_PER_SQFT.AMENITY,
            COST_PER_SQFT.AMENITY * 0.8, // Less expensive
            0 // No direct cash flow
        ),
        baseSqft: TYPICAL_SQFT.RETAIL_SMALL * 0.5,
        displayInfo: {
            icon: "Bike",
            cost: "$",
            summary: "Bike storage and repair, community-focused"
        },
    },
];

// ------------------------------
// HELPER FUNCTIONS
// ------------------------------

// Shuffled deck creation
export const createInitialDeck = (): CardData[] => {
    const shuffleableDeck = [...deckCards];
    
    // Fisher-Yates shuffle
    for (let i = shuffleableDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffleableDeck[i], shuffleableDeck[j]] = [shuffleableDeck[j], shuffleableDeck[i]];
    }
    
    return shuffleableDeck;
};

// Card lookup by ID
export const getCardById = (id: string): CardData | undefined => {
    return deckCards.find(card => card.id === id);
};