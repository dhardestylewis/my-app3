// data/deckData.ts
import { CardData } from "../data/types"; // Assuming CardData type can handle BOTH old and new structures or is flexible

// --- IMAGE HANDLING CONFIGURATION (Kept for backward compatibility) ---
/**
 * Default image path used when a card's specified image is missing or invalid.
 * Ensure this image exists in your `/public` directory.
 */
export const DEFAULT_CARD_IMAGE_PATH = "/cards/default-card.png";


// --------------------------------------------------------------------------
// --- ORIGINAL BALANCE CONFIGURATION & CALCULATION (Kept for Backward Compatibility) ---
// @deprecated These constants and the calculation function are used by the original
//             deckCards definition. They will be removed once all consuming code
//             is updated to use `refactoredDeckCards`.
// --------------------------------------------------------------------------

// Per-square-foot impact targets for balanced gameplay
export const IMPACT_PER_SQFT = { // Keep export for compatibility
    HOUSING_AFFORDABLE: -0.5,
    HOUSING_MARKET: 1.0,
    RETAIL_LUXURY: 4.0,
    RETAIL_ESSENTIAL: -1.5,
    COMMUNITY_HIGH: -2.0,
    COMMUNITY_LOW: -0.5,
    AMENITY: -1.0,
};

// Typical square footage by use
export const TYPICAL_SQFT = { // Keep export for compatibility
    HOUSING_UNIT: 1000,
    RETAIL_SMALL: 2500,
    RETAIL_MEDIUM: 5000,
    RETAIL_LARGE: 7500,
    COMMUNITY_SMALL: 3000,
    COMMUNITY_MEDIUM: 5000,
    COMMUNITY_LARGE: 7000,
};

// Cost per square foot by use (construction costs)
export const COST_PER_SQFT = { // Keep export for compatibility
    HOUSING_AFFORDABLE: 300,
    HOUSING_MARKET: 400,
    RETAIL_BASIC: 250,
    RETAIL_LUXURY: 350,
    COMMUNITY: 200,
    AMENITY: 150,
};

// Cash flow per square foot (for financial viability)
export const CASH_FLOW_PER_SQFT = { // Keep export for compatibility
    HOUSING_AFFORDABLE: 15,
    HOUSING_MARKET: 30,
    RETAIL_ESSENTIAL: 20,
    RETAIL_LUXURY: 40,
    COMMUNITY_SUBSIDIZED: 5,
    COMMUNITY_MARKET: 15,
};

// Helper function to calculate card values based on square footage
export const calculateCardValues = ( // Keep export for compatibility
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

// --------------------------------------------------------------------------
// --- ORIGINAL MANDATORY IMPACTS (Kept for Backward Compatibility) ---
// @deprecated This array structure is deprecated. Use `refactoredMandatoryImpactCards`
//             which uses the full CardData structure.
// --------------------------------------------------------------------------
export const MANDATORY_IMPACTS: { id: string; name: string; netScoreImpact: number }[] = [
    {
        id: "energy-efficient-systems", // ID matches one in refactored list
        name: "Base Energy Efficiency",
        netScoreImpact: -8,
    },
    {
        id: "onsite-renewable-energy", // ID matches one in refactored list
        name: "Base Renewable Energy",
        netScoreImpact: -7,
    },
    // Note: 'streetscape-enhancement' from the refactored list is not here.
];

// --------------------------------------------------------------------------
// --- ORIGINAL PLAYABLE CARDS (Kept for Backward Compatibility) ---
// @deprecated This array is deprecated. Use `refactoredDeckCards`. Note that
//             some cards exist here that are not in the refactored list,
//             and vice-versa. The properties and values also differ.
//             THIS ARRAY IS THE SOURCE FOR 'displayInfo' FOR MATCHING IDs BELOW.
// --------------------------------------------------------------------------
export const deckCards: CardData[] = [
    // --- HOUSING: Now with proper density economics ---
    {
        id: "affordable-condo-unit",
        name: "Affordable Condo Unit",
        category: "Housing",
        image: "/cards/affordable-condo-1.png", // Different image name in original
        ...calculateCardValues(
            TYPICAL_SQFT.HOUSING_UNIT,
            IMPACT_PER_SQFT.HOUSING_AFFORDABLE,
            COST_PER_SQFT.HOUSING_AFFORDABLE,
            CASH_FLOW_PER_SQFT.HOUSING_AFFORDABLE
        ),
        baseSqft: TYPICAL_SQFT.HOUSING_UNIT, // Original property
        displayInfo: { // <--- SOURCE
            icon: "Home",
            cost: "$$",
            summary: "Community-focused condo (stackable)"
        },
    },
    {
        id: "market-condo-unit",
        name: "Market Rate Condo Unit",
        category: "Housing",
        image: "/cards/market-condo-1.png", // Different image name in original
        ...calculateCardValues(
            TYPICAL_SQFT.HOUSING_UNIT,
            IMPACT_PER_SQFT.HOUSING_MARKET,
            COST_PER_SQFT.HOUSING_MARKET,
            CASH_FLOW_PER_SQFT.HOUSING_MARKET
        ),
        baseSqft: TYPICAL_SQFT.HOUSING_UNIT, // Original property
        displayInfo: { // <--- SOURCE
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
        baseSqft: TYPICAL_SQFT.HOUSING_UNIT, // Original property
        displayInfo: { // <--- SOURCE
            icon: "Key",
            cost: "$",
            summary: "Community rental housing (stackable)"
        },
    },
    { // This card is MISSING in the refactored list
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
        baseSqft: TYPICAL_SQFT.HOUSING_UNIT * 1.5, // Original property
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
        baseSqft: TYPICAL_SQFT.RETAIL_MEDIUM, // Original property
        minSqft: TYPICAL_SQFT.RETAIL_MEDIUM, // Original property
        requiresFloor: [1, 2],
        displayInfo: { // <--- SOURCE
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
        baseSqft: TYPICAL_SQFT.RETAIL_LARGE, // Original property
        minSqft: TYPICAL_SQFT.RETAIL_LARGE, // Original property
        requiresFloor: [1, 2],
        displayInfo: { // <--- SOURCE
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
        baseSqft: TYPICAL_SQFT.RETAIL_MEDIUM, // Original property
        minSqft: TYPICAL_SQFT.RETAIL_MEDIUM, // Original property
        requiresFloor: [1, 2],
        displayInfo: { // <--- SOURCE
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
        baseSqft: TYPICAL_SQFT.RETAIL_SMALL, // Original property
        requiresFloor: [1, 2],
        displayInfo: { // <--- SOURCE
            icon: "Coffee",
            cost: "$$",
            summary: "Public eatery, balanced impact"
        },
    },
    { // This card is MISSING in the refactored list
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
        baseSqft: TYPICAL_SQFT.RETAIL_SMALL, // Original property
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
        baseSqft: TYPICAL_SQFT.RETAIL_SMALL, // Original property
        minSqft: TYPICAL_SQFT.RETAIL_SMALL, // Original property
        requiresFloor: [1, 2],
        displayInfo: { // <--- SOURCE
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
        baseSqft: TYPICAL_SQFT.COMMUNITY_LARGE, // Original property
        minSqft: TYPICAL_SQFT.COMMUNITY_MEDIUM, // Original property
        requiresFloor: [1, 2],
        displayInfo: { // <--- SOURCE
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
        baseSqft: TYPICAL_SQFT.COMMUNITY_MEDIUM, // Original property
        minSqft: TYPICAL_SQFT.COMMUNITY_MEDIUM, // Original property
        requiresFloor: [1, 2],
        displayInfo: { // <--- SOURCE
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
        baseSqft: TYPICAL_SQFT.COMMUNITY_LARGE, // Original property
        minSqft: TYPICAL_SQFT.COMMUNITY_LARGE, // Original property
        requiresFloor: [1, 2],
        displayInfo: { // <--- SOURCE
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
        baseSqft: TYPICAL_SQFT.COMMUNITY_MEDIUM, // Original property
        minSqft: TYPICAL_SQFT.COMMUNITY_MEDIUM, // Original property
        requiresFloor: [1, 2],
        displayInfo: { // <--- SOURCE
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
        baseSqft: TYPICAL_SQFT.COMMUNITY_LARGE, // Original property
        minSqft: TYPICAL_SQFT.COMMUNITY_LARGE, // Original property
        requiresFloor: [1, 2],
        displayInfo: { // <--- SOURCE
            icon: "Theater",
            cost: "$$",
            summary: "Cultural venue, community-focused"
        },
    },

    // --- AMENITIES: Both roof and ground level ---
    {
        id: "roof-garden", // Note: ID differs from refactored 'roof-garden-bar'
        name: "Roof Garden",
        category: "Roof Amenity", // Original category
        image: "/cards/roof-garden.png",
        ...calculateCardValues(
            TYPICAL_SQFT.RETAIL_SMALL,
            IMPACT_PER_SQFT.AMENITY,
            COST_PER_SQFT.AMENITY,
            0 // No direct cash flow
        ),
        baseSqft: TYPICAL_SQFT.RETAIL_SMALL, // Original property
        displayInfo: { // <--- SOURCE (Note: Not directly used due to ID change)
            icon: "Sprout",
            cost: "$",
            summary: "Rooftop green space, community-focused"
        },
    },
    { // This card is MISSING in the refactored list
        id: "green-plaza",
        name: "Green Plaza",
        category: "Ground Amenity", // Original category
        image: "/cards/green-plaza.png",
        ...calculateCardValues(
            TYPICAL_SQFT.RETAIL_SMALL,
            IMPACT_PER_SQFT.AMENITY * 1.5,
            COST_PER_SQFT.AMENITY,
            0 // No direct cash flow
        ),
        baseSqft: TYPICAL_SQFT.RETAIL_SMALL, // Original property
        displayInfo: {
            icon: "TreePine",
            cost: "$",
            summary: "Ground-level green space, community-focused"
        },
    },
    { // This card is MISSING in the refactored list
        id: "bike-facility",
        name: "Bike Facility",
        category: "Ground Amenity", // Original category
        image: "/cards/bike-facility.png",
        ...calculateCardValues(
            TYPICAL_SQFT.RETAIL_SMALL * 0.5, // Small footprint
            IMPACT_PER_SQFT.AMENITY,
            COST_PER_SQFT.AMENITY * 0.8, // Less expensive
            0 // No direct cash flow
        ),
        baseSqft: TYPICAL_SQFT.RETAIL_SMALL * 0.5, // Original property
        displayInfo: {
            icon: "Bike",
            cost: "$",
            summary: "Bike storage and repair, community-focused"
        },
    },
];


// --------------------------------------------------------------------------
// --- REFACTORED MANDATORY IMPACTS (New Structure) ---
// This is the new data structure for mandatory impacts using CardData.
// Code should transition to using this instead of the deprecated MANDATORY_IMPACTS.
// --------------------------------------------------------------------------
export const refactoredMandatoryImpactCards: CardData[] = [
    {
        id: "onsite-renewable-energy", // Matches ID in original MANDATORY_IMPACTS
        name: "Onsite Renewable Energy",
        category: "System",
        image: "/cards/onsite-renewable-energy.png",
        minimumSqft: 0, // New property
        netScoreImpact: 0, // Value differs from original MANDATORY_IMPACTS
        cost: 15,          // flat
        cashFlow: 12,      // flat
        displayInfo: { // From refactored definition
            icon: "Bolt",
            cost: "$",
            summary: "Renewable generation"
        }
    },
    {
        id: "energy-efficient-systems", // Matches ID in original MANDATORY_IMPACTS
        name: "Energy Efficient Systems",
        category: "System",
        image: "/cards/energy-efficient-systems.png",
        minimumSqft: 0, // New property
        netScoreImpact: 0, // Value differs from original MANDATORY_IMPACTS
        cost: 35,
        cashFlow: 12,
        displayInfo: { // From refactored definition
            icon: "Zap",
            cost: "$$",
            summary: "Envelope & MEP upgrades"
        }
    },
    { // New mandatory impact compared to original MANDATORY_IMPACTS
        id: "streetscape-enhancement",
        name: "Streetscape Enhancement (trees, seating etc)",
        category: "System",
        image: "/cards/streetscape-enhancement.png",
        minimumSqft: 0, // New property
        netScoreImpact: 30,
        cost: 3500,
        cashFlow: 0,
        displayInfo: { // From refactored definition
            icon: "TreeDeciduous",
            cost: "$$$",
            summary: "Public realm improvements"
        }
    }
];

// --------------------------------------------------------------------------
// --- REFACTORED PLAYABLE CARDS (New Structure & Data) ---
// This is the new data for playable cards. Code should transition to using this
// instead of the deprecated `deckCards`. DisplayInfo restored from original deckCards by ID.
// --------------------------------------------------------------------------
export const refactoredDeckCards: CardData[] = [
    // --- HOUSING ---
    {
        id: "affordable-rental-unit", // Same ID as original
        name: "1 unit - Affordable Rental", // Different name
        category: "Housing",
        image: "/cards/affordable-rental.png", // Same image
        minimumSqft: 600, // New property (replaces baseSqft/minSqft)
        netScoreImpact: -10, // Different value
        cost: 600 * 1000, // Different calculation/value
        cashFlow: 600 * 69.54, // Different calculation/value
        displayInfo: { // RESTORED from original deckCards matching ID
            icon: "Key",
            cost: "$",
            summary: "Community rental housing (stackable)"
        }
    },
    {
        id: "affordable-condo-unit", // Same ID as original
        name: "1 unit - Affordable Condo", // Different name
        category: "Housing",
        image: "/cards/affordable-condo.png", // Different image
        minimumSqft: 600, // New property
        netScoreImpact: -9, // Different value
        cost: 600 * 1000, // Different calculation/value
        cashFlow: 600 * 307.69, // Different calculation/value
        displayInfo: { // RESTORED from original deckCards matching ID
            icon: "Home",
            cost: "$$",
            summary: "Community-focused condo (stackable)"
        }
    },
    { // This card is NEW compared to original deckCards
        id: "market-rental-unit",
        name: "1 unit - Market Rate Rental",
        category: "Housing",
        image: "/cards/market-rental.png",
        minimumSqft: 700,
        netScoreImpact: 9,
        cost: 700 * 1000,
        cashFlow: 700 * 75,
        displayInfo: { // From refactored definition (new card)
            icon: "Apartment",
            cost: "$$",
            summary: "Market‑rate rental"
        }
    },
    {
        id: "market-condo-unit", // Same ID as original
        name: "1 unit - Market Rate Condo", // Different name
        category: "Housing",
        image: "/cards/market-condo.png", // Different image
        minimumSqft: 700, // New property
        netScoreImpact: 18, // Different value
        cost: 700 * 1000, // Different calculation/value
        cashFlow: 700 * 571.43, // Different calculation/value
        displayInfo: { // RESTORED from original deckCards matching ID
            icon: "Building",
            cost: "$$$",
            summary: "Profit-focused condo (stackable)"
        }
    },

    // --- COMMUNITY FACILITIES ---
    {
        id: "art-gallery", // Same ID
        name: "Art Gallery", // Same name
        category: "Community Facility",
        image: "/cards/art-gallery.png", // Same image
        minimumSqft: 7000, // New property, different value
        netScoreImpact: -123.5, // Different value
        cost: 7000 * 1200, // Different calculation/value
        cashFlow: 7000 * 48, // Different calculation/value
        requiresFloor: [1, 2], // Same value
        displayInfo: { // RESTORED from original deckCards matching ID
            icon: "Palette",
            cost: "$$",
            summary: "Local art space, community-focused"
        }
    },
    {
        id: "dance-studio", // Same ID
        name: "Dance Studio", // Same name
        category: "Community Facility",
        image: "/cards/dance-studio.png", // Same image
        minimumSqft: 5000, // New property, same value as original baseSqft
        netScoreImpact: -122.5, // Different value
        cost: 5000 * 1200, // Different calculation/value
        cashFlow: 5000 * 48, // Different calculation/value
        requiresFloor: [1, 2], // Same value
        displayInfo: { // RESTORED from original deckCards matching ID
            icon: "MusicNote",
            cost: "$$",
            summary: "Community studio, balanced impact"
        }
    },
    {
        id: "vocational-school", // Same ID
        name: "Vocational School", // Same name
        category: "Community Facility",
        image: "/cards/vocational-school.png", // Same image
        minimumSqft: 7000, // New property, same value as original baseSqft
        netScoreImpact: -97.5, // Different value
        cost: 7000 * 1000, // Different calculation/value
        cashFlow: 7000 * 72, // Different calculation/value
        requiresFloor: [1, 2], // Same value
        displayInfo: { // RESTORED from original deckCards matching ID
            icon: "BookOpen",
            cost: "$$",
            summary: "Skills training, community-focused"
        }
    },
    {
        id: "daycare", // Same ID
        name: "Daycare", // Same name
        category: "Community Facility",
        image: "/cards/daycare.png", // Same image
        minimumSqft: 8000, // New property, different value
        netScoreImpact: -97, // Different value
        cost: 8000 * 1000, // Different calculation/value
        cashFlow: 8000 * 72, // Different calculation/value
        requiresFloor: [1, 2], // Same value
        displayInfo: { // RESTORED from original deckCards matching ID
            icon: "Users",
            cost: "$$",
            summary: "Childcare facility, community-focused"
        }
    },
    {
        id: "performance-space", // Same ID
        name: "Small Performance Space", // Same name
        category: "Community Facility",
        image: "/cards/performance-space.png", // Same image
        minimumSqft: 6000, // New property, different value
        netScoreImpact: -163, // Different value
        cost: 6000 * 1200, // Different calculation/value
        cashFlow: 6000 * 48, // Different calculation/value
        requiresFloor: [1, 2], // Same value
        displayInfo: { // RESTORED from original deckCards matching ID
            icon: "Theater",
            cost: "$$",
            summary: "Cultural venue, community-focused"
        }
    },
    { // This card is NEW compared to original deckCards
        id: "multipurpose-community-space",
        name: "Multipurpose Community Space",
        category: "Community Facility",
        image: "/cards/multipurpose-community-space.png",
        minimumSqft: 5000,
        netScoreImpact: -28,
        cost: 5000 * 1000,
        cashFlow: 5000 * 48,
        requiresFloor: [1, 2],
        displayInfo: { // From refactored definition (new card)
            icon: "Archive",
            cost: "$$",
            summary: "Flexible event hall"
        }
    },
    { // This card is NEW compared to original deckCards
        id: "arcade",
        name: "Arcade",
        category: "Community Facility",
        image: "/cards/arcade.png",
        minimumSqft: 5000,
        netScoreImpact: -40.5,
        cost: 5000 * 1200,
        cashFlow: 5000 * 48,
        requiresFloor: [1, 2],
        displayInfo: { // From refactored definition (new card)
            icon: "Gamepad",
            cost: "$$",
            summary: "Family amusement"
        }
    },

    // --- RETAIL/COMMERCIAL ---
     {
        id: "vendor-market", // Same ID
        name: "Vendor Market", // Same name
        category: "Retail/Commercial",
        image: "/cards/vendor-market.png", // Same image
        minimumSqft: 10000, // New property, different value
        netScoreImpact: -253, // Different value
        cost: 10000 * 850, // Different calculation/value
        cashFlow: 10000 * 48, // Different calculation/value
        requiresFloor: [1, 2], // Same value
        displayInfo: { // RESTORED from original deckCards matching ID
            icon: "ShoppingBasket",
            cost: "$",
            summary: "Local vendors, community-focused"
        }
    },
    {
        id: "big-box-store", // Same ID
        name: "Big Box / Chain Store", // Different name
        category: "Retail/Commercial",
        image: "/cards/big-box-store.png", // Same image
        minimumSqft: 7500, // New property, same value as original baseSqft
        netScoreImpact: 84, // Different value
        cost: 7500 * 850, // Different calculation/value
        cashFlow: 7500 * 120, // Different calculation/value
        requiresFloor: [1, 2], // Same value
        displayInfo: { // RESTORED from original deckCards matching ID
            icon: "Store",
            cost: "$$$",
            summary: "Chain store, developer-focused"
        }
    },
    {
        id: "grocery-store", // Same ID
        name: "Grocery Store", // Same name
        category: "Retail/Commercial",
        image: "/cards/grocery-store.png", // Same image
        minimumSqft: 3000, // New property, different value
        netScoreImpact: -57, // Different value
        cost: 3000 * 850, // Different calculation/value
        cashFlow: 3000 * 120, // Different calculation/value
        requiresFloor: [1, 2], // Same value
        displayInfo: { // RESTORED from original deckCards matching ID
            icon: "ShoppingCart",
            cost: "$$",
            summary: "Essential retail, balanced impact"
        }
    },
    {
        id: "restaurant", // Same ID
        name: "Restaurant", // Same name
        category: "Retail/Commercial",
        image: "/cards/restaurant.png", // Same image
        minimumSqft: 3000, // New property, different value
        netScoreImpact: -58, // Different value
        cost: 3000 * 1000, // Different calculation/value
        cashFlow: 3000 * 84, // Different calculation/value
        requiresFloor: [1, 2, "roof"], // Added "roof" option
        displayInfo: {
            icon: "ForkKnife", // Placeholder icon
            cost: "$$", // Placeholder cost
            summary: "Public eatery, balanced impact"
        }
    },
    { // This card is NEW compared to original deckCards
        id: "night-club",
        name: "Night Club",
        category: "Retail/Commercial",
        image: "/cards/night-club.png",
        minimumSqft: 7000,
        netScoreImpact: -57.5,
        cost: 7000 * 1000,
        cashFlow: 7000 * 84,
        requiresFloor: [1, 2],
        displayInfo: { // From refactored definition (new card)
            icon: "Music",
            cost: "$$$",
            summary: "Late‑night venue"
        }
    },
    {
        id: "bank", // Same ID
        name: "Bank", // Same name
        category: "Retail/Commercial",
        image: "/cards/bank.png", // Same image
        minimumSqft: 5000, // New property, same value as original baseSqft
        netScoreImpact: -25, // Different value
        cost: 5000 * 1000, // Different calculation/value
        cashFlow: 5000 * 96, // Different calculation/value
        requiresFloor: [1, 2], // Same value
        displayInfo: { // RESTORED from original deckCards matching ID
            icon: "CreditCard",
            cost: "$$",
            summary: "Financial service, balanced impact"
        }
    },

    // --- AMENITIES ---
    { // Replaces 'roof-garden' from original
        id: "roof-garden-bar",
        name: "Roof Garden / Bar",
        category: "Amenity", // Different category than original 'roof-garden'
        image: "/cards/roof-garden.png", // Same image as original 'roof-garden'
        minimumSqft: 6500,
        netScoreImpact: -21.5,
        cost: 6500 * 1000,
        cashFlow: 0,
        requiresFloor: [ "roof" as any ],
        displayInfo: { // From refactored definition (new card/ID change)
            icon: "Sprout",
            cost: "$",
            summary: "Rooftop green social space"
        }
    },

    // --- HOSPITALITY ---
    { // This card is NEW compared to original deckCards
        id: "hotel-room",
        name: "Hotel (per room)",
        category: "Hospitality",
        image: "/cards/hotel-room.png",
        minimumSqft: 45000,
        netScoreImpact: -20.5,
        cost: 45000 * 1000,
        cashFlow: 45000 * 120,
        displayInfo: { // From refactored definition (new card)
            icon: "Hotel",
            cost: "$$$",
            summary: "Guest room"
        }
    },

    // --- SPECIALTY ---
    { // This card is NEW compared to original deckCards
        id: "recording-studio",
        name: "Recording Studio",
        category: "Specialty",
        image: "/cards/recording-studio.png",
        minimumSqft: 5000,
        netScoreImpact: -120.5,
        cost: 5000 * 1200,
        cashFlow: 5000 * 25,
        requiresFloor: [1, 2],
        displayInfo: { // From refactored definition (new card)
            icon: "Microphone",
            cost: "$$",
            summary: "Audio production space"
        }
    }
];


// --------------------------------------------------------------------------
// --- HELPER FUNCTIONS (Operating on ORIGINAL data for Backward Compatibility) ---
// @deprecated These functions operate on the deprecated `deckCards`.
//             Consider creating new functions (`createRefactoredInitialDeck`,
//             `getRefactoredCardById`) or adding flags to switch behavior
//             once the transition begins.
// --------------------------------------------------------------------------

// Shuffled deck creation - USES ORIGINAL DECK
export const createInitialDeck = (): CardData[] => {
    // Uses the original deckCards for backward compatibility
    const shuffleableDeck = [...deckCards]; // refers to the DEPRECATED deck above

    // Fisher-Yates shuffle
    for (let i = shuffleableDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffleableDeck[i], shuffleableDeck[j]] = [shuffleableDeck[j], shuffleableDeck[i]];
    }

    return shuffleableDeck;
};

// Card lookup by ID - SEARCHES ORIGINAL DECK FIRST
export const getCardById = (id: string): CardData | undefined => {
    // Search original deck first for backward compatibility
    let card = deckCards.find(card => card.id === id); // refers to the DEPRECATED deck above
    if (card) {
        return card;
    }
    // Optional: As a fallback or during transition, search the refactored deck?
    // card = refactoredDeckCards.find(card => card.id === id);
    // if (card) {
    //     console.warn(`Card with ID ${id} found in refactoredDeckCards, but not original deckCards. Transition may be needed.`);
    //     return card;
    // }

    // Should it also search mandatory impacts? Original likely didn't.
    // const mandatoryCard = refactoredMandatoryImpactCards.find(card => card.id === id); // Check refactored ones
    // if (mandatoryCard) return mandatoryCard;

    return undefined; // Or stick strictly to original deckCards
};

// --- Optional: New helper functions for refactored data ---
/*
export const createRefactoredInitialDeck = (): CardData[] => {
    const shuffleableDeck = [...refactoredDeckCards]; // Uses the NEW deck
    // ... shuffle logic ...
    for (let i = shuffleableDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffleableDeck[i], shuffleableDeck[j]] = [shuffleableDeck[j], shuffleableDeck[i]];
    }
    return shuffleableDeck;
}

export const getRefactoredCardById = (id: string): CardData | undefined => {
    const allRefactoredCards = [...refactoredDeckCards, ...refactoredMandatoryImpactCards]; // Uses NEW decks
    return allRefactoredCards.find(card => card.id === id);
}

// Function to get *only* playable cards from the new deck
export const getPlayableRefactoredCards = (): CardData[] => {
    return [...refactoredDeckCards];
}

// Function to get *only* mandatory cards from the new deck
export const getMandatoryRefactoredCards = (): CardData[] => {
    return [...refactoredMandatoryImpactCards];
}
*/