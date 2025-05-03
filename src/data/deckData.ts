// data/deckData.ts
import { CardData } from "./types";

// ------------------------------
// MANDATORY IMPACTS (Systems & Streetscape)
// ------------------------------
export const MANDATORY_IMPACTS: CardData[] = [
  {
    id: "onsite-renewable-energy",
    name: "Onsite Renewable Energy",
    category: "System",
    image: "/cards/onsite-renewable-energy.png",
    minimumSqft: 0,
    netScoreImpact: 0,
    cost: 15,            // flat
    cashFlow: 12,        // flat
    displayInfo: {
      icon: "Bolt",
      cost: "$",
      summary: "Renewable generation"
    }
  },
  {
    id: "energy-efficient-systems",
    name: "Energy Efficient Systems",
    category: "System",
    image: "/cards/energy-efficient-systems.png",
    minimumSqft: 0,
    netScoreImpact: 0,
    cost: 35,
    cashFlow: 12,
    displayInfo: {
      icon: "Zap",
      cost: "$$",
      summary: "Envelope & MEP upgrades"
    }
  },
  {
    id: "streetscape-enhancement",
    name: "Streetscape Enhancement (trees, seating etc)",
    category: "System",
    image: "/cards/streetscape-enhancement.png",
    minimumSqft: 0,
    netScoreImpact: 30,
    cost: 3500,
    cashFlow: 0,
    displayInfo: {
      icon: "TreeDeciduous",
      cost: "$$$",
      summary: "Public realm improvements"
    }
  }
];

// ------------------------------
// PLAYABLE CARDS
// ------------------------------
export const deckCards: CardData[] = [
  // --- HOUSING ---
  {
    id: "affordable-rental-unit",
    name: "1 unit - Affordable Rental",
    category: "Housing",
    image: "/cards/affordable-rental.png",
    minimumSqft: 600,
    netScoreImpact: -10,
    cost: 600 * 1000,
    cashFlow: 600 * 69.54,
    displayInfo: {
      icon: "Key",
      cost: "$",
      summary: "Community rental unit"
    }
  },
  {
    id: "affordable-condo-unit",
    name: "1 unit - Affordable Condo",
    category: "Housing",
    image: "/cards/affordable-condo.png",
    minimumSqft: 600,
    netScoreImpact: -9,
    cost: 600 * 1000,
    cashFlow: 600 * 307.69,
    displayInfo: {
      icon: "Home",
      cost: "$$",
      summary: "Owner‑occupied condo"
    }
  },
  {
    id: "market-rental-unit",
    name: "1 unit - Market Rate Rental",
    category: "Housing",
    image: "/cards/market-rental.png",
    minimumSqft: 700,
    netScoreImpact: 9,
    cost: 700 * 1000,
    cashFlow: 700 * 75,
    displayInfo: {
      icon: "Apartment",
      cost: "$$",
      summary: "Market‑rate rental"
    }
  },
  {
    id: "market-condo-unit",
    name: "1 unit - Market Rate Condo",
    category: "Housing",
    image: "/cards/market-condo.png",
    minimumSqft: 700,
    netScoreImpact: 18,
    cost: 700 * 1000,
    cashFlow: 700 * 571.43,
    displayInfo: {
      icon: "Building",
      cost: "$$$",
      summary: "Luxury condo"
    }
  },

  // --- COMMUNITY FACILITIES ---
  {
    id: "art-gallery",
    name: "Art Gallery",
    category: "Community Facility",
    image: "/cards/art-gallery.png",
    minimumSqft: 7000,
    netScoreImpact: -123.5,
    cost: 7000 * 1200,
    cashFlow: 7000 * 48,
    requiresFloor: [1, 2],
    displayInfo: {
      icon: "Palette",
      cost: "$$",
      summary: "Local art venue"
    }
  },
  {
    id: "dance-studio",
    name: "Dance Studio",
    category: "Community Facility",
    image: "/cards/dance-studio.png",
    minimumSqft: 5000,
    netScoreImpact: -122.5,
    cost: 5000 * 1200,
    cashFlow: 5000 * 48,
    requiresFloor: [1, 2],
    displayInfo: {
      icon: "MusicNote",
      cost: "$$",
      summary: "Community dance space"
    }
  },
  {
    id: "vocational-school",
    name: "Vocational School",
    category: "Community Facility",
    image: "/cards/vocational-school.png",
    minimumSqft: 7000,
    netScoreImpact: -97.5,
    cost: 7000 * 1000,
    cashFlow: 7000 * 72,
    requiresFloor: [1, 2],
    displayInfo: {
      icon: "BookOpen",
      cost: "$$",
      summary: "Skills training center"
    }
  },
  {
    id: "daycare",
    name: "Daycare",
    category: "Community Facility",
    image: "/cards/daycare.png",
    minimumSqft: 8000,
    netScoreImpact: -97,
    cost: 8000 * 1000,
    cashFlow: 8000 * 72,
    requiresFloor: [1, 2],
    displayInfo: {
      icon: "Users",
      cost: "$$",
      summary: "Childcare facility"
    }
  },
  {
    id: "performance-space",
    name: "Small Performance Space",
    category: "Community Facility",
    image: "/cards/performance-space.png",
    minimumSqft: 6000,
    netScoreImpact: -163,
    cost: 6000 * 1200,
    cashFlow: 6000 * 48,
    requiresFloor: [1, 2],
    displayInfo: {
      icon: "Theater",
      cost: "$$",
      summary: "Intimate performance venue"
    }
  },
  {
    id: "multipurpose-community-space",
    name: "Multipurpose Community Space",
    category: "Community Facility",
    image: "/cards/multipurpose-community-space.png",
    minimumSqft: 5000,
    netScoreImpact: -28,
    cost: 5000 * 1000,
    cashFlow: 5000 * 48,
    requiresFloor: [1, 2],
    displayInfo: {
      icon: "Archive",
      cost: "$$",
      summary: "Flexible event hall"
    }
  },
  {
    id: "arcade",
    name: "Arcade",
    category: "Community Facility",
    image: "/cards/arcade.png",
    minimumSqft: 5000,
    netScoreImpact: -40.5,
    cost: 5000 * 1200,
    cashFlow: 5000 * 48,
    requiresFloor: [1, 2],
    displayInfo: {
      icon: "Gamepad",
      cost: "$$",
      summary: "Family amusement"
    }
  },

  // --- RETAIL/COMMERCIAL ---
  {
    id: "vendor-market",
    name: "Vendor Market",
    category: "Retail/Commercial",
    image: "/cards/vendor-market.png",
    minimumSqft: 10000,
    netScoreImpact: -253,
    cost: 10000 * 850,
    cashFlow: 10000 * 48,
    requiresFloor: [1, 2],
    displayInfo: {
      icon: "ShoppingBasket",
      cost: "$",
      summary: "Local vendor stalls"
    }
  },
  {
    id: "big-box-store",
    name: "Big Box / Chain Store",
    category: "Retail/Commercial",
    image: "/cards/big-box-store.png",
    minimumSqft: 7500,
    netScoreImpact: 84,
    cost: 7500 * 850,
    cashFlow: 7500 * 120,
    requiresFloor: [1, 2],
    displayInfo: {
      icon: "Store",
      cost: "$$$",
      summary: "Large chain retailer"
    }
  },
  {
    id: "grocery-store",
    name: "Grocery Store",
    category: "Retail/Commercial",
    image: "/cards/grocery-store.png",
    minimumSqft: 3000,
    netScoreImpact: -57,
    cost: 3000 * 850,
    cashFlow: 3000 * 120,
    requiresFloor: [1, 2],
    displayInfo: {
      icon: "ShoppingCart",
      cost: "$$",
      summary: "Essential food market"
    }
  },
  {
    id: "restaurant",
    name: "Restaurant",
    category: "Retail/Commercial",
    image: "/cards/restaurant.png",
    minimumSqft: 3000,
    netScoreImpact: -58,
    cost: 3000 * 1000,
    cashFlow: 3000 * 84,
    requiresFloor: [1, 2, "roof"],
    displayInfo: {
      icon: "Coffee",
      cost: "$$",
      summary: "Public eatery"
    }
  },
  {
    id: "night-club",
    name: "Night Club",
    category: "Retail/Commercial",
    image: "/cards/night-club.png",
    minimumSqft: 7000,
    netScoreImpact: -57.5,
    cost: 7000 * 1000,
    cashFlow: 7000 * 84,
    requiresFloor: [1, 2],
    displayInfo: {
      icon: "Music",
      cost: "$$$",
      summary: "Late‑night venue"
    }
  },
  {
    id: "bank",
    name: "Bank",
    category: "Retail/Commercial",
    image: "/cards/bank.png",
    minimumSqft: 5000,
    netScoreImpact: -25,
    cost: 5000 * 1000,
    cashFlow: 5000 * 96,
    requiresFloor: [1, 2],
    displayInfo: {
      icon: "CreditCard",
      cost: "$$",
      summary: "Financial services"
    }
  },

  // --- AMENITIES ---
  {
    id: "roof-garden-bar",
    name: "Roof Garden / Bar",
    category: "Amenity",
    image: "/cards/roof-garden.png",
    minimumSqft: 6500,
    netScoreImpact: -21.5,
    cost: 6500 * 1000,
    cashFlow: 0,
    requiresFloor: ["roof"],
    displayInfo: {
      icon: "Sprout",
      cost: "$",
      summary: "Rooftop green social space"
    }
  },

  // --- HOSPITALITY ---
  {
    id: "hotel-room",
    name: "Hotel (per room)",
    category: "Hospitality",
    image: "/cards/hotel-room.png",
    minimumSqft: 45000,
    netScoreImpact: -20.5,
    cost: 45000 * 1000,
    cashFlow: 45000 * 120,
    displayInfo: {
      icon: "Hotel",
      cost: "$$$",
      summary: "Guest room"
    }
  },

  // --- SPECIALTY ---
  {
    id: "recording-studio",
    name: "Recording Studio",
    category: "Specialty",
    image: "/cards/recording-studio.png",
    minimumSqft: 5000,
    netScoreImpact: -120.5,
    cost: 5000 * 1200,
    cashFlow: 5000 * 25,
    requiresFloor: [1, 2],
    displayInfo: {
      icon: "Microphone",
      cost: "$$",
      summary: "Audio production space"
    }
  }
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
