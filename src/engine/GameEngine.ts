import { 
  GameState, 
  GameAction, 
  GameEvent, 
  GameActionResult,
  Player,
  Floor,
  ValidationResult,
  CardData,
  PlayerType // Import PlayerType
} from '@/types/gameTypes';
import { 
  BALANCE_THRESHOLD, 
  MAX_STORIES, 
  RECALL_SCORE_PENALTY,
  INITIAL_HAND_SIZE,
  INITIAL_RECALL_TOKENS // Add missing import
} from '@/data/constants';

// Remove local PlayerType enum, use the imported one

export enum PlayerRole {
  Developer = "Developer",
  Community = "Community"
}

/**
 * Pure Game Engine with no side effects
 * 
 * This class contains the core game logic without any UI concerns,
 * timers, or external dependencies. All methods are pure functions
 * that accept a state and return a new state plus events.
 */
export class GameEngine {
  /**
   * Handles any game action and returns the new state + events
   */
  handleAction(state: GameState, action: GameAction): GameActionResult {
    switch (action.type) {
      case 'START_GAME':
        // Assert action type to match handleStartGame signature
        return this.handleStartGame(state, action as { type: 'START_GAME'; humanRole: PlayerRole });
        
      case 'RESET_GAME':
        return this.handleResetGame(state);
        
      case 'PROPOSE_CARD':
        return this.handleProposeCard(state, action);
        
      case 'COUNTER_PROPOSE':
        return this.handleCounterPropose(state, action);
        
      case 'ACCEPT_PROPOSAL':
        return this.handleAcceptProposal(state, action);
        
      case 'PASS_PROPOSAL':
        return this.handlePassProposal(state, action);
        
      case 'USE_RECALL':
        return this.handleUseRecall(state, action);
        
      case 'DRAW_CARD':
        return this.handleDrawCard(state, action);
        
      default:
        // Return current state with error event
        return {
          newState: state,
          events: [{ 
            type: 'ERROR',
            message: `Unknown action type: ${(action as any).type}`, 
            code: 'UNKNOWN_ACTION'
          }]
        };
    }
  }
  
  /**
   * Initialize a new game
   */
  private handleStartGame(
    state: GameState, 
    action: { type: 'START_GAME'; humanRole: PlayerRole }
  ): GameActionResult {
    // Clone the state to avoid mutations
    const newState = this.cloneState(state);
    const events: GameEvent[] = [];
    
    // Determine AI role based on human role
    const aiRole = action.humanRole === PlayerRole.Developer 
      ? PlayerRole.Community 
      : PlayerRole.Developer;
      
    // Set up players
    const players: Player[] = [
      {
        id: 'human',
        name: 'You',
        role: action.humanRole,
        type: 'human', // Use imported PlayerType
        hand: [],
        recallTokens: INITIAL_RECALL_TOKENS,
        isLeadPlayer: true, // Player A leads first few floors
      },
      {
        id: 'ai',
        name: 'AI',
        role: aiRole,
        type: 'AI', // Use imported PlayerType
        hand: [],
        recallTokens: INITIAL_RECALL_TOKENS,
        isLeadPlayer: false,
      }
    ];
    
    // Initialize floors (1 to MAX_STORIES)
    const floors: Floor[] = Array.from({ length: MAX_STORIES }, (_, i) => ({
      floorNumber: i + 1,
      status: 'pending',
    }));
    
    // Set initial game state
    newState.players = players;
    newState.floors = floors;
    newState.currentFloor = 1;
    newState.currentPlayerIndex = 0; // Human starts by default, adjust below if AI leads
    newState.currentScore = 0; // Start with neutral score
    newState.gamePhase = 'playing';
    
    // Generate events
    events.push({
      type: 'GAME_STARTED',
      humanRole: action.humanRole,
      aiRole: aiRole
    });
    
    // Determine lead player for the first floor
    const leadPlayerId = this.getLeadPlayerId(newState, 1);
    const leadPlayerIndex = this.findPlayerIndex(newState, leadPlayerId);
    newState.currentPlayerIndex = leadPlayerIndex;
    
    // Add next turn event
    const isAI = newState.players[leadPlayerIndex].type === 'AI'; 
    events.push({
      type: 'NEXT_TURN',
      playerId: leadPlayerId,
      isAI: isAI,
    });

    return { newState, events };
  }

  // Removed unreachable code block here

  /**
   * Reset the game state
   */
  private handleResetGame(state: GameState): GameActionResult {
    // Create a fresh state
    const newState: GameState = {
      players: [],
      floors: [],
      currentFloor: 0,
      currentPlayerIndex: -1,
      currentScore: 0,
      deck: [],
      gamePhase: 'title'
    };
    
    return {
      newState,
      events: [] // No events needed for reset
    };
  }
  
  /**
   * Handle a card proposal
   */
  private handleProposeCard(
    state: GameState, 
    action: { type: 'PROPOSE_CARD'; cardId: string; playerId: string }
  ): GameActionResult {
    // Clone the state
    const newState = this.cloneState(state);
    const events: GameEvent[] = [];
    
    // Validate the action
    const validation = this.validateProposeCard(state, action);
    if (!validation.isValid) {
      return {
        newState: state, // Return unchanged state
        events: [{ type: 'ERROR', message: validation.reason, code: 'INVALID_PROPOSAL' }]
      };
    }
    
    // Find the player and card
    const playerIndex = this.findPlayerIndex(state, action.playerId);
    const player = state.players[playerIndex];
    const cardIndex = player.hand.findIndex(card => card.id === action.cardId);
    const card = player.hand[cardIndex];
    
    // Remove card from player's hand
    newState.players[playerIndex].hand = [
      ...player.hand.slice(0, cardIndex),
      ...player.hand.slice(cardIndex + 1)
    ];
    
    // Determine if player is A or B
    const isPlayerA = this.isPlayerA(state, action.playerId);
    
    // Find the current floor
    const floorIndex = newState.floors.findIndex(f => f.floorNumber === state.currentFloor);
    
    // Update floor with proposal
    if (isPlayerA) {
      newState.floors[floorIndex].proposalA = card;
    } else {
      newState.floors[floorIndex].proposalB = card;
    }
    
    // Generate proposal event
    events.push({
      type: 'PROPOSAL_MADE',
      cardId: card.id,
      playerId: action.playerId,
      floor: state.currentFloor,
      cardName: card.name
    });
    
    // Switch to responding player
    const respondingPlayerId = this.getRespondingPlayerId(state, state.currentFloor);
    const respondingPlayerIndex = this.findPlayerIndex(state, respondingPlayerId);
    newState.currentPlayerIndex = respondingPlayerIndex;
    // Add next turn event
    const isAI = state.players[respondingPlayerIndex].type === 'AI'; 
    events.push({
      type: 'NEXT_TURN',
      playerId: respondingPlayerId,
      isAI: isAI
    });
    
    return { newState, events };
  }
  
  /**
   * Handle a counter proposal
   */
  private handleCounterPropose(
    state: GameState, 
    action: { type: 'COUNTER_PROPOSE'; cardId: string; playerId: string }
  ): GameActionResult {
    // Clone the state
    const newState = this.cloneState(state);
    const events: GameEvent[] = [];
    
    // Validate the action
    const validation = this.validateCounterPropose(state, action);
    if (!validation.isValid) {
      return {
        newState: state,
        events: [{ type: 'ERROR', message: validation.reason, code: 'INVALID_COUNTER' }]
      };
    }
    
    // Find the player and card
    const playerIndex = this.findPlayerIndex(state, action.playerId);
    const player = state.players[playerIndex];
    const cardIndex = player.hand.findIndex(card => card.id === action.cardId);
    const card = player.hand[cardIndex];
    
    // Remove card from player's hand
    newState.players[playerIndex].hand = [
      ...player.hand.slice(0, cardIndex),
      ...player.hand.slice(cardIndex + 1)
    ];
    
    // Determine if player is A or B
    const isPlayerA = this.isPlayerA(state, action.playerId);
    
    // Find the current floor
    const floorIndex = newState.floors.findIndex(f => f.floorNumber === state.currentFloor);
    
    // Update floor with counter proposal
    if (isPlayerA) {
      newState.floors[floorIndex].proposalA = card;
    } else {
      newState.floors[floorIndex].proposalB = card;
    }
    
    // Generate counter proposal event
    events.push({
      type: 'COUNTER_MADE',
      cardId: card.id,
      playerId: action.playerId,
      floor: state.currentFloor,
      cardName: card.name
    });
    
    // Switch back to lead player
    const leadPlayerId = this.getLeadPlayerId(state, state.currentFloor);
    const leadPlayerIndex = this.findPlayerIndex(state, leadPlayerId);
    newState.currentPlayerIndex = leadPlayerIndex;
    
    // Add next turn event
    const isAI = state.players[leadPlayerIndex].type === 'AI'; // Use imported PlayerType
    events.push({
      type: 'NEXT_TURN',
      playerId: leadPlayerId,
      isAI
    });
    
    return { newState, events };
  }

  /**
   * Handle accepting a proposal
   */
  private handleAcceptProposal(
    state: GameState, 
    action: { type: 'ACCEPT_PROPOSAL'; playerId: string }
  ): GameActionResult {
    // Clone the state
    const newState = this.cloneState(state);
    const events: GameEvent[] = [];
    
    // Validate the action
    const validation = this.validateAcceptProposal(state, action);
    if (!validation.isValid) {
      return {
        newState: state,
        events: [{ type: 'ERROR', message: validation.reason, code: 'INVALID_ACCEPTANCE' }]
      };
    }
    
    // Get current floor and player info
    const floorIndex = newState.floors.findIndex(f => f.floorNumber === state.currentFloor);
    const floor = state.floors[floorIndex];
    const playerIndex = this.findPlayerIndex(state, action.playerId);
    const player = state.players[playerIndex];
    const isPlayerA = this.isPlayerA(state, action.playerId);
    
    // Determine which proposal is being accepted
    let acceptedCard: CardData | undefined;
    let committedBy: string;
    
    const isLeadPlayer = action.playerId === this.getLeadPlayerId(state, state.currentFloor);
    const isAcceptingCounter = isLeadPlayer && !!floor.proposalA && !!floor.proposalB;
    
    if (isAcceptingCounter) {
      // Lead player accepting counter
      acceptedCard = isPlayerA ? floor.proposalB : floor.proposalA;
      committedBy = isPlayerA ? 'playerB' : 'playerA';
    } else {
      // Responding player accepting initial proposal
      acceptedCard = isPlayerA ? floor.proposalA : floor.proposalB;
      committedBy = isPlayerA ? 'playerA' : 'playerB';
    }
    
    if (!acceptedCard) {
      return {
        newState: state,
        events: [{ 
          type: 'ERROR', 
          message: 'No proposal found to accept', 
          code: 'NO_PROPOSAL'
        }]
      };
    }
    
    // Update floor with accepted card
    newState.floors[floorIndex].status = 'agreed';
    newState.floors[floorIndex].winnerCard = acceptedCard;
    newState.floors[floorIndex].committedBy = committedBy;
    
    // Update score
    newState.currentScore += acceptedCard.netScoreImpact;
    
    // Generate events
    events.push({
      type: 'PROPOSAL_ACCEPTED',
      cardId: acceptedCard.id,
      floor: state.currentFloor,
      acceptedBy: action.playerId,
      cardName: acceptedCard.name
    });
    
    events.push({
      type: 'FLOOR_FINALIZED',
      floor: state.currentFloor,
      card: acceptedCard,
      committedBy
    });
    
    // Check for game end
    const gameEndResult = this.checkGameEnd(newState);
    if (gameEndResult.isOver) {
      newState.gamePhase = 'gameOver';
      
      events.push({
        type: 'GAME_OVER',
        reason: gameEndResult.reason!,
        winner: gameEndResult.winner!,
        finalScore: newState.currentScore
      });
      
      return { newState, events };
    }
    
    // Advance to next floor
    const nextResult = this.advanceToNextFloor(newState);
    
    // Add next floor events
    events.push(...nextResult.events);
    
    return { 
      newState: nextResult.newState, 
      events 
    };
  }
  
  /**
   * Handle passing on a proposal
   */
  private handlePassProposal(
    state: GameState, 
    action: { type: 'PASS_PROPOSAL'; playerId: string }
  ): GameActionResult {
    // Clone the state
    const newState = this.cloneState(state);
    const events: GameEvent[] = [];
    
    // Validate the action
    const validation = this.validatePassProposal(state, action);
    if (!validation.isValid) {
      return {
        newState: state,
        events: [{ type: 'ERROR', message: validation.reason, code: 'INVALID_PASS' }]
      };
    }
    
    // Get current floor and player info
    const floorIndex = newState.floors.findIndex(f => f.floorNumber === state.currentFloor);
    const floor = state.floors[floorIndex];
    
    // Generate pass event
    events.push({
      type: 'PROPOSAL_PASSED',
      floor: state.currentFloor,
      passedBy: action.playerId
    });
    
    // Handle different pass scenarios
    if (floor.proposalA && floor.proposalB) {
      // Both proposals exist - need mediation
      const mediatedWinner = this.mediateProposals(
        floor.proposalA,
        floor.proposalB,
        state.currentScore
      );
      
      // Update floor with mediated winner
      newState.floors[floorIndex].status = 'agreed';
      newState.floors[floorIndex].winnerCard = mediatedWinner;
      newState.floors[floorIndex].committedBy = 'auto';
      
      // Update score
      newState.currentScore += mediatedWinner.netScoreImpact;
      
      // Generate events
      events.push({
        type: 'FLOOR_FINALIZED',
        floor: state.currentFloor,
        card: mediatedWinner,
        committedBy: 'auto'
      });
      
    } else if (floor.proposalA || floor.proposalB) {
      // Only one proposal exists - auto-accept it
      const winnerCard = floor.proposalA || floor.proposalB;
      const committedBy = floor.proposalA ? 'playerA' : 'playerB';
      
      // Update floor with winner
      newState.floors[floorIndex].status = 'agreed';
      newState.floors[floorIndex].winnerCard = winnerCard;
      newState.floors[floorIndex].committedBy = committedBy;
      
      // Update score
      newState.currentScore += winnerCard?.netScoreImpact ?? 0;
      
      // Generate events
      events.push({
        type: 'FLOOR_FINALIZED',
        floor: state.currentFloor,
        card: winnerCard,
        committedBy
      });
      
    } else {
      // No proposals - skip the floor
      newState.floors[floorIndex].status = 'skipped';
      
      // Generate events
      events.push({
        type: 'FLOOR_FINALIZED',
        floor: state.currentFloor,
        committedBy: 'none'
      });
    }
    
    // Check for game end
    const gameEndResult = this.checkGameEnd(newState);
    if (gameEndResult.isOver) {
      newState.gamePhase = 'gameOver';
      
      events.push({
        type: 'GAME_OVER',
        reason: gameEndResult.reason!,
        winner: gameEndResult.winner!,
        finalScore: newState.currentScore
      });
      
      return { newState, events };
    }
    
    // Advance to next floor
    const nextResult = this.advanceToNextFloor(newState);
    
    // Add next floor events
    events.push(...nextResult.events);
    
    return { 
      newState: nextResult.newState, 
      events 
    };
  }
  
  /**
   * Handle using a recall token
   */
  private handleUseRecall(
    state: GameState, 
    action: { type: 'USE_RECALL'; floorNumber: number; playerId: string }
  ): GameActionResult {
    // Clone the state
    const newState = this.cloneState(state);
    const events: GameEvent[] = [];
    
    // Validate the action
    const validation = this.validateUseRecall(state, action);
    if (!validation.isValid) {
      return {
        newState: state,
        events: [{ type: 'ERROR', message: validation.reason, code: 'INVALID_RECALL' }]
      };
    }
    
    // Find the player
    const playerIndex = this.findPlayerIndex(state, action.playerId);
    const player = state.players[playerIndex];
    
    // Find the floor to recall
    const floorIndex = newState.floors.findIndex(f => f.floorNumber === action.floorNumber);
    const floor = state.floors[floorIndex];
    const previousCard = floor.winnerCard;
    
    // Apply recall token cost to player
    newState.players[playerIndex].recallTokens -= 1;
    
    // Apply score penalty based on player role
    const scorePenalty = player.role === PlayerRole.Community
      ? RECALL_SCORE_PENALTY
      : -RECALL_SCORE_PENALTY;
    
    // Remove previous score impact if there was a card
    newState.currentScore -= previousCard?.netScoreImpact ?? 0;
    
    // Update the penalty
    newState.currentScore += scorePenalty;
    
    // Reset the floor state
    newState.floors[floorIndex].status = 'pending';
    newState.floors[floorIndex].proposalA = undefined;
    newState.floors[floorIndex].proposalB = undefined;
    newState.floors[floorIndex].winnerCard = undefined;
    newState.floors[floorIndex].committedBy = undefined;
    
    // Set current floor to recalled floor
    newState.currentFloor = action.floorNumber;
    
    // Generate recall event
    events.push({
      type: 'RECALL_USED',
      floor: action.floorNumber,
      playerId: action.playerId,
      previousCard
    });
    
    // Set up next turn with lead player for recalled floor
    const leadPlayerId = this.getLeadPlayerId(newState, action.floorNumber);
    const leadPlayerIndex = this.findPlayerIndex(newState, leadPlayerId); // Define leadPlayerIndex
    newState.currentPlayerIndex = leadPlayerIndex; // Set current player

    // Add next turn event
    const isAI = newState.players[leadPlayerIndex].type === 'AI'; // Use imported PlayerType
    events.push({
      type: 'NEXT_TURN',
      playerId: leadPlayerId,
      isAI: isAI
    });
    
    return { newState, events };
  }
  
  /**
   * Handle drawing a card
   */
  private handleDrawCard(
    state: GameState, 
    action: { type: 'DRAW_CARD'; playerId: string }
  ): GameActionResult {
    // Clone the state
    const newState = this.cloneState(state);
    const events: GameEvent[] = [];
    
    // Validate the action
    const validation = this.validateDrawCard(state, action);
    if (!validation.isValid) {
      return {
        newState: state,
        events: [{ type: 'ERROR', message: validation.reason, code: 'INVALID_DRAW' }]
      };
    }
    
    // Check if deck is empty
    if (state.deck.length === 0) {
      return {
        newState: state,
        events: [{ type: 'ERROR', message: 'Deck is empty', code: 'EMPTY_DECK' }]
      };
    }
    
    // Find the player
    const playerIndex = this.findPlayerIndex(state, action.playerId);
    
    // Draw a card from the deck
    const drawnCard = newState.deck.pop()!;
    
    // Add to player's hand
    newState.players[playerIndex].hand.push(drawnCard);
    
    // Generate card drawn event
    events.push({
      type: 'CARD_DRAWN',
      cardId: drawnCard.id,
      playerId: action.playerId,
      cardName: drawnCard.name
    });
    
    return { newState, events };
  }
  
  // ========== Validation Methods ==========

  /**
   * Validate a propose card action
   */
  private validateProposeCard(
    state: GameState, 
    action: { type: 'PROPOSE_CARD'; cardId: string; playerId: string }
  ): ValidationResult {
    // Game must be in playing phase
    if (state.gamePhase !== 'playing') {
      return { 
        isValid: false, 
        reason: 'Game is not in progress' 
      };
    }
    
    // Find the player
    const playerIndex = this.findPlayerIndex(state, action.playerId);
    if (playerIndex === -1) {
      return {
        isValid: false,
        reason: `Player with ID ${action.playerId} not found`
      };
    }
    
    // Check if it's the player's turn
    if (state.currentPlayerIndex !== playerIndex) {
      return {
        isValid: false,
        reason: "It's not your turn to propose"
      };
    }
    
    // Check if player has the card
    const player = state.players[playerIndex];
    const cardExists = player.hand.some(card => card.id === action.cardId);
    if (!cardExists) {
      return {
        isValid: false,
        reason: `Card ${action.cardId} is not in player's hand`
      };
    }
    
    // Check if a proposal already exists for the current floor by this player
    const floorIndex = state.floors.findIndex(f => f.floorNumber === state.currentFloor);
    const floor = state.floors[floorIndex];
    const isPlayerA = this.isPlayerA(state, action.playerId);
    if ((isPlayerA && floor.proposalA) || (!isPlayerA && floor.proposalB)) {
      return {
        isValid: false,
        reason: "You have already made a proposal for this floor"
      };
    }
    
    return { isValid: true, reason: "" };
  }
  
  /**
   * Validate a counter propose action
   */
  private validateCounterPropose(
    state: GameState, 
    action: { type: 'COUNTER_PROPOSE'; cardId: string; playerId: string }
  ): ValidationResult {
    // Game must be in playing phase
    if (state.gamePhase !== 'playing') {
      return { 
        isValid: false, 
        reason: 'Game is not in progress' 
      };
    }
    
    // Find the player
    const playerIndex = this.findPlayerIndex(state, action.playerId);
    
    if (playerIndex === -1) {
      return {
        isValid: false,
        reason: `Player with ID ${action.playerId} not found`
      };
    }
    
    const player = state.players[playerIndex];
    
    // Check if it's the player's turn
    if (state.currentPlayerIndex !== playerIndex) {
      return {
        isValid: false,
        reason: "It's not your turn to counter-propose"
      };
    }
    
    // Check if player is the responding player for the current floor
    const respondingPlayerId = this.getRespondingPlayerId(state, state.currentFloor);
    if (player.id !== respondingPlayerId) {
      return {
        isValid: false,
        reason: "Only the responding player can make a counter-proposal"
      };
    }
    
    // Check if player has the card
    const cardExists = player.hand.some(card => card.id === action.cardId);
    if (!cardExists) {
      return {
        isValid: false,
        reason: `Card ${action.cardId} not found in player's hand`
      };
    }
    
    // Check if there is an initial proposal to counter
    const floorIndex = state.floors.findIndex(f => f.floorNumber === state.currentFloor);
    const floor = state.floors[floorIndex];
    const isPlayerA = this.isPlayerA(state, action.playerId);
    
    // There must be a proposal from the other player
    if ((isPlayerA && !floor.proposalB) || (!isPlayerA && !floor.proposalA)) {
      return {
        isValid: false,
        reason: "There is no initial proposal to counter"
      };
    }
    
    // Check if this player already made a counter
    if ((isPlayerA && floor.proposalA) || (!isPlayerA && floor.proposalB)) {
      return {
        isValid: false,
        reason: "You have already made a counter-proposal for this floor"
      };
    }
    
    return { isValid: true, reason: "" };
  }
  
  /**
   * Validate an accept proposal action
   */
  private validateAcceptProposal(
    state: GameState, 
    action: { type: 'ACCEPT_PROPOSAL'; playerId: string }
  ): ValidationResult {
    // Game must be in playing phase
    if (state.gamePhase !== 'playing') {
      return { 
        isValid: false, 
        reason: 'Game is not in progress' 
      };
    }
    
    // Find the player
    const playerIndex = this.findPlayerIndex(state, action.playerId);
    
    if (playerIndex === -1) {
      return {
        isValid: false,
        reason: `Player with ID ${action.playerId} not found`
      };
    }
    
    // Check if it's the player's turn
    if (state.currentPlayerIndex !== playerIndex) {
      return {
        isValid: false,
        reason: "It's not your turn to accept"
      };
    }
    
    // Get current floor
    const floorIndex = state.floors.findIndex(f => f.floorNumber === state.currentFloor);
    if (floorIndex === -1) {
      return {
        isValid: false,
        reason: `Floor ${state.currentFloor} not found`
      };
    }
    
    const floor = state.floors[floorIndex];
    
    // Check if there's a proposal to accept
    const isPlayerA = this.isPlayerA(state, action.playerId);
    const isLeadPlayer = action.playerId === this.getLeadPlayerId(state, state.currentFloor);
    
    if (isLeadPlayer) {
      // Lead player can only accept if there's a counter-proposal
      if (!floor.proposalA || !floor.proposalB) {
        return {
          isValid: false,
          reason: "There is no counter-proposal to accept"
        };
      }
    } else {
      // Responding player can accept the initial proposal
      if ((isPlayerA && !floor.proposalA) || (!isPlayerA && !floor.proposalB)) {
        return {
          isValid: false,
          reason: "There is no proposal to accept"
        };
      }
    }
    
    return { isValid: true, reason: "" };
  }
  
  /**
   * Validate a pass proposal action
   */
  private validatePassProposal(
    state: GameState, 
    action: { type: 'PASS_PROPOSAL'; playerId: string }
  ): ValidationResult {
    // Game must be in playing phase
    if (state.gamePhase !== 'playing') {
      return { 
        isValid: false, 
        reason: 'Game is not in progress' 
      };
    }
    
    // Find the player
    const playerIndex = this.findPlayerIndex(state, action.playerId);
    
    if (playerIndex === -1) {
      return {
        isValid: false,
        reason: `Player with ID ${action.playerId} not found`
      };
    }
    
    // Check if it's the player's turn
    if (state.currentPlayerIndex !== playerIndex) {
      return {
        isValid: false,
        reason: "It's not your turn to pass"
      };
    }
    
    return { isValid: true, reason: "" };
  }
  
  /**
   * Validate a recall token action
   */
  private validateUseRecall(
    state: GameState, 
    action: { type: 'USE_RECALL'; floorNumber: number; playerId: string }
  ): ValidationResult {
    // Game must be in playing phase
    if (state.gamePhase !== 'playing') {
      return { 
        isValid: false, 
        reason: 'Game is not in progress' 
      };
    }
    
    // Find the player
    const playerIndex = this.findPlayerIndex(state, action.playerId);
    
    if (playerIndex === -1) {
      return {
        isValid: false,
        reason: `Player with ID ${action.playerId} not found`
      };
    }
    
    const player = state.players[playerIndex];
    
    // Check if player has recall tokens
    if (player.recallTokens <= 0) {
      return {
        isValid: false,
        reason: "No recall tokens remaining"
      };
    }
    
    // Check if floor is valid for recall
    if (action.floorNumber <= 0 || action.floorNumber > state.currentFloor) {
      return {
        isValid: false,
        reason: `Cannot recall floor ${action.floorNumber}: must be a completed floor`
      };
    }
    
    // Check if floor has been finalized 
    const floorIndex = state.floors.findIndex(f => f.floorNumber === action.floorNumber);
    
    if (floorIndex === -1) {
      return {
        isValid: false,
        reason: `Floor ${action.floorNumber} not found`
      };
    }
    
    const floor = state.floors[floorIndex];
    
    if (floor.status === 'pending') {
      return {
        isValid: false,
        reason: `Floor ${action.floorNumber} is not yet finalized`
      };
    }
    
    return { isValid: true, reason: "" };
  }
  
  /**
   * Validate a draw card action
   */
  private validateDrawCard(
    state: GameState, 
    action: { type: 'DRAW_CARD'; playerId: string }
  ): ValidationResult {
    // Game must be in playing phase
    if (state.gamePhase !== 'playing') {
      return { 
        isValid: false, 
        reason: 'Game is not in progress' 
      };
    }
    
    // Find the player
    const playerIndex = this.findPlayerIndex(state, action.playerId);
    
    if (playerIndex === -1) {
      return {
        isValid: false,
        reason: `Player with ID ${action.playerId} not found`
      };
    }
    
    // Check if deck has cards
    if (state.deck.length === 0) {
      return {
        isValid: false,
        reason: "Deck is empty"
      };
    }
    
    // Check if hand is full (maximum 5 cards per player)
    const player = state.players[playerIndex];
    if (player.hand.length >= 5) {
      return {
        isValid: false,
        reason: "Hand is full (maximum 5 cards)"
      };
    }
    
    return { isValid: true, reason: "" };
  }
  
  // ========== Helper Methods ==========
  
  /**
   * Advance to the next floor
   */
  private advanceToNextFloor(state: GameState): GameActionResult {
    // Clone the state
    const newState = this.cloneState(state);
    const events: GameEvent[] = [];
    
    // Find the next pending floor
    const nextFloor = this.getNextPendingFloor(state);
    
    // Check if we've reached maximum height
    if (nextFloor > MAX_STORIES) {
      // Game is over - will be handled by caller
      return { newState, events };
    }
    
    // Set the next floor
    newState.currentFloor = nextFloor;
    
    // Determine the lead player for the next floor
    const leadPlayerId = this.getLeadPlayerId(newState, nextFloor);
    const leadPlayerIndex = this.findPlayerIndex(newState, leadPlayerId);
    newState.currentPlayerIndex = leadPlayerIndex;

    // Add next turn event
    const isAI = newState.players[leadPlayerIndex].type === "AI"; // Compare with string literal "AI"
    events.push({
      type: 'NEXT_TURN',
      playerId: leadPlayerId,
      isAI
    });

    return { newState, events };
  } // Closing brace for advanceToNextFloor

  /**
   * Mediate between two proposals when both players pass
   */
  private mediateProposals(proposalA: CardData, proposalB: CardData, currentScore: number): CardData {
    // Simple mediation: choose card that brings score closer to zero
    const scoreWithA = currentScore + proposalA.netScoreImpact;
    const scoreWithB = currentScore + proposalB.netScoreImpact;
    
    return Math.abs(scoreWithA) <= Math.abs(scoreWithB) ? proposalA : proposalB;
  }
  
  /**
   * Determine the winner based on final score
   */
  private determineWinner(finalScore: number): 'developer' | 'community' | 'balanced' {
    if (Math.abs(finalScore) <= BALANCE_THRESHOLD) {
      return 'balanced';
    } else if (finalScore > BALANCE_THRESHOLD) {
      return 'developer';
    } else {
      return 'community';
    }
  }
  
  /**
   * Check if the game has ended
   */
  private checkGameEnd(state: GameState): { isOver: boolean; reason?: string; winner?: 'developer' | 'community' | 'balanced' } {
    // 1. Check max height
    if (state.currentFloor > MAX_STORIES) {
      const winner = this.determineWinner(state.currentScore);
      return { 
        isOver: true, 
        reason: 'Building complete', 
        winner 
      };
    }
    
    // 2. Check empty deck and hands
    const allHandsEmpty = state.players.every(p => p.hand.length === 0);
    if (state.deck.length === 0 && allHandsEmpty) {
      const winner = this.determineWinner(state.currentScore);
      return { 
        isOver: true, 
        reason: 'No more cards', 
        winner 
      };
    }
    
    // 3. Check for impossible finish
    const isImpossible = this.checkImpossibleFinish(state);
    if (isImpossible) {
      const winner = this.determineWinner(state.currentScore);
      return { 
        isOver: true, 
        reason: 'Balance impossible to achieve', 
        winner 
      };
    }
    
    // Game continues
    return { isOver: false };
  }
  
  /**
   * Check if it's impossible to achieve balance
   */
  private checkImpossibleFinish(state: GameState): boolean {
    const currentScore = state.currentScore;
    const remainingCards = this.getAllRemainingCards(state);
    
    // Skip check if no cards left
    if (remainingCards.length === 0) {
      return false;
    }
    
    // Analyze remaining cards
    const { maxPositiveImpact, maxNegativeImpact } = this.analyzeRemainingCards(remainingCards);
    
    // Calculate best and worst possible outcomes
    const bestPossibleFinalScore = currentScore + maxPositiveImpact;
    const worstPossibleFinalScore = currentScore + maxNegativeImpact;
    
    // Check if the entire possible range is outside the balance threshold
    return (
      worstPossibleFinalScore > BALANCE_THRESHOLD || // Too high, can't get down enough
      bestPossibleFinalScore < -BALANCE_THRESHOLD    // Too low, can't get up enough
    );
  }
  
  /**
   * Analyze the impact potential of remaining cards
   */
  private analyzeRemainingCards(cards: CardData[]) {
    // Group cards by positive/negative impact
    const positiveCards = cards
      .filter(card => card.netScoreImpact > 0)
      .sort((a, b) => b.netScoreImpact - a.netScoreImpact); // Sort descending

    const negativeCards = cards
      .filter(card => card.netScoreImpact < 0)
      .sort((a, b) => a.netScoreImpact - b.netScoreImpact); // Sort ascending
    
    // Calculate total possible impacts
    const maxPositiveImpact = positiveCards.reduce(
      (sum, card) => sum + card.netScoreImpact,
      0
    );

    const maxNegativeImpact = negativeCards.reduce(
      (sum, card) => sum + card.netScoreImpact,
      0
    );

    // Get the most powerful cards in each direction
    const topPositiveCards = positiveCards.slice(0, 5);
    const topNegativeCards = negativeCards.slice(0, 5);

    return {
      maxPositiveImpact,
      maxNegativeImpact,
      topPositiveCards,
      topNegativeCards
    };
  }
  
  /**
   * Get the next pending floor
   */
  private getNextPendingFloor(state: GameState): number {
    // Find the next floor that's pending
    for (let i = 0; i < state.floors.length; i++) {
      if (state.floors[i].status === 'pending') {
        return state.floors[i].floorNumber;
      }
    }
    
    // If no pending floors, return the next floor after the current one
    return state.currentFloor + 1;
  }
  
  /**
   * Determine the lead player for a floor
   */
  private getLeadPlayerId(state: GameState, floorNumber: number): string {
    // Determine lead player based on floor number
    // In this example, player A leads first 5 floors, player B leads next 5, etc.
    const isPlayerALead = Math.ceil(floorNumber / 5) % 2 === 1;
    
    return state.players.find(p => p.isLeadPlayer === isPlayerALead)?.id || state.players[0].id;
  }
  
  /**
   * Determine the responding player for a floor
   */
  private getRespondingPlayerId(state: GameState, floorNumber: number): string {
    const leadPlayerId = this.getLeadPlayerId(state, floorNumber);
    
    // The responding player is not the lead player
    return state.players.find(p => p.id !== leadPlayerId)?.id || state.players[1].id;
  }
  
  /**
   * Check if player is Player A (using isLeadPlayer property)
   */
  private isPlayerA(state: GameState, playerId: string): boolean {
    const player = state.players.find(p => p.id === playerId);
    return player?.isLeadPlayer || false;
  }
  
  /**
   * Get all remaining cards (deck + player hands)
   */
  private getAllRemainingCards(state: GameState): CardData[] {
    const handCards = state.players.flatMap(p => p.hand);
    return [...state.deck, ...handCards];
  }
  
  /**
   * Find player index by ID
   */
  private findPlayerIndex(state: GameState, playerId: string): number {
      return state.players.findIndex(p => p.id === playerId);
    }
  
    /**
     * Clone state to avoid mutations
     */
    private cloneState(state: GameState): GameState {
      return JSON.parse(JSON.stringify(state));
    }
  }