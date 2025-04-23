// store/useGameStore.ts
import { create } from 'zustand';
import { CardData, BuildingUse, FloorData } from "@/data/types"; // Assuming BuildingUse enum is correctly defined elsewhere or removed if not used
import { Player, GamePhase, FloorState, ValidationResult, GameTelemetry } from "@/store/types";
import {
    createInitialDeck,
    getCardById,
    MANDATORY_IMPACTS,
} from '@/data/deckData';

// ------------------------------
// CONSTANTS
// ------------------------------
const MAX_HAND_SIZE = 7;
const BUILDING_FOOTPRINT = 10000; // sq ft per floor
const MAX_STORIES = 25;
const BALANCE_THRESHOLD = 15; // Less strict threshold for "balanced" outcome
const MAX_RECALL_TOKENS = 2;   // Number of recall tokens per player
const RECALL_SCORE_PENALTY = 5; // Score penalty for using recall tokens
const RECALL_MAX_FLOOR = 12;    // Recall tokens cannot be used after this floor
const PROPOSAL_TIMER = 30;      // Seconds for each proposal/response

// ------------------------------
// INITIAL STATES
// ------------------------------
// Calculate baseline score from mandatory impacts
const BASELINE_SCORE = MANDATORY_IMPACTS.reduce((sum, impact) => sum + impact.netScoreImpact, 0);

// Define initialBuildingState with explicit type
const initialBuildingState: {
    floors: { [key: number]: FloorData }; // Use FloorData here
    playedCards: CardData[];
    totalSqft: number;
    totalHeight: number;
    baselineScore: number;
    currentNetScore: number;
} = {
    floors: {},
    playedCards: [],
    totalSqft: 0,
    totalHeight: 0,
    baselineScore: BASELINE_SCORE,
    currentNetScore: BASELINE_SCORE,
};


const initialFloorStates: FloorState[] = [];

const initialTelemetry: GameTelemetry = {
    negotiationTimes: {},
    recallsUsed: { community: 0, developer: 0 },
    winsByRole: { community: 0, developer: 0, balanced: 0 },
    winsByLeadBlock: {},
};

// ------------------------------
// ZUSTAND STORE INTERFACE
// ------------------------------
// Forward declaration for internal actions if needed, or define directly
interface InternalGameActions {
    advanceToNextFloor: () => void;
    finalizeFloor: (finalState: FloorState) => void;
    // Add AI helper methods if they need to be part of the interface
    aiMakeProposal: () => void;
    aiRespondToProposal: () => void;
    aiDecideOnCounter: () => void;
}


interface GameStoreState extends InternalGameActions { // Include internal actions here
    // State
    gameState: GamePhase;
    players: Player[];
    currentPlayerIndex: number;
    deck: CardData[];
    building: typeof initialBuildingState;
    floors: FloorState[]; // This holds the status ('pending', 'agreed', 'skipped', 'reopened')
    currentFloor: number;
    selectedHandCardId: string | null;
    selectedCounterCardId: string | null;
    proposalTimer: number | null;
    isAiTurn: boolean;
    gameLog: string[];
    gameOverReason: string | null;
    winnerMessage: string | null;
    telemetry: GameTelemetry;
    negotiationStartTime: number | null;

    // Actions (Public API of the store)
    startGame: (humanPlayerRole: 'community' | 'developer') => void;
    drawCard: () => void;
    selectProposalCard: (cardId: string | null) => void;
    selectCounterCard: (cardId: string | null) => void;
    proposeCard: () => void;
    counterPropose: () => void;
    acceptProposal: () => void;
    passProposal: () => void;
    useRecallToken: (floorNumber: number) => void;
    validatePlay: (cardId: string, targetFloor: number) => ValidationResult;
    calculateNetScore: () => number;
    // commitFloor is now internal, replaced by finalizeFloor
    // endNegotiation is now internal, replaced by advanceToNextFloor
    aiPlayTurn: () => void;
    runAiMediation: (floorState: FloorState) => CardData | undefined; // Can return undefined if proposals missing
    simulateRemaining: (score: number, remainingFloors: number) => number;
    checkImpossibleFinish: () => boolean;
    resetGame: () => void;
    logAction: (message: string) => void;
    getFloorSummary: () => { floorData: { floor: number, sqft: number, uses: BuildingUse[], score: number }[], totalScore: number }; // Assuming BuildingUse type is available

    // Utility getters
    getCurrentFloorState: () => FloorState | undefined;
    getCurrentPlayer: () => Player | undefined;
    getLeadPlayer: () => Player | undefined;
    getRespondingPlayer: () => Player | undefined;
    getFloorLeadPlayer: (floorNumber: number) => Player | undefined;
    isPlayerA: (player: Player) => boolean;

    // Compatibility
    playCard: () => void;
}

// ------------------------------
// ZUSTAND STORE IMPLEMENTATION
// ------------------------------
export const useGameStore = create<GameStoreState>((set, get) => ({
    // Initial state values
    gameState: 'title',
    players: [],
    currentPlayerIndex: 0,
    deck: [],
    building: { ...initialBuildingState }, // Ensure deep copy if nested objects exist
    floors: [...initialFloorStates],
    currentFloor: 1,
    selectedHandCardId: null,
    selectedCounterCardId: null,
    proposalTimer: null,
    isAiTurn: false,
    gameLog: ["Welcome to Urban Balance"],
    gameOverReason: null,
    winnerMessage: null,
    telemetry: { ...initialTelemetry }, // Ensure deep copy
    negotiationStartTime: null,

    // --- UTILITY GETTERS ---
    getCurrentFloorState: () => {
        const { floors, currentFloor } = get();
        return floors.find(f => f.floorNumber === currentFloor);
    },

    getCurrentPlayer: () => {
        const { players, currentPlayerIndex } = get();
        return players[currentPlayerIndex];
    },

    getLeadPlayer: () => {
        const currentFloor = get().currentFloor;
        return get().getFloorLeadPlayer(currentFloor);
    },

    getRespondingPlayer: () => {
        const { players } = get();
        const leadPlayer = get().getLeadPlayer();
        if (!leadPlayer) return undefined;
        return players.find(p => p.id !== leadPlayer.id);
    },

    getFloorLeadPlayer: (floorNumber: number) => {
        const { players } = get();
        const blockSize = 5;
        const blockNumber = Math.ceil(floorNumber / blockSize);
        const isPlayerALead = blockNumber % 2 === 1;
        return players.find(p => p.isLeadPlayer === isPlayerALead);
    },

    isPlayerA: (player: Player) => {
        const { players } = get();
        return player.id === players[0]?.id;
    },

    // --- CORE ACTIONS ---
    startGame: (humanPlayerRole) => {
        const developerRole = 'developer';
        const communityRole = 'community';
        const humanIsDeveloper = humanPlayerRole === developerRole;
        const aiRole = humanIsDeveloper ? communityRole : developerRole;
        const humanIsPlayerA = Math.random() < 0.5;

        const players: Player[] = [
            humanIsPlayerA
                ? { id: 'human', name: `You (${humanPlayerRole})`, type: 'human', role: humanPlayerRole, hand: [], recallTokens: MAX_RECALL_TOKENS, isLeadPlayer: true }
                : { id: 'ai', name: `AI (${aiRole})`, type: 'ai', role: aiRole, hand: [], recallTokens: MAX_RECALL_TOKENS, isLeadPlayer: true },
            humanIsPlayerA
                ? { id: 'ai', name: `AI (${aiRole})`, type: 'ai', role: aiRole, hand: [], recallTokens: MAX_RECALL_TOKENS, isLeadPlayer: false }
                : { id: 'human', name: `You (${humanPlayerRole})`, type: 'human', role: humanPlayerRole, hand: [], recallTokens: MAX_RECALL_TOKENS, isLeadPlayer: false }
        ];

        const deck = createInitialDeck();
        const initialLog = [
            `Game started. You: ${humanPlayerRole}. AI: ${aiRole}.`,
            `Starting score: ${BASELINE_SCORE} (city climate requirements).`,
            `You are Player ${humanIsPlayerA ? 'A' : 'B'}. Player A leads floors 1-5, Player B leads floors 6-10, etc.`,
            `Each player has ${MAX_RECALL_TOKENS} recall tokens to reopen floors (usable until floor ${RECALL_MAX_FLOOR}).`,
            `Goal: Keep final score within ±${BALANCE_THRESHOLD} for a balanced project.`
        ];

        players.forEach(player => {
            for (let i = 0; i < 5; i++) {
                if (deck.length > 0) player.hand.push(deck.pop()!);
            }
        });

        const newFloors: FloorState[] = [];
        for (let i = 1; i <= MAX_STORIES; i++) {
            newFloors.push({
                floorNumber: i, status: 'pending', proposalA: undefined, proposalB: undefined,
                winnerCard: undefined, committedBy: null, units: 1,
            });
        }

        const leadPlayer = players.find(p => p.isLeadPlayer);

        set({
            gameState: 'playing',
            players,
            deck,
            currentPlayerIndex: players.findIndex(p => p.id === leadPlayer?.id),
            building: { ...initialBuildingState, baselineScore: BASELINE_SCORE, currentNetScore: BASELINE_SCORE },
            floors: newFloors,
            currentFloor: 1,
            gameLog: [...initialLog, `--- Floor 1: ${leadPlayer?.name}'s Turn to Propose ---`],
            gameOverReason: null, winnerMessage: null, selectedHandCardId: null, selectedCounterCardId: null,
            proposalTimer: PROPOSAL_TIMER, isAiTurn: leadPlayer?.type === 'ai',
            telemetry: { ...initialTelemetry }, negotiationStartTime: Date.now(),
        });

        if (leadPlayer?.type === 'ai') {
            setTimeout(() => get().aiPlayTurn(), 1000);
        }
    },

    drawCard: () => {
        const { deck, players, currentPlayerIndex, isAiTurn, gameState } = get();
        if (gameState !== 'playing' || isAiTurn) return;
        const currentPlayer = players[currentPlayerIndex];
        if (!currentPlayer || currentPlayer.type !== 'human') return;

        if (deck.length === 0) {
            get().logAction(`Cannot draw: deck is empty.`); return;
        }
        if (currentPlayer.hand.length >= MAX_HAND_SIZE) {
            get().logAction(`Cannot draw: hand limit (${MAX_HAND_SIZE}) reached.`); return;
        }

        const newDeck = [...deck];
        const card = newDeck.pop();
        if (card) {
            const newPlayers = players.map((p, i) =>
                i === currentPlayerIndex ? { ...p, hand: [...p.hand, card] } : p
            );
            set({ deck: newDeck, players: newPlayers });
            get().logAction(`${currentPlayer.name} drew ${card.name}`);
        }
    },

    selectProposalCard: (cardId) => {
        if (get().gameState !== 'playing' || get().isAiTurn) return;
        const currentPlayer = get().getCurrentPlayer();
        if (!currentPlayer || currentPlayer.type !== 'human') return;
        set({ selectedHandCardId: cardId === get().selectedHandCardId ? null : cardId });
    },

    selectCounterCard: (cardId) => {
        if (get().gameState !== 'playing' || get().isAiTurn) return;
        const currentPlayer = get().getCurrentPlayer();
        if (!currentPlayer || currentPlayer.type !== 'human') return;
        set({ selectedCounterCardId: cardId === get().selectedCounterCardId ? null : cardId });
    },

    proposeCard: () => {
        const { players, currentPlayerIndex, currentFloor, selectedHandCardId, isAiTurn, gameState } = get();
        if (gameState !== 'playing' || isAiTurn || !selectedHandCardId) return;

        const currentPlayer = get().getCurrentPlayer();
        const leadPlayer = get().getLeadPlayer();
        if (!currentPlayer || currentPlayer.type !== 'human' || currentPlayer.id !== leadPlayer?.id) return;

        const cardToPropose = currentPlayer.hand.find(c => c.id === selectedHandCardId);
        if (!cardToPropose) return;

        const updatedFloors = [...get().floors];
        const floorIndex = updatedFloors.findIndex(f => f.floorNumber === currentFloor);
        if (floorIndex === -1) return;

        const isPlayerA = get().isPlayerA(currentPlayer);
        const floorState = updatedFloors[floorIndex];
        if (isPlayerA) { floorState.proposalA = cardToPropose; }
        else { floorState.proposalB = cardToPropose; }

        get().logAction(`${currentPlayer.name} proposes ${cardToPropose.name} for floor ${currentFloor}.`);

        const respondingPlayer = get().getRespondingPlayer();
        if (!respondingPlayer) return;

        set({
            floors: updatedFloors,
            currentPlayerIndex: players.findIndex(p => p.id === respondingPlayer.id),
            selectedHandCardId: null, // Clear selection after proposing
            proposalTimer: PROPOSAL_TIMER,
            isAiTurn: respondingPlayer.type === 'ai'
        });

        get().logAction(`${respondingPlayer.name} to accept, counter, or pass.`);
        if (respondingPlayer.type === 'ai') {
            setTimeout(() => get().aiPlayTurn(), 1000);
        }
    },

    counterPropose: () => {
        const { players, currentPlayerIndex, currentFloor, selectedCounterCardId, isAiTurn, gameState } = get();
        if (gameState !== 'playing' || isAiTurn || !selectedCounterCardId) return;

        const currentPlayer = get().getCurrentPlayer();
        const respondingPlayer = get().getRespondingPlayer();
        if (!currentPlayer || currentPlayer.type !== 'human' || currentPlayer.id !== respondingPlayer?.id) return;

        const cardToCounter = currentPlayer.hand.find(c => c.id === selectedCounterCardId);
        if (!cardToCounter) return;

        const updatedFloors = [...get().floors];
        const floorIndex = updatedFloors.findIndex(f => f.floorNumber === currentFloor);
        if (floorIndex === -1) return;

        const isPlayerA = get().isPlayerA(currentPlayer);
        const floorState = updatedFloors[floorIndex];
        if (isPlayerA) { floorState.proposalA = cardToCounter; }
        else { floorState.proposalB = cardToCounter; }

        get().logAction(`${currentPlayer.name} counter-proposes ${cardToCounter.name} for floor ${currentFloor}.`);

        const leadPlayer = get().getLeadPlayer();
        if (!leadPlayer) return;

        set({
            floors: updatedFloors,
            currentPlayerIndex: players.findIndex(p => p.id === leadPlayer.id),
            selectedCounterCardId: null, // Clear selection
            proposalTimer: PROPOSAL_TIMER,
            isAiTurn: leadPlayer.type === 'ai'
        });

        get().logAction(`${leadPlayer.name} to accept counter-offer or let AI mediate.`);
        if (leadPlayer.type === 'ai') {
            setTimeout(() => get().aiPlayTurn(), 1000);
        }
    },

    acceptProposal: () => {
        const { currentFloor, gameState, isAiTurn } = get();
        if (gameState !== 'playing' || isAiTurn) return;

        const currentPlayer = get().getCurrentPlayer();
        if (!currentPlayer || currentPlayer.type !== 'human') return;

        const floorState = get().getCurrentFloorState();
        if (!floorState) return;

        const isLeadPlayer = currentPlayer.id === get().getLeadPlayer()?.id;
        const isAcceptingCounter = isLeadPlayer && !!floorState.proposalA && !!floorState.proposalB;

        // Determine which proposal is being accepted
        const acceptedProposal = isAcceptingCounter
            ? (get().isPlayerA(currentPlayer) ? floorState.proposalB : floorState.proposalA)
            : (get().isPlayerA(currentPlayer) ? floorState.proposalA : floorState.proposalB);

        if (!acceptedProposal) return; // Should not happen if logic is correct

        // Determine who committed based on who accepted what
        const committedBy = isAcceptingCounter
            ? (get().isPlayerA(currentPlayer) ? 'B' : 'A') // Lead accepts responder's card
            : (get().isPlayerA(currentPlayer) ? 'A' : 'B'); // Responder accepts lead's card


        get().logAction(`${currentPlayer.name} accepted ${acceptedProposal.name} for floor ${currentFloor}.`);

        // Create the final state and finalize
        const finalState: FloorState = {
            ...floorState,
            status: 'agreed',
            winnerCard: acceptedProposal,
            committedBy: committedBy
        };
        get().finalizeFloor(finalState);
    },

    passProposal: () => {
        const { currentFloor, gameState, isAiTurn } = get();
         // Allow AI pass triggered internally
        //if (gameState !== 'playing' || isAiTurn) return;

        const currentPlayer = get().getCurrentPlayer();
        // Allow AI pass
        // if (!currentPlayer || currentPlayer.type !== 'human') return;

        const floorState = get().getCurrentFloorState();
        if (!floorState) return;


        const hasProposalA = !!floorState.proposalA;
        const hasProposalB = !!floorState.proposalB;

        let finalState: FloorState | null = null;

        if (hasProposalA && hasProposalB) {
            // Mediation needed
             get().logAction(`${currentPlayer?.name ?? 'Player'} passes. AI mediator will select the fairest proposal.`);
            const mediatedWinner = get().runAiMediation(floorState);
            if (mediatedWinner) {
                get().logAction(`AI mediator selected ${mediatedWinner.name} for floor ${currentFloor}.`);
                finalState = { ...floorState, status: 'agreed', winnerCard: mediatedWinner, committedBy: 'auto' };
            } else {
                 // Fallback if mediation fails (shouldn't happen with current logic)
                 get().logAction(`Mediation failed for floor ${currentFloor}. Skipping.`);
                 finalState = { ...floorState, status: 'skipped', winnerCard: undefined, committedBy: 'none' };
            }
        } else if (hasProposalA || hasProposalB) {
            // Auto-accept single proposal
            const winnerCard = hasProposalA ? floorState.proposalA : floorState.proposalB;
             // Check winnerCard null safety although TS should catch it
             if (winnerCard) {
                 get().logAction(`${currentPlayer?.name ?? 'Player'} passes. Only one proposal exists.`);
                 get().logAction(`${winnerCard.name} is automatically accepted for floor ${currentFloor}.`);
                 finalState = { ...floorState, status: 'agreed', winnerCard: winnerCard, committedBy: hasProposalA ? 'A' : 'B' };
             } else {
                 // Should be impossible if hasProposalA or hasProposalB is true
                  get().logAction(`Error: Proposal expected but not found on floor ${currentFloor}. Skipping.`);
                  finalState = { ...floorState, status: 'skipped', winnerCard: undefined, committedBy: 'none' };
             }
        } else {
            // No proposals - Skip the floor
            get().logAction(`${currentPlayer?.name ?? 'Player'} passes. No proposals made.`);
            get().logAction(`Skipping floor ${currentFloor}.`);
            finalState = { ...floorState, status: 'skipped', winnerCard: undefined, committedBy: 'none' };
        }

        // Finalize with the determined state
        if (finalState) {
             get().finalizeFloor(finalState);
        } else {
             // Should not be reached, but as a safeguard, advance anyway
             console.error("Error: Final floor state was not determined in passProposal.");
             get().advanceToNextFloor();
        }
    },

     useRecallToken: (floorNumber) => {
        const { players, gameState, isAiTurn, floors, currentFloor, building } = get();
        // Only human can initiate recall via UI
        if (gameState !== 'playing' || isAiTurn) return;

        const currentPlayer = get().getCurrentPlayer();
        if (!currentPlayer || currentPlayer.type !== 'human') return;


        if (floorNumber >= RECALL_MAX_FLOOR) {
            get().logAction(`Cannot recall: Floor ${floorNumber} is beyond the recall limit of floor ${RECALL_MAX_FLOOR -1}.`);
            return;
        }
        if (floorNumber >= currentFloor) {
            get().logAction(`Cannot recall: Floor ${floorNumber} is the current or a future floor.`);
            return;
        }
        if (currentPlayer.recallTokens <= 0) {
            get().logAction(`Cannot recall: ${currentPlayer.name} has no recall tokens left.`);
            return;
        }

        const floorIndex = floors.findIndex(f => f.floorNumber === floorNumber);
        const floorToRecall = floors[floorIndex];

        if (floorIndex === -1 || !floorToRecall || floorToRecall.status !== 'agreed') {
            get().logAction(`Cannot recall: Floor ${floorNumber} was not agreed upon or doesn't exist.`);
            return;
        }

        const winnerCard = floorToRecall.winnerCard;
        if (!winnerCard) {
             get().logAction(`Cannot recall: No winning card found for floor ${floorNumber}.`); // Should not happen for 'agreed' status
             return;
        }

        // --- Apply Recall ---
        // 1. Player state
        const updatedPlayers = [...players];
        const playerIndex = updatedPlayers.findIndex(p => p.id === currentPlayer.id);
        if (playerIndex === -1) return; // Should not happen
        updatedPlayers[playerIndex] = {
             ...updatedPlayers[playerIndex],
             recallTokens: updatedPlayers[playerIndex].recallTokens - 1
        };

        // 2. Score penalty
        const scorePenalty = currentPlayer.role === 'community' ? RECALL_SCORE_PENALTY : -RECALL_SCORE_PENALTY;
        const newNetScore = building.currentNetScore - winnerCard.netScoreImpact + scorePenalty;

        // 3. Floor status array
        const updatedFloorStates = [...floors];
        updatedFloorStates[floorIndex] = {
            ...floorToRecall,
            status: 'reopened',
            winnerCard: undefined,
            committedBy: null,
            proposalA: undefined, // Clear proposals for renegotiation
            proposalB: undefined,
        };

        // 4. Building state (remove floor data, adjust score)
        const buildingFloors = { ...building.floors };
        delete buildingFloors[floorNumber]; // Remove the entire floor's data upon recall

        const updatedBuilding = {
            ...building,
            floors: buildingFloors,
            playedCards: building.playedCards.filter(card => card.id !== winnerCard.id),
            currentNetScore: newNetScore,
            // Recalculate totalSqft and totalHeight might be needed if complex,
            // but for now assume removing the floor data is sufficient.
             // TODO: Consider recalculating totalSqft and totalHeight if needed.
        };


        // 5. Telemetry
        const updatedTelemetry = { ...get().telemetry };
        updatedTelemetry.recallsUsed[currentPlayer.role] = (updatedTelemetry.recallsUsed[currentPlayer.role] || 0) + 1;


        // --- Set State and Start Renegotiation ---
        set({
            players: updatedPlayers,
            floors: updatedFloorStates,
            building: updatedBuilding,
            telemetry: updatedTelemetry,
            currentFloor: floorNumber, // Go back to the recalled floor
             negotiationStartTime: Date.now(), // Restart negotiation timer tracking
             selectedHandCardId: null, // Clear selections
             selectedCounterCardId: null,
        });

         get().logAction(`${currentPlayer.name} used a recall token on floor ${floorNumber}. Score penalty: ${scorePenalty > 0 ? '+' : ''}${scorePenalty}. New score: ${newNetScore > 0 ? '+' : ''}${newNetScore}`);


         // Determine lead player for the recalled floor
        const leadPlayer = get().getFloorLeadPlayer(floorNumber);
        if (!leadPlayer) {
            console.error("Error: Could not determine lead player for recalled floor.");
            // Handle error state? For now, maybe just set human player?
            set({ currentPlayerIndex: players.findIndex(p => p.type === 'human'), isAiTurn: false, proposalTimer: PROPOSAL_TIMER });
            return;
        };


        set({
            currentPlayerIndex: players.findIndex(p => p.id === leadPlayer.id),
            proposalTimer: PROPOSAL_TIMER,
            isAiTurn: leadPlayer.type === 'ai'
        });

        get().logAction(`Returning to floor ${floorNumber}. ${leadPlayer.name} to propose.`);

        if (leadPlayer.type === 'ai') {
            setTimeout(() => get().aiPlayTurn(), 1000);
        }
    },

    validatePlay: (cardId, targetFloor) => {
        // Basic validation, assuming card exists and floor is valid
        const card = getCardById(cardId);
        if (!card) return { isValid: false, reason: "Card not found." };
        if (targetFloor > MAX_STORIES) {
             return { isValid: false, reason: `Maximum height (${MAX_STORIES} stories) reached.` };
        }
        // Add more complex validation if needed (sqft limits, prerequisites, etc.)
        return { isValid: true, reason: "", targetFloor, targetSqft: card.baseSqft, unitCount: 1, costImpact: -card.cost };
    },

    calculateNetScore: () => {
        // Recalculate score purely from played cards + baseline
        // This could be used for verification but the running total `currentNetScore` should be accurate
        const { building } = get();
        let calculatedNetScore = building.baselineScore;
        // Consider penalties from recalls if not already baked into currentNetScore adjustment
        Object.values(building.floors).forEach(floorData => {
             floorData.uses.forEach(use => {
                 // This assumes use.impact correctly reflects netScoreImpact
                 // If recalls modify score directly, don't double count here.
                 // Sticking with currentNetScore seems safer.
                 // calculatedNetScore += use.impact; // Example if recalculating fully
             });
        });
         // For now, rely on the running `currentNetScore`
        return building.currentNetScore;
    },

    // --- INTERNAL HELPER ACTIONS --- (Refactored Logic)
    /**
     * Finalizes the state of a floor after negotiation ends (agreed, mediated, or skipped).
     * Updates building state, telemetry, logs, checks game end conditions, and advances to the next floor.
     */
     finalizeFloor: (finalState: FloorState) => {
        const { players, building, negotiationStartTime, deck } = get();
        const floorNumber = finalState.floorNumber;

        // 1. Update Floor Status Array
        const updatedFloorStates = [...get().floors];
        const floorIndex = updatedFloorStates.findIndex(f => f.floorNumber === floorNumber);
        if (floorIndex >= 0) {
            updatedFloorStates[floorIndex] = finalState;
        } else {
             console.error(`Error finalizing floor: Floor ${floorNumber} not found in state array.`);
             // Potentially skip updating this specific floor state if not found, but log error
        }


        // 2. Update Telemetry (Negotiation Time)
        let updatedTelemetry = { ...get().telemetry }; // Operate on a copy
        if (negotiationStartTime) {
            const endTime = Date.now();
            const negotiationTime = Math.round((endTime - negotiationStartTime) / 1000);
            updatedTelemetry.negotiationTimes[floorNumber] = negotiationTime;
        }

         // 3. Prepare Building State Update
         let updatedBuilding = { ...building }; // Operate on a copy
         let updatedPlayers = [...players]; // Operate on a copy
         let finalScore = building.currentNetScore; // Start with current score

         // --- Handle AGREED floors ---
         if (finalState.status === 'agreed' && finalState.winnerCard) {
             const winnerCard = finalState.winnerCard;
             const unitCount = finalState.units || 1; // Default to 1 if undefined

             // --- Player Hand Management ---
             let cardOwnerIndex = -1;
             const committedByPlayerA = finalState.committedBy === 'A';
             const committedByPlayerB = finalState.committedBy === 'B';
             const committedByAuto = finalState.committedBy === 'auto';

             if (committedByAuto) {
                 // Find who owned the card if committed by AI mediator
                 // This requires checking original proposals - complex if proposals cleared
                 // Simpler approach: assume card owner is based on winner card's favourability? Risky.
                 // Current logic in original `commitFloor` used lead player block - let's keep that for now.
                 // TODO: Revisit card owner logic for 'auto' commit if needed.
                  const isPlayerALead = get().getFloorLeadPlayer(floorNumber)?.isLeadPlayer ?? false; // Default if player not found
                 cardOwnerIndex = updatedPlayers.findIndex(p => p.isLeadPlayer === isPlayerALead); // Tentative owner = lead player
                 // Need to confirm if winnerCard belonged to A or B based on floorState.proposalA/B
                 // Check if winner card matches A's or B's proposal if they exist
                  if (floorState.proposalA?.id === winnerCard.id) {
                       cardOwnerIndex = updatedPlayers.findIndex(p => get().isPlayerA(p));
                  } else if (floorState.proposalB?.id === winnerCard.id) {
                       cardOwnerIndex = updatedPlayers.findIndex(p => !get().isPlayerA(p));
                  } else {
                      // Fallback: assign to lead? Or skip hand management? Log warning.
                      console.warn(`Could not determine card owner for auto-commit on floor ${floorNumber}. Card not removed from hand.`);
                      cardOwnerIndex = -1; // Indicate owner unknown
                  }

             } else if (committedByPlayerA || committedByPlayerB) {
                  // Committed by a specific player side (A or B)
                  cardOwnerIndex = updatedPlayers.findIndex(p => get().isPlayerA(p) === committedByPlayerA);
             }


             if (cardOwnerIndex >= 0 && cardOwnerIndex < updatedPlayers.length) {
                 const cardOwner = updatedPlayers[cardOwnerIndex];
                 const newHand = cardOwner.hand.filter(c => c.id !== winnerCard.id);

                 if (newHand.length < cardOwner.hand.length) { // Check if card was actually removed
                    updatedPlayers[cardOwnerIndex] = { ...cardOwner, hand: newHand };

                     // Deal replacement card if possible
                     if (newHand.length < MAX_HAND_SIZE && deck.length > 0) {
                         const newDeck = [...get().deck]; // Copy deck for mutation
                         const newCard = newDeck.pop();
                         if (newCard) {
                             updatedPlayers[cardOwnerIndex].hand.push(newCard);
                             set({ deck: newDeck }); // Update deck state
                             get().logAction(`${cardOwner.name} drew ${newCard.name}.`);
                         }
                     }
                 } else {
                     console.warn(`Winner card ${winnerCard.id} not found in hand of presumed owner ${cardOwner.name} (Index ${cardOwnerIndex}) on floor ${floorNumber}.`);
                 }
             } else {
                   console.warn(`Could not find card owner (CommittedBy: ${finalState.committedBy}) for floor ${floorNumber}. Card not removed from hand.`);
             }


             // --- Building State Update ---
             const buildingFloors = { ...updatedBuilding.floors }; // Copy floors object
             const totalSqftUsed = winnerCard.baseSqft * unitCount;
             const cardOwnerRole = cardOwnerIndex >= 0 ? updatedPlayers[cardOwnerIndex].role : 'neutral'; // Role if found, else neutral?

             if (!buildingFloors[floorNumber]) {
                  // Initialize if first use on this floor
                  buildingFloors[floorNumber] = { sqftUsed: 0, uses: [], height: 0, score: 0 };
             }
             // Add the use details
             buildingFloors[floorNumber].uses.push({
                 cardId: winnerCard.id,
                 cardName: winnerCard.name,
                 category: winnerCard.category,
                 sqft: totalSqftUsed,
                 units: unitCount,
                 impact: winnerCard.netScoreImpact * unitCount,
                 owner: cardOwnerRole
             });
             buildingFloors[floorNumber].sqftUsed += totalSqftUsed;
              // Update floor score - accumulate impacts on this specific floor
             buildingFloors[floorNumber].score = (buildingFloors[floorNumber].score || 0) + (winnerCard.netScoreImpact * unitCount);
              // Rough height calculation - needs refinement based on actual card types/rules
             buildingFloors[floorNumber].height = Math.max(buildingFloors[floorNumber].height || 0, (winnerCard.category === 'Housing' ? 12 : 15)); // Simplified height


              // Update building totals
             finalScore = building.currentNetScore + (winnerCard.netScoreImpact * unitCount); // Update running score
             updatedBuilding = {
                 ...updatedBuilding,
                 floors: buildingFloors,
                 playedCards: [...updatedBuilding.playedCards, winnerCard],
                 totalSqft: updatedBuilding.totalSqft + totalSqftUsed,
                 totalHeight: Math.max(updatedBuilding.totalHeight, floorNumber * (buildingFloors[floorNumber].height || 15)), // Update total height based on floor number and rough height
                 currentNetScore: finalScore,
             };

             // Log commitment
             get().logAction(
                 `Floor ${floorNumber} committed: ${winnerCard.name}${unitCount > 1 ? ` (×${unitCount})` : ''}. ` +
                 `Score impact: ${winnerCard.netScoreImpact * unitCount}. New total score: ${finalScore > 0 ? '+' : ''}${finalScore}`
             );

         }
         // --- Handle SKIPPED floors ---
         else if (finalState.status === 'skipped') {
              // Record the floor as skipped in the building data, but with no impact
              const buildingFloors = { ...updatedBuilding.floors };
              if (!buildingFloors[floorNumber]) {
                   buildingFloors[floorNumber] = { sqftUsed: 0, uses: [], height: 0, score: 0 }; // Initialize if needed
              }
               // Optionally add a marker use or just leave it empty
               // buildingFloors[floorNumber].uses.push({ cardId: 'skipped', cardName: 'Skipped', category: 'System', sqft: 0, units: 0, impact: 0, owner: 'none' });

              updatedBuilding = { ...updatedBuilding, floors: buildingFloors };
              // Score does not change for skipped floors
              get().logAction(`Floor ${floorNumber} finalized as skipped.`);
         }
          // --- Handle REOPENED or other statuses if needed ---
          // Currently, finalizeFloor is primarily for 'agreed' and 'skipped'


         // 4. Update State (Building, Floors array, Players, Telemetry)
         set({
             building: updatedBuilding,
             floors: updatedFloorStates,
             players: updatedPlayers,
             telemetry: updatedTelemetry,
             // Clear selections for the next turn
             selectedHandCardId: null,
             selectedCounterCardId: null,
         });

        // 5. Check for Game End Condition (Impossible Balance)
        const isImpossible = get().checkImpossibleFinish();
        if (isImpossible) {
            get().logAction(`Impossible to reach balanced outcome. Ending game.`);
            set({
                gameState: 'gameOver',
                gameOverReason: 'Balance impossible to achieve',
                winnerMessage: finalScore > BALANCE_THRESHOLD
                    ? 'Project FAVORS DEVELOPER'
                    : finalScore < -BALANCE_THRESHOLD
                    ? 'Project FAVORS COMMUNITY'
                    : 'Project BALANCED' // Should be unreachable if impossible check is correct
            });
            return; // Don't advance to next floor
        }

        // 6. Advance to Next Floor
        get().advanceToNextFloor();
    },

    /**
     * Advances the game to the next floor or ends the game if conditions are met.
     * Sets the new current floor, determines lead player, resets timer and turn state.
     */
    advanceToNextFloor: () => {
        const { currentFloor, gameState, deck, players, building } = get();
         if (gameState !== 'playing') return; // Don't advance if game already over

        const nextFloor = currentFloor + 1;

        // --- Check Game End Conditions ---
        // Max Height Reached
        if (nextFloor > MAX_STORIES) {
            get().logAction(`Building complete! Maximum height of ${MAX_STORIES} stories reached.`);
            const finalScore = building.currentNetScore;
            let outcome = '';
            let winner = '';
            if (Math.abs(finalScore) <= BALANCE_THRESHOLD) { outcome = `BALANCED (Score: ${finalScore})`; winner = 'balanced'; }
            else if (finalScore > BALANCE_THRESHOLD) { outcome = `FAVORS DEVELOPER (Score: +${finalScore})`; winner = 'developer'; }
            else { outcome = `FAVORS COMMUNITY (Score: ${finalScore})`; winner = 'community'; }

            // Update telemetry (simplified)
             const updatedTelemetry = { ...get().telemetry };
             updatedTelemetry.winsByRole[winner] = (updatedTelemetry.winsByRole[winner] || 0) + 1;
             // TODO: Implement winsByLeadBlock logic if needed

            set({ gameState: 'gameOver', gameOverReason: 'Building complete', winnerMessage: `Project ${outcome}`, telemetry: updatedTelemetry });
            return;
        }

        // No More Cards
        if (deck.length === 0 && players.every(p => p.hand.length === 0)) {
            get().logAction(`No more cards left to play. Game over.`);
             const finalScore = building.currentNetScore;
             // Duplicate outcome logic - could be refactored
             let outcome = '';
             let winner = '';
             if (Math.abs(finalScore) <= BALANCE_THRESHOLD) { outcome = `BALANCED (Score: ${finalScore})`; winner = 'balanced'; }
             else if (finalScore > BALANCE_THRESHOLD) { outcome = `FAVORS DEVELOPER (Score: +${finalScore})`; winner = 'developer'; }
             else { outcome = `FAVORS COMMUNITY (Score: ${finalScore})`; winner = 'community'; }

              // Update telemetry (simplified)
              const updatedTelemetry = { ...get().telemetry };
              updatedTelemetry.winsByRole[winner] = (updatedTelemetry.winsByRole[winner] || 0) + 1;

             set({ gameState: 'gameOver', gameOverReason: 'No more cards', winnerMessage: `Project ${outcome}`, telemetry: updatedTelemetry });
            return;
        }

        // --- Prepare for Next Floor ---
        const leadPlayer = get().getFloorLeadPlayer(nextFloor);
        if (!leadPlayer) {
             console.error(`Error: Could not determine lead player for floor ${nextFloor}.`);
             // Handle error - maybe end game?
             set({ gameState: 'gameOver', gameOverReason: 'Internal error: Cannot determine lead player' });
             return;
        }


        set(state => ({
            currentFloor: nextFloor,
            negotiationStartTime: Date.now(),
            currentPlayerIndex: state.players.findIndex(p => p.id === leadPlayer.id),
            proposalTimer: PROPOSAL_TIMER,
            isAiTurn: leadPlayer.type === 'ai',
             // Ensure proposals are cleared for the new floor (might be redundant if finalizeFloor clears them)
             floors: state.floors.map(f => f.floorNumber === nextFloor ? { ...f, proposalA: undefined, proposalB: undefined } : f),
              // Clear card selections explicitly here too
              selectedHandCardId: null,
              selectedCounterCardId: null,
        }));


        get().logAction(`Moving to floor ${nextFloor}. ${leadPlayer.name} to propose.`);

        // Trigger AI turn if applicable
        if (leadPlayer.type === 'ai') {
            setTimeout(() => get().aiPlayTurn(), 1000);
        }
    },

     // commitFloor: (floorState) => { // Original commitFloor - now superseded by finalizeFloor
     //    // ... existing complex logic ...
     //    get().endNegotiation(); // Old way of advancing
     // },

     // endNegotiation: () => { // Original endNegotiation - now superseded by advanceToNextFloor
     //     // ... existing complex logic ...
     // },


    // --- AI LOGIC --- (Largely unchanged, relies on public actions now)
    aiPlayTurn: () => {
        if (!get().isAiTurn) return;
        const { players, currentPlayerIndex } = get();
        const aiPlayer = players[currentPlayerIndex];
        if (!aiPlayer || aiPlayer.type !== 'ai') {
            console.error("AI turn error: Current player is not AI or not found.");
            set({ isAiTurn: false }); // Prevent infinite loops
            // Maybe force advance?
            get().advanceToNextFloor();
            return;
        }

        const currentFloorState = get().getCurrentFloorState();
        if (!currentFloorState) {
             console.error("AI turn error: Cannot get current floor state.");
             set({ isAiTurn: false });
             get().advanceToNextFloor();
             return;
        }


        const isLeadPlayer = aiPlayer.id === get().getLeadPlayer()?.id;
        const hasProposalA = !!currentFloorState.proposalA;
        const hasProposalB = !!currentFloorState.proposalB;

        // Decide action based on game state
        if (isLeadPlayer && !hasProposalA && !hasProposalB) {
            get().aiMakeProposal(); // AI makes initial proposal
        } else if (!isLeadPlayer && (hasProposalA !== hasProposalB)) { // XOR - only one proposal exists
            get().aiRespondToProposal(); // AI responds (accept/counter/pass)
        } else if (isLeadPlayer && hasProposalA && hasProposalB) {
            get().aiDecideOnCounter(); // AI decides whether to accept counter
        } else {
            // Unexpected state, e.g., both proposals exist but it's responder's turn?
            // Or no proposals exist but it's responder's turn? Safest is to pass.
            get().logAction(`AI (${aiPlayer.name}) in unexpected state for floor ${currentFloorState.floorNumber}. Passing.`);
            get().passProposal(); // AI passes
        }
    },

    aiMakeProposal: () => {
        const { players, currentPlayerIndex, building } = get();
        const aiPlayer = players[currentPlayerIndex];
        if (!aiPlayer || aiPlayer.hand.length === 0) {
            get().logAction(`${aiPlayer.name} passes (no cards to propose).`);
            get().passProposal(); // AI passes if no cards
            return;
        }

        // Simple AI: Choose card that best moves score towards AI's goal
        let bestCardIndex = -1;
        let bestScoreImprovement = -Infinity;
        const currentScore = building.currentNetScore;
        const aiRole = aiPlayer.role;

        for (let i = 0; i < aiPlayer.hand.length; i++) {
            const card = aiPlayer.hand[i];
            const newScore = currentScore + card.netScoreImpact;
            let scoreImprovement = 0;

            // Simplified scoring: Move towards goal (positive for dev, negative for comm)
            // without overshooting the balance threshold excessively.
            if (aiRole === 'developer') {
                 if (newScore > 0 && newScore <= BALANCE_THRESHOLD) scoreImprovement = newScore; // Good balance
                 else if (newScore > BALANCE_THRESHOLD) scoreImprovement = BALANCE_THRESHOLD - (newScore - BALANCE_THRESHOLD); // Penalize overshoot
                 else scoreImprovement = newScore; // Still better than more negative
            } else { // Community role
                 if (newScore < 0 && newScore >= -BALANCE_THRESHOLD) scoreImprovement = -newScore; // Good balance (positive improvement value)
                 else if (newScore < -BALANCE_THRESHOLD) scoreImprovement = BALANCE_THRESHOLD - (Math.abs(newScore) - BALANCE_THRESHOLD); // Penalize overshoot
                 else scoreImprovement = -newScore; // Still better than positive
            }


            if (scoreImprovement > bestScoreImprovement) {
                bestScoreImprovement = scoreImprovement;
                bestCardIndex = i;
            }
        }

        if (bestCardIndex >= 0) {
            const cardToPropose = aiPlayer.hand[bestCardIndex];
            // AI needs to "select" the card internally for proposeCard logic
             const isPlayerA = get().isPlayerA(aiPlayer);
             const updatedFloors = [...get().floors];
             const floorIndex = updatedFloors.findIndex(f => f.floorNumber === get().currentFloor);
             if (floorIndex === -1) return; // Should not happen

            updatedFloors[floorIndex][isPlayerA ? 'proposalA' : 'proposalB'] = cardToPropose;


            get().logAction(`AI (${aiPlayer.name}) proposes ${cardToPropose.name} for floor ${get().currentFloor}.`);


             // Switch turn manually as AI doesn't use selection state
             const respondingPlayer = get().getRespondingPlayer();
             if (!respondingPlayer) return;

             set({
                 floors: updatedFloors, // Set the proposal directly
                 currentPlayerIndex: players.findIndex(p => p.id === respondingPlayer.id),
                 proposalTimer: PROPOSAL_TIMER,
                 isAiTurn: respondingPlayer.type === 'ai' // Check if opponent is also AI
             });

             get().logAction(`${respondingPlayer.name} to accept, counter, or pass.`);
             if (respondingPlayer.type === 'ai') {
                 setTimeout(() => get().aiPlayTurn(), 1000); // AI vs AI
             }

        } else {
            get().logAction(`AI (${aiPlayer.name}) passes (no good moves).`);
            get().passProposal(); // AI passes if no good move found
        }
    },

     aiRespondToProposal: () => {
        const { players, currentPlayerIndex, building } = get();
        const aiPlayer = players[currentPlayerIndex];
        const currentFloorState = get().getCurrentFloorState();
         if (!currentFloorState) return; // Should not happen

        // Identify the opponent's proposal
        const isPlayerA = get().isPlayerA(aiPlayer);
        const opponentProposal = isPlayerA ? currentFloorState.proposalB : currentFloorState.proposalA;

        if (!opponentProposal) {
            get().logAction(`AI (${aiPlayer.name}) error: No proposal to respond to. Passing.`);
            get().passProposal();
            return;
        }

        const currentScore = building.currentNetScore;
        const scoreWithOpponentProposal = currentScore + opponentProposal.netScoreImpact;
        const aiRole = aiPlayer.role;

        // Decide if opponent's proposal is acceptable
         let proposalIsAcceptable = (aiRole === 'developer' && scoreWithOpponentProposal > -BALANCE_THRESHOLD * 0.5) || // Dev accepts if not too negative
                                    (aiRole === 'community' && scoreWithOpponentProposal < BALANCE_THRESHOLD * 0.5); // Comm accepts if not too positive
         // More nuanced: Check if it's within [-BALANCE_THRESHOLD, BALANCE_THRESHOLD]
         proposalIsAcceptable = Math.abs(scoreWithOpponentProposal) <= BALANCE_THRESHOLD;


        // Simple strategy: Accept if it's acceptable, otherwise try to counter or pass.
        if (proposalIsAcceptable && Math.random() < 0.6) { // Add some randomness to acceptance
            get().logAction(`AI (${aiPlayer.name}) accepts ${opponentProposal.name}.`);
            // Need to simulate the 'acceptProposal' action correctly for AI
            const finalState: FloorState = {
                ...currentFloorState,
                status: 'agreed',
                winnerCard: opponentProposal,
                committedBy: isPlayerA ? 'B' : 'A' // Committed by opponent
            };
            get().finalizeFloor(finalState);
            return;
        }

        // Try to find a better counter-proposal
        if (aiPlayer.hand.length > 0) {
            let bestCounterCard: CardData | null = null;
            let bestScoreImprovement = -Infinity; // How much better is the counter than opponent's proposal?

             // Calculate improvement relative to opponent's proposal outcome
             const opponentScoreValue = (aiRole === 'developer' ? scoreWithOpponentProposal : -scoreWithOpponentProposal);


            for (const card of aiPlayer.hand) {
                const scoreWithCounter = currentScore + card.netScoreImpact;
                let counterScoreValue = 0;
                // Reuse evaluation logic from aiMakeProposal
                 if (aiRole === 'developer') {
                     if (scoreWithCounter > 0 && scoreWithCounter <= BALANCE_THRESHOLD) counterScoreValue = scoreWithCounter;
                     else if (scoreWithCounter > BALANCE_THRESHOLD) counterScoreValue = BALANCE_THRESHOLD - (scoreWithCounter - BALANCE_THRESHOLD);
                     else counterScoreValue = scoreWithCounter;
                 } else {
                     if (scoreWithCounter < 0 && scoreWithCounter >= -BALANCE_THRESHOLD) counterScoreValue = -scoreWithCounter;
                     else if (scoreWithCounter < -BALANCE_THRESHOLD) counterScoreValue = BALANCE_THRESHOLD - (Math.abs(scoreWithCounter) - BALANCE_THRESHOLD);
                     else counterScoreValue = -scoreWithCounter;
                 }


                 const improvement = counterScoreValue - opponentScoreValue; // Direct comparison of evaluated scores

                if (improvement > bestScoreImprovement) {
                    bestScoreImprovement = improvement;
                    bestCounterCard = card;
                }
            }


            // If a significantly better counter exists, propose it
            if (bestCounterCard && bestScoreImprovement > 3) { // Threshold for countering
                 // AI makes counter-proposal
                 const updatedFloors = [...get().floors];
                 const floorIndex = updatedFloors.findIndex(f => f.floorNumber === get().currentFloor);
                 if (floorIndex === -1) return;

                 updatedFloors[floorIndex][isPlayerA ? 'proposalA' : 'proposalB'] = bestCounterCard;

                 get().logAction(`AI (${aiPlayer.name}) counter-proposes ${bestCounterCard.name} for floor ${get().currentFloor}.`);

                 // Switch back to lead player
                 const leadPlayer = get().getLeadPlayer();
                 if (!leadPlayer) return;

                 set({
                     floors: updatedFloors,
                     currentPlayerIndex: players.findIndex(p => p.id === leadPlayer.id),
                     proposalTimer: PROPOSAL_TIMER,
                     isAiTurn: leadPlayer.type === 'ai'
                 });
                 get().logAction(`${leadPlayer.name} to accept counter-offer or let AI mediate.`);
                 if (leadPlayer.type === 'ai') {
                     setTimeout(() => get().aiPlayTurn(), 1000);
                 }
                 return; // Counter-proposal made, turn ends for AI responder
            }
        }

        // If no good counter or decided not to accept, pass.
        get().logAction(`AI (${aiPlayer.name}) passes on floor ${get().currentFloor}.`);
        get().passProposal(); // AI passes
    },

    aiDecideOnCounter: () => {
        const { players, currentPlayerIndex, building } = get();
        const aiPlayer = players[currentPlayerIndex]; // This is the Lead Player AI
        const currentFloorState = get().getCurrentFloorState();
        if (!currentFloorState || !currentFloorState.proposalA || !currentFloorState.proposalB) {
             get().logAction(`AI (${aiPlayer.name}) error: Missing proposals for decision. Passing.`);
             get().passProposal();
             return;
        }


        const isPlayerA = get().isPlayerA(aiPlayer);
        const aiOriginalProposal = isPlayerA ? currentFloorState.proposalA : currentFloorState.proposalB;
        const opponentCounterProposal = isPlayerA ? currentFloorState.proposalB : currentFloorState.proposalA;

        const currentScore = building.currentNetScore;
        const scoreWithAiCard = currentScore + aiOriginalProposal.netScoreImpact;
        const scoreWithOpponentCard = currentScore + opponentCounterProposal.netScoreImpact;
        const aiRole = aiPlayer.role;

        // Evaluate which outcome is better for the AI
        let aiCardValue = 0;
        let opponentCardValue = 0;

        // Reuse evaluation logic
        if (aiRole === 'developer') {
            opponentCardValue = (scoreWithOpponentCard > BALANCE_THRESHOLD) ? BALANCE_THRESHOLD - (scoreWithOpponentCard - BALANCE_THRESHOLD) : scoreWithOpponentCard;
            aiCardValue = (scoreWithAiCard > BALANCE_THRESHOLD) ? BALANCE_THRESHOLD - (scoreWithAiCard - BALANCE_THRESHOLD) : scoreWithAiCard;
        } else {
             opponentCardValue = (scoreWithOpponentCard < -BALANCE_THRESHOLD) ? BALANCE_THRESHOLD - (Math.abs(scoreWithOpponentCard) - BALANCE_THRESHOLD) : -scoreWithOpponentCard;
             aiCardValue = (scoreWithAiCard < -BALANCE_THRESHOLD) ? BALANCE_THRESHOLD - (Math.abs(scoreWithAiCard) - BALANCE_THRESHOLD) : -scoreWithAiCard;
        }


        // Accept counter if it's better or equal (simple heuristic)
        if (opponentCardValue >= aiCardValue) {
            get().logAction(`AI (${aiPlayer.name}) accepts counter-offer of ${opponentCounterProposal.name}.`);
            // Simulate acceptProposal action
             const finalState: FloorState = {
                 ...currentFloorState,
                 status: 'agreed',
                 winnerCard: opponentCounterProposal,
                 committedBy: isPlayerA ? 'B' : 'A' // Committed by opponent
             };
             get().finalizeFloor(finalState);
        } else {
            // Reject counter-offer (let mediator decide)
            get().logAction(`AI (${aiPlayer.name}) does not accept counter-offer. AI mediator will decide.`);
            get().passProposal(); // Pass to trigger mediation
        }
    },

    runAiMediation: (floorState) => {
        const proposalA = floorState.proposalA;
        const proposalB = floorState.proposalB;
        if (!proposalA || !proposalB) return undefined; // Cannot mediate without two proposals

        const currentScore = get().building.currentNetScore;
        const remainingFloors = MAX_STORIES - floorState.floorNumber;

        // Simulate final score with each proposal
        const finalScoreWithA = get().simulateRemaining(currentScore + proposalA.netScoreImpact, remainingFloors);
        const finalScoreWithB = get().simulateRemaining(currentScore + proposalB.netScoreImpact, remainingFloors);

        // Choose the proposal resulting in a score closer to 0 (more balanced)
        return Math.abs(finalScoreWithA) <= Math.abs(finalScoreWithB) ? proposalA : proposalB;
    },

    simulateRemaining: (score, remainingFloors) => {
        // Basic projection - assumes balanced play trying to correct score
        let projectedScore = score;
        const AVG_IMPACT_PER_FLOOR = 0; // Assume net zero impact on average? Or use deck average?
         // More sophisticated: estimate based on remaining cards in deck/hands?
         // For now, simpler: Assume players try to correct towards zero.
         const CORRECTION_PER_FLOOR = 3; // Estimated average correction towards zero per floor

        for (let i = 0; i < remainingFloors; i++) {
             if (projectedScore > BALANCE_THRESHOLD / 2) {
                 projectedScore -= CORRECTION_PER_FLOOR; // Simulate community push
             } else if (projectedScore < -BALANCE_THRESHOLD / 2) {
                 projectedScore += CORRECTION_PER_FLOOR; // Simulate developer push
             }
             // If close to zero, assume random walk? projectedScore += (Math.random() * 4 - 2);
        }
        return projectedScore;
    },

    checkImpossibleFinish: () => {
        const { building, currentFloor, deck, players } = get();
        const currentScore = building.currentNetScore;
        const remainingFloors = MAX_STORIES - currentFloor;
        if (remainingFloors <= 0) return false; // Game already ended or on last floor

        // Estimate max possible score swing based on remaining cards
        let maxPossiblePositiveSwing = 0;
        let maxPossibleNegativeSwing = 0;

         // Consider cards in deck
         deck.forEach(card => {
             if (card.netScoreImpact > 0) maxPossiblePositiveSwing += card.netScoreImpact;
             else maxPossibleNegativeSwing += card.netScoreImpact;
         });
         // Consider cards in hands
         players.forEach(player => {
             player.hand.forEach(card => {
                 if (card.netScoreImpact > 0) maxPossiblePositiveSwing += card.netScoreImpact;
                 else maxPossibleNegativeSwing += card.netScoreImpact;
             });
         });

         // Divide by remaining floors for a rough per-floor estimate? Or use total?
         // Using total swing might be too extreme. Let's use a simpler max per floor estimate.
         const MAX_POS_IMPACT_PER_FLOOR = 15; // Estimate max possible positive impact on a single floor
         const MAX_NEG_IMPACT_PER_FLOOR = -15; // Estimate max possible negative impact

          maxPossiblePositiveSwing = MAX_POS_IMPACT_PER_FLOOR * remainingFloors;
          maxPossibleNegativeSwing = MAX_NEG_IMPACT_PER_FLOOR * remainingFloors;


        const bestPossibleFinalScore = currentScore + maxPossiblePositiveSwing;
        const worstPossibleFinalScore = currentScore + maxPossibleNegativeSwing; // Most negative score

        // Is the entire possible range outside the balance threshold?
        return (worstPossibleFinalScore > BALANCE_THRESHOLD || bestPossibleFinalScore < -BALANCE_THRESHOLD);
    },

    resetGame: () => {
        set({
            gameState: 'title',
            players: [], currentPlayerIndex: 0, deck: [],
            building: { ...initialBuildingState }, floors: [...initialFloorStates], currentFloor: 1,
            selectedHandCardId: null, selectedCounterCardId: null, proposalTimer: null, isAiTurn: false,
            gameLog: ["Game Reset"], gameOverReason: null, winnerMessage: null,
            telemetry: { ...initialTelemetry }, negotiationStartTime: null
        });
    },

    logAction: (message: string) => {
        set(state => ({ gameLog: [message, ...state.gameLog.slice(0, 49)] })); // Keep last 50 messages
    },

    getFloorSummary: () => {
        const { building } = get();
        // Use building.floors which correctly reflects committed/skipped states
        const floorData = Object.entries(building.floors)
            .map(([floorNum, data]) => ({
                floor: parseInt(floorNum),
                sqft: data.sqftUsed,
                uses: data.uses,
                // Ensure score exists, default to 0 if not
                 score: data.score || 0 // Use the accumulated score for the floor
            }))
            .sort((a, b) => a.floor - b.floor);

        return {
            floorData,
            totalScore: building.currentNetScore
        };
    },

     // --- COMPATIBILITY ---
     playCard: () => {
         // This function tries to mimic the old playCard logic based on current context
         const { isAiTurn, gameState, getCurrentPlayer, getLeadPlayer, getCurrentFloorState } = get();
         if (gameState !== 'playing' || isAiTurn) return;
         const currentPlayer = getCurrentPlayer();
         if (!currentPlayer || currentPlayer.type !== 'human') return;

         const isLead = currentPlayer.id === getLeadPlayer()?.id;
         const floorState = getCurrentFloorState();
         if (!floorState) return;

         const hasProposalA = !!floorState.proposalA;
         const hasProposalB = !!floorState.proposalB;

         // Determine appropriate action based on who's turn and proposal state
         if (isLead && !hasProposalA && !hasProposalB && get().selectedHandCardId) {
             get().proposeCard(); // Lead makes initial proposal
         } else if (!isLead && (hasProposalA !== hasProposalB) && get().selectedCounterCardId) { // XOR
             get().counterPropose(); // Responder counters
         } else if (!isLead && (hasProposalA !== hasProposalB) && !get().selectedCounterCardId) { // XOR
              // Responder accepts (implicit - no counter selected)
              get().acceptProposal();
         } else if (isLead && hasProposalA && hasProposalB) {
              // Lead accepts counter (implicit action)
              get().acceptProposal();
         } else {
              // No specific action selected or invalid state
              get().logAction("Select a card and action (Propose/Counter/Accept).");
         }
     },


}));