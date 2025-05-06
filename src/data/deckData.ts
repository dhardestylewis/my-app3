// data/deckData.ts
// Corrected for duplicate properties and getCardDefinitions return type.

import { CardDefinition } from "../data/types";

/**
 * Default image path used when a card's specified image is missing or invalid.
 */
export const DEFAULT_CARD_IMAGE_PATH = "/cards/default-card.png"; // Ensure this is exported

/**
 * Contains the definitions for cards considered "mandatory impacts" or starting conditions.
 */
export const mandatoryImpactCardDefinitions: Readonly<CardDefinition[]> = [
    {
        id: "onsite-renewable-energy", name: "Onsite Renewable Energy", category: "System",
        image: "/cards/onsite-renewable-energy.png",
        netScoreImpact: -7, cost: 15000, cashFlow: 1200,
        displayInfo: { icon: "Bolt", cost: "$", summary: "Renewable generation" }
    },
    {
        id: "energy-efficient-systems", name: "Energy Efficient Systems", category: "System",
        image: "/cards/energy-efficient-systems.png",
        netScoreImpact: -8, cost: 35000, cashFlow: 1200,
        displayInfo: { icon: "Zap", cost: "$$", summary: "Envelope & MEP upgrades" }
    },
    {
        id: "streetscape-enhancement", name: "Streetscape Enhancement", category: "System",
        image: "/cards/streetscape-enhancement.png",
        netScoreImpact: -15, cost: 35000, cashFlow: 0,
        displayInfo: { icon: "TreeDeciduous", cost: "$$$", summary: "Public realm improvements" }
    }
];

/**
 * Defines the playable cards in the deck using the CardDefinition structure.
 */
export const playableCardDefinitions: Readonly<CardDefinition[]> = [
    // --- HOUSING ---
    {
        id: "affordable-rental-unit", name: "1 unit - Affordable Rental", category: "Housing",
        image: "/cards/affordable-rental.png", minimumSqft: 600,
        netScoreImpact: -10, cost: 600000, cashFlow: 41724,
        quantity: 4,
        displayInfo: { icon: "Key", cost: "$", summary: "Community rental housing" }
    },
    {
        id: "affordable-condo-unit", name: "1 unit - Affordable Condo", category: "Housing",
        image: "/cards/affordable-condo.png", minimumSqft: 600,
        netScoreImpact: -9, cost: 600000, cashFlow: 184614,
        quantity: 4,
        displayInfo: { icon: "Home", cost: "$$", summary: "Community condo" }
    },
    {
        id: "market-rental-unit", name: "1 unit - Market Rate Rental", category: "Housing",
        image: "/cards/market-rental.png", minimumSqft: 700,
        netScoreImpact: 9, cost: 700000, cashFlow: 52500,
        quantity: 3,
        displayInfo: { icon: "Building", cost: "$$", summary: "Market-rate rental" }
    },
    {
        id: "market-condo-unit", name: "1 unit - Market Rate Condo", category: "Housing",
        image: "/cards/market-condo.png", minimumSqft: 700,
        netScoreImpact: 18, cost: 700000, cashFlow: 400001,
        quantity: 3,
        displayInfo: { icon: "Building", cost: "$$$", summary: "Market-rate condo" }
    },

    // --- COMMUNITY FACILITIES ---
    {
        id: "art-gallery", name: "Art Gallery", category: "Community Facility",
        image: "/cards/art-gallery.png", minimumSqft: 7000,
        netScoreImpact: -123, cost: 8400000, cashFlow: 336000,
        requiresFloor: [1, 2], quantity: 1,
        displayInfo: { icon: "Palette", cost: "$$", summary: "Local art space" }
    },
    // ... (other community facilities as before, ensuring minimumSqft) ...
    {
        id: "dance-studio", name: "Dance Studio", category: "Community Facility",
        image: "/cards/dance-studio.png", minimumSqft: 5000, 
        netScoreImpact: -122, cost: 6000000, cashFlow: 240000, 
        requiresFloor: [1, 2], quantity: 1,
        displayInfo: { icon: "MusicNote", cost: "$$", summary: "Community studio" }
    },
    {
        id: "vocational-school", name: "Vocational School", category: "Community Facility",
        image: "/cards/vocational-school.png", minimumSqft: 7000, 
        netScoreImpact: -97, cost: 7000000, cashFlow: 504000, 
        requiresFloor: [1, 2], quantity: 1,
        displayInfo: { icon: "BookOpen", cost: "$$", summary: "Skills training" }
    },
    {
        id: "daycare", name: "Daycare", category: "Community Facility",
        image: "/cards/daycare.png", minimumSqft: 8000, 
        netScoreImpact: -97, cost: 8000000, cashFlow: 576000, 
        requiresFloor: [1, 2], quantity: 1,
        displayInfo: { icon: "Users", cost: "$$", summary: "Childcare facility" }
    },
    {
        id: "performance-space", name: "Small Performance Space", category: "Community Facility",
        image: "/cards/performance-space.png", minimumSqft: 6000, 
        netScoreImpact: -163, cost: 7200000, cashFlow: 288000, 
        requiresFloor: [1, 2], quantity: 1,
        displayInfo: { icon: "Theater", cost: "$$", summary: "Cultural venue" }
    },
    {
        id: "multipurpose-community-space", name: "Multipurpose Community Space", category: "Community Facility",
        image: "/cards/multipurpose-community-space.png", minimumSqft: 5000, 
        netScoreImpact: -28, cost: 5000000, cashFlow: 240000, 
        requiresFloor: [1, 2], quantity: 1,
        displayInfo: { icon: "Archive", cost: "$$", summary: "Flexible event hall" }
    },
    {
        id: "arcade", name: "Arcade", category: "Community Facility",
        image: "/cards/arcade.png", minimumSqft: 5000, 
        netScoreImpact: -40, cost: 6000000, cashFlow: 240000, 
        requiresFloor: [1, 2], quantity: 1,
        displayInfo: { icon: "Gamepad", cost: "$$", summary: "Family amusement" }
    },

    // --- RETAIL/COMMERCIAL ---
     {
        id: "vendor-market", name: "Vendor Market", category: "Retail/Commercial",
        image: "/cards/vendor-market.png", minimumSqft: 10000, 
        netScoreImpact: -53, cost: 8500000, cashFlow: 480000, 
        requiresFloor: ['ground', 1], quantity: 1,
        displayInfo: { icon: "ShoppingBasket", cost: "$", summary: "Local vendors" }
    },
    // ... (other retail/commercial as before, ensuring minimumSqft) ...
    {
        id: "big-box-store", name: "Big Box / Chain Store", category: "Retail/Commercial",
        image: "/cards/big-box-store.png", minimumSqft: 7500, 
        netScoreImpact: 84, cost: 6375000, cashFlow: 900000, 
        requiresFloor: ['ground', 1], quantity: 1,
        displayInfo: { icon: "Store", cost: "$$$", summary: "Chain store" }
    },
    {
        id: "grocery-store", name: "Grocery Store", category: "Retail/Commercial",
        image: "/cards/grocery-store.png", minimumSqft: 3000, 
        netScoreImpact: -57, cost: 2550000, cashFlow: 360000, 
        requiresFloor: ['ground', 1], quantity: 1,
        displayInfo: { icon: "ShoppingCart", cost: "$$", summary: "Essential retail" }
    },
    {
        id: "restaurant", name: "Restaurant", category: "Retail/Commercial",
        image: "/cards/restaurant.png", minimumSqft: 3000, 
        netScoreImpact: -8, cost: 3000000, cashFlow: 252000, 
        requiresFloor: ['ground', 1, 'roof'], quantity: 1,
        displayInfo: { icon: "Utensils", cost: "$$", summary: "Public eatery" }
    },
    {
        id: "night-club", name: "Night Club", category: "Retail/Commercial",
        image: "/cards/night-club.png", minimumSqft: 7000, 
        netScoreImpact: -7, cost: 7000000, cashFlow: 588000, 
        requiresFloor: ['ground', 1], quantity: 1,
        displayInfo: { icon: "Music", cost: "$$$", summary: "Late‑night venue" }
    },
    {
        id: "bank", name: "Bank", category: "Retail/Commercial",
        image: "/cards/bank.png", minimumSqft: 5000, 
        netScoreImpact: 5, cost: 5000000, cashFlow: 480000, 
        requiresFloor: ['ground', 1], quantity: 1,
        displayInfo: { icon: "Landmark", cost: "$$", summary: "Financial service" }
    },

    // --- AMENITIES ---
    {
        id: "roof-garden-bar", name: "Roof Garden / Bar", category: "Amenity",
        image: "/cards/roof-garden.png", minimumSqft: 6500,
        netScoreImpact: -21, cost: 6500000, cashFlow: 0,
        requiresFloor: ["roof"], quantity: 1,
        displayInfo: { icon: "Sprout", cost: "$", summary: "Rooftop green social space" }
    },
    {
        id: "public-plaza-bikes", name: "Public Plaza w/ Bike Parking", category: "Amenity",
        image: "/cards/green-plaza.png", minimumSqft: 4000,
        netScoreImpact: -15, cost: 4000000, cashFlow: 0,
        requiresFloor: ["ground"], quantity: 1,
        displayInfo: { icon: "Bike", cost: "$", summary: "Ground-level plaza & bikes" }
    },

    // --- HOSPITALITY ---
    {
        id: "hotel-room", name: "Hotel (per room)", category: "Hospitality",
        image: "/cards/hotel-room.png",
        // Corrected: Only one set of values for minimumSqft and netScoreImpact
        minimumSqft: 45000, // User's original intended value representing a plannable unit
        netScoreImpact: -20,  // User's original intended value
        cost: 45000000, cashFlow: 5400000,
        quantity: 2,
        displayInfo: { icon: "Hotel", cost: "$$$", summary: "Guest room block" }
    },

    // --- SPECIALTY ---
    {
        id: "recording-studio", name: "Recording Studio", category: "Specialty",
        image: "/cards/recording-studio.png", minimumSqft: 5000,
        netScoreImpact: -120, cost: 6000000, cashFlow: 125000,
        requiresFloor: [1, 2], quantity: 1,
        displayInfo: { icon: "Microphone", cost: "$$", summary: "Audio production space" }
    }
];

/**
 * Provides the base definitions for playable cards.
 * @returns {CardDefinition[]} A new array copy of playable card definitions.
 */
export const getCardDefinitions = (): CardDefinition[] => { // Corrected return type
    return [...playableCardDefinitions]; // Creates a shallow mutable copy
};

/**
 * Retrieves a specific card definition (playable or mandatory) by its base ID.
 */
export const getCardDefinitionById = (id: string): CardDefinition | undefined => {
    const allDefinitions = [...playableCardDefinitions, ...mandatoryImpactCardDefinitions];
    return allDefinitions.find(def => def.id === id);
};

export const cards: Readonly<CardDefinition[]> = getCardDefinitions();