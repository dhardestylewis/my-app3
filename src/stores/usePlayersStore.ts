// src/stores/usePlayersStore.ts
"use client";

import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { CardData } from "@/data/types";
import { MAX_RECALL_TOKENS, MAX_HAND_SIZE, CARD_DEAL_INTERVAL_MS } from "@/data/constants";
import { createInitialDeck } from "@/data/deckData";
import { shuffle } from "@/utils/shuffle";
import { logDebug, logError } from "@/utils/logger";

/* ────────────────────────────────────────────────────────── */
/* Constants                                                 */
/* ────────────────────────────────────────────────────────── */

const STARTING_HAND_SIZE = 5;
const PLAYER_A_INDEX = 0;
const PLAYER_B_INDEX = 1;
const HUMAN_PLAYER_ID = "human";
const AI_PLAYER_ID = "ai";
const LEAD_PLAYER_BLOCK_SIZE = 5; // Floors per lead player block

/* ────────────────────────────────────────────────────────── */
/* Enums / Types                                             */
/* ────────────────────────────────────────────────────────── */

export enum PlayerRole {
  Community = "community",
  Developer = "developer",
}

export enum PlayerType {
  Human = "human",
  AI = "ai",
}

export interface Player {
  id: string;
  name: string;
  type: PlayerType;
  role: PlayerRole;
  hand: CardData[];
  recallTokens: number;
  isLeadPlayer: boolean; // Represents if this player is Player A (starts leading on odd blocks)
}

export interface PlayersStoreState {
  /* State */
  players: Player[];
  currentPlayerIndex: number;
  deck: CardData[];
  selectedHandCardId: string | null;
  selectedCounterCardId: string | null;
  cardsBeingDealt: boolean; // Flag to indicate initial animated dealing is in progress
  deckVersion: number; // Increments whenever the deck changes
  currentScore: number; // Current game score

  /* Actions */
  initializePlayers: (humanPlayerRole: PlayerRole) => void;
  setCurrentPlayerIndex: (index: number) => void;
  selectHandCard: (cardId: string | null) => void;
  selectCounterCard: (cardId: string | null) => void;
  drawCard: () => CardData | undefined; // Draws for the current player during gameplay
  playCardFromHand: (playerIndex: number, cardId: string) => CardData | undefined;
  decrementRecallToken: (playerIndex: number) => void;
  dealCardToPlayer: (playerIndex: number) => CardData | undefined; // Deals one card during initial animated phase
  dealInitialCards: () => Promise<boolean>; // Promise-based initial card dealing
  completeInitialDeal: () => void; // Called by UI when initial animation finishes
  logPlayerState: () => void;
  resetToDefaults: () => void;
  
  /* New Actions */
  bumpDeckVersion: () => void; // Manually trigger a deckVersion increment
  setCurrentScore: (score: number) => void; // Update the current score

  /* Getters / Selectors */
  getCurrentPlayer: () => Player | undefined;
  getLeadPlayer: (floorNumber: number) => Player | undefined;
  getRespondingPlayer: (floorNumber: number) => Player | undefined;
  isPlayerA: (player: Player) => boolean;
  getHumanPlayer: () => Player | undefined;
  getAIPlayer: () => Player | undefined;
  getRemainingCards: () => CardData[]; // Deck + all hands (renamed from getRemainingCardsInGame)
  
  /* Optimized Lookup Methods */
  getPlayerById: (playerId: string) => Player | undefined;
  getPlayerIndex: (playerId: string) => number;
  updatePlayerMap: () => void;
}

/* ────────────────────────────────────────────────────────── */
/* Helper Utilities                                          */
/* ────────────────────────────────────────────────────────── */

/** Creates a shuffled deck of cards */
const createShuffledDeck = (): CardData[] => {
  const initialDeck = createInitialDeck();
  if (!initialDeck || initialDeck.length === 0) {
    logError("Failed to create initial deck or deck is empty.", new Error("Deck creation failed"), "PlayersStore");
    return [];
  }
  return shuffle(initialDeck);
};

/** Creates a single player object */
const createPlayer = (
  id: string,
  type: PlayerType,
  role: PlayerRole,
  isLead: boolean
): Player => ({
  id,
  name: type === PlayerType.Human ? `You (${role})` : `AI (${role})`,
  type,
  role,
  hand: [],
  recallTokens: MAX_RECALL_TOKENS,
  isLeadPlayer: isLead,
});

/** Determines player roles and which player is Player A */
const determinePlayerSetup = (humanPlayerRole: PlayerRole) => {
  const humanIsDeveloper = humanPlayerRole === PlayerRole.Developer;
  const aiRole = humanIsDeveloper ? PlayerRole.Community : PlayerRole.Developer;
  // Randomly assign who is Player A (lead player)
  const humanIsPlayerA = Math.random() < 0.5;

  const playerA = humanIsPlayerA
    ? createPlayer(HUMAN_PLAYER_ID, PlayerType.Human, humanPlayerRole, true)
    : createPlayer(AI_PLAYER_ID, PlayerType.AI, aiRole, true);

  const playerB = humanIsPlayerA
    ? createPlayer(AI_PLAYER_ID, PlayerType.AI, aiRole, false)
    : createPlayer(HUMAN_PLAYER_ID, PlayerType.Human, humanPlayerRole, false);

  return { playerA, playerB };
};

// Define the initial structure for easier reset
const initialState = {
  players: [] as Player[],
  currentPlayerIndex: PLAYER_A_INDEX,
  deck: [] as CardData[],
  selectedHandCardId: null,
  selectedCounterCardId: null,
  cardsBeingDealt: false,
  deckVersion: 0, // Initialize deckVersion
  currentScore: 0, // Initialize currentScore
};

/* ────────────────────────────────────────────────────────── */
/* Store Implementation                                      */
/* ────────────────────────────────────────────────────────── */

export const usePlayersStore = create<PlayersStoreState>()(
  immer((set, get) => {
    // Create an O(1) lookup map for players by ID
    // This is outside the store state (private) but persists between renders
    const playerMap = new Map<string, number>();
    
    // --- Internal Helper ---
    /** Safely retrieves a player by index, logging errors if invalid */
    const _getPlayerByIndex = (
      state: PlayersStoreState,
      playerIndex: number,
      actionName: string
    ): Player | null => {
      if (
        playerIndex < 0 ||
        playerIndex >= state.players.length ||
        !state.players[playerIndex]
      ) {
        logError(
          `Invalid playerIndex ${playerIndex} in ${actionName}. Total players: ${state.players.length}.`,
          "PlayersStore"
        );
        return null;
      }
      return state.players[playerIndex];
    };

    return {
      /* -------------------------------- State ------------------------------- */
      ...initialState,

      /* ----------------------------- Core Actions --------------------------- */

      /**
       * Initializes players, deck, and sets the state to start the animated deal.
       * The actual animation timing (calling dealCardToPlayer repeatedly)
       * should be handled by the UI component observing `cardsBeingDealt`.
       */
      initializePlayers: (humanPlayerRole: PlayerRole): void => {
        logDebug(`Initializing players. Human role: ${humanPlayerRole}`, "PlayersStore");

        const { playerA, playerB } = determinePlayerSetup(humanPlayerRole);
        const deck: CardData[] = createShuffledDeck();
        const players: Player[] = [playerA, playerB];

        // Player A always starts as the current player in index terms
        const initialCurrentPlayerIndex: number = PLAYER_A_INDEX;

        set((state: PlayersStoreState): void => {
          state.players = players;
          state.deck = deck;
          state.currentPlayerIndex = initialCurrentPlayerIndex; 
          state.cardsBeingDealt = true; // Signal UI to start dealing animation
          state.selectedHandCardId = null;
          state.selectedCounterCardId = null;
          state.deckVersion += 1; // Increment deckVersion on initialization
        });

        // Update the player map for O(1) lookups
        get().updatePlayerMap();

        logDebug(
          `Players initialized. Player A: ${playerA.id} (${playerA.role}), Player B: ${playerB.id} (${playerB.role}). Deck size: ${deck.length}. Current player index: ${initialCurrentPlayerIndex}. Starting deal animation sequence.`,
          "PlayersStore"
        );
        get().logPlayerState(); // Log initial state
      },

      /** 
       * Manually increments the deckVersion to trigger observers
       */
      bumpDeckVersion: (): void => {
        set((state: PlayersStoreState): void => {
          state.deckVersion += 1;
        });
        logDebug(`Deck version manually bumped to: ${get().deckVersion}`, "PlayersStore");
      },

      /**
       * Updates the current game score
       */
      setCurrentScore: (score: number): void => {
        set((state: PlayersStoreState): void => {
          state.currentScore = score;
        });
        logDebug(`Current score updated to: ${score}`, "PlayersStore");
      },

      /** 
       * Updates the internal player map for O(1) lookups
       */
      updatePlayerMap: (): void => {
        playerMap.clear();
        get().players.forEach((player: Player, index: number): void => {
          playerMap.set(player.id, index);
        });
        logDebug(`Player lookup map updated: ${playerMap.size} players indexed`, 'PlayersStore');
      },
      
      /** 
       * Gets a player by ID using O(1) lookup
       */
      getPlayerById: (playerId: string): Player | undefined => {
        const index: number | undefined = playerMap.get(playerId);
        if (index === undefined) {
          return undefined;
        }
        return get().players[index];
      },
      
      /** 
       * Gets a player's index by ID using O(1) lookup
       */
      getPlayerIndex: (playerId: string): number => {
        const index: number | undefined = playerMap.get(playerId);
        return index !== undefined ? index : -1;
      },

      /** Promise-based implementation of initial card dealing */
      dealInitialCards: async (): Promise<boolean> => {
        // Set the dealing flag
        set((state: PlayersStoreState): void => {
          state.cardsBeingDealt = true;
        });
        
        try {
          // Create promises for each card to be dealt
          const promises: Promise<void>[] = [];
          
          for (let playerIndex = 0; playerIndex < get().players.length; playerIndex++) {
            for (let cardIndex = 0; cardIndex < STARTING_HAND_SIZE; cardIndex++) {
              // Create a promise for this card deal with staggered timing
              const promise: Promise<void> = new Promise<void>((resolve: () => void): void => {
                const delay: number = (playerIndex * STARTING_HAND_SIZE + cardIndex) * CARD_DEAL_INTERVAL_MS;
                
                setTimeout((): void => {
                  // Add the card to the player's hand within the store
                  set((state: PlayersStoreState): void => {
                    // Only deal if we still have cards
                    if (state.deck.length > 0) {
                      const card: CardData = state.deck.pop()!; // Take the top card
                      state.players[playerIndex].hand.push(card);
                      state.deckVersion += 1; // Increment deckVersion on card deal
                      
                      logDebug(`Dealt ${card.name} to player ${state.players[playerIndex].name}`, 'CardDealing');
                    } else {
                      logDebug(`No more cards to deal`, 'CardDealing');
                    }
                  });
                  
                  resolve(); // Mark this card deal as complete
                }, delay);
              });
              
              promises.push(promise);
            }
          }
          
          // Wait for all cards to be dealt
          logDebug(`Waiting for ${promises.length} cards to be dealt...`, 'CardDealing');
          await Promise.all(promises);
          logDebug(`All cards dealt successfully`, 'CardDealing');
          
          return true; // Dealing completed successfully
        } catch (error: unknown) {
          logError('Error dealing cards', 'CardDealing');
          return false; // Dealing failed
        } finally {
          // Always reset the flag when done, even if there was an error
          set((state: PlayersStoreState): void => {
            state.cardsBeingDealt = false;
          });
          logDebug(`Card dealing completed, reset cardsBeingDealt flag`, 'CardDealing');
        }
      },

      /** Deals one card from the deck to the specified player's hand. Used during initial animated deal. */
      dealCardToPlayer: (playerIndex: number): CardData | undefined => {
        let dealtCard: CardData | undefined;
        set((state: PlayersStoreState): void => {
          const player: Player | null = _getPlayerByIndex(state, playerIndex, "dealCardToPlayer");
          if (!player) return; // Error logged in helper

          if (state.deck.length === 0) {
            logError(`Cannot deal card: Deck is empty.`, "PlayersStore");
            return;
          }
          // Note: No hand size check here, assuming initial deal is always <= MAX_HAND_SIZE
          
          dealtCard = state.deck.pop();
          if (dealtCard) {
            player.hand.push(dealtCard);
            state.deckVersion += 1; // Increment deckVersion on card deal
            // Minimal log here, more detailed logging might happen in UI orchestrator
            // logDebug(`Dealt ${dealtCard.id} to Player ${player.id}. Deck: ${state.deck.length}`, 'PlayersStore');
          } else {
            logError(`Deck pop returned undefined unexpectedly.`, "PlayersStore");
          }
        });
        // We return the card mainly for potential UI effects, state is already updated.
        return dealtCard; 
      },

      /** Called by the UI after the initial dealing animation sequence is complete. */
      completeInitialDeal: (): void => {
        logDebug(`Initial card deal animation sequence completed.`, "PlayersStore");
        set((state: PlayersStoreState): void => {
          state.cardsBeingDealt = false;
        });
        get().logPlayerState(); // Log state after dealing
      },

      /** Sets the index of the player whose turn it is. */
      setCurrentPlayerIndex: (index: number): void => {
        const numPlayers: number = get().players.length;
        if (index < 0 || index >= numPlayers) {
          logError(
            `Invalid index ${index} passed to setCurrentPlayerIndex. Max index: ${numPlayers - 1}`,
            "PlayersStore"
          );
          // Optionally fallback or throw, here we just log and return
          return;
        }
        const targetPlayer: Player | undefined = get().players[index];
        if (!targetPlayer) {
          logError(
            `Attempted to set current player to undefined index ${index}.`,
            "PlayersStore"
          );
          return;
        }

        logDebug(
          `Setting current player index: ${index} (Player ID: ${targetPlayer.id})`,
          "PlayersStore"
        );
        set((state: PlayersStoreState): void => {
          state.currentPlayerIndex = index;
        });
      },

      /** Selects or deselects a card in the current player's hand. */
      selectHandCard: (cardId: string | null): void => {
        logDebug(`selectHandCard called with cardId=${cardId}`, "PlayersStore");
        set((state: PlayersStoreState): void => {
          if (cardId === state.selectedHandCardId) {
            logDebug(`Deselecting hand card: ${cardId}`, "PlayersStore");
            state.selectedHandCardId = null;
          } else {
            logDebug(`Selecting hand card: ${cardId}`, "PlayersStore");
            state.selectedHandCardId = cardId;
            state.selectedCounterCardId = null; // Cannot select both
          }
        });
      },

      /** Selects or deselects a card intended for countering. */
      selectCounterCard: (cardId: string | null): void => {
        logDebug(`selectCounterCard called with cardId=${cardId}`, "PlayersStore");
        set((state: PlayersStoreState): void => {
          if (cardId === state.selectedCounterCardId) {
            logDebug(`Deselecting counter card: ${cardId}`, "PlayersStore");
            state.selectedCounterCardId = null;
          } else {
            logDebug(`Selecting counter card: ${cardId}`, "PlayersStore");
            state.selectedCounterCardId = cardId;
            state.selectedHandCardId = null; // Cannot select both
          }
        });
      },

      /** Draws a card from the deck for the current player during their turn. */
      drawCard: (): CardData | undefined => {
        let drawnCard: CardData | undefined;
        set((state: PlayersStoreState): void => {
          const player: Player | null = _getPlayerByIndex(
            state,
            state.currentPlayerIndex,
            "drawCard"
          );
          if (!player) return;

          if (state.deck.length === 0) {
            logDebug(`Cannot draw card: Deck is empty.`, "PlayersStore");
            // Optionally handle deck empty state (e.g., shuffle discard pile if exists)
            return;
          }

          if (player.hand.length >= MAX_HAND_SIZE) {
            logDebug(
              `Cannot draw card for ${player.id}: Hand is full (${player.hand.length}/${MAX_HAND_SIZE}).`,
              "PlayersStore"
            );
            return;
          }

          drawnCard = state.deck.pop();
          if (drawnCard) {
            player.hand.push(drawnCard);
            state.deckVersion += 1; // Increment deckVersion on card draw
            logDebug(`${player.name} drew ${drawnCard.name}`, "PlayersStore");
            logDebug(
              `Card drawn: ${drawnCard.id} for player ${player.id}. Deck: ${state.deck.length}. Hand: ${player.hand.length}.`,
              "PlayersStore"
            );
          }
        });
        return drawnCard;
      },

      /** Removes a specified card from a player's hand (when played). */
      playCardFromHand: (playerIndex: number, cardId: string): CardData | undefined => {
        let playedCard: CardData | undefined;
        logDebug(
          `playCardFromHand called: playerIndex=${playerIndex}, cardId=${cardId}`,
          "PlayersStore"
        );

        set((state: PlayersStoreState): void => {
          const player: Player | null = _getPlayerByIndex(state, playerIndex, "playCardFromHand");
          if (!player) return;

          const cardIndex: number = player.hand.findIndex((card: CardData) => card?.id === cardId);

          if (cardIndex === -1) {
            logError(
              `Card ${cardId} not found in player ${player.id}'s hand. Cannot play.`,
              "PlayersStore"
            );
            // Attempting to play a card not in hand might indicate a sync issue.
            get().logPlayerState(); // Log state for debugging
            return;
          }

          // Remove the card
          playedCard = player.hand.splice(cardIndex, 1)[0]; // splice returns array

          if (playedCard) {
            logDebug(`${player.name} played ${playedCard.name}`, "PlayersStore");
            logDebug(
              `Card played: ${cardId} by player ${player.id}. Hand size: ${player.hand.length}.`,
              "PlayersStore"
            );
            if (state.selectedHandCardId === cardId) state.selectedHandCardId = null;
            if (state.selectedCounterCardId === cardId) state.selectedCounterCardId = null;
          } else {
            logError(
              `Card ${cardId} found at index ${cardIndex} but was undefined upon splice for player ${player.id}.`,
              "PlayersStore"
            );
          }
        });
        return playedCard;
      },

      /** Decrements the recall token count for a specified player. */
      decrementRecallToken: (playerIndex: number): void => {
        logDebug(
          `decrementRecallToken called: playerIndex=${playerIndex}`,
          "PlayersStore"
        );
        set((state: PlayersStoreState): void => {
          const player: Player | null = _getPlayerByIndex(
            state,
            playerIndex,
            "decrementRecallToken"
          );
          if (!player) return;
        
          if (player.recallTokens > 0) {
            player.recallTokens--;
            logDebug(`${player.name} used a recall token. ${player.recallTokens} left.`, "PlayersStore");
          } else {
            logDebug(
              `Player ${player.id} tried to use recall token, but has none left.`,
              "PlayersStore"
            );
          }
        });
      },

      /* ---------------------------- Getters / Selectors ------------------------- */

      /** Returns the player object whose turn it currently is. */
      getCurrentPlayer: (): Player | undefined => {
        const { players, currentPlayerIndex } = get();
        if (
          currentPlayerIndex < 0 ||
          currentPlayerIndex >= players.length ||
          !players[currentPlayerIndex]
        ) {
          logError(
            `getCurrentPlayer: Invalid state - currentPlayerIndex=${currentPlayerIndex}, players.length=${players.length}.`,
            "PlayersStore"
          );
          // Attempt recovery: return first valid player
          const validPlayer: Player | undefined = players.find((p: Player) => !!p);
          if (validPlayer) {
            logDebug(`getCurrentPlayer: Recovered by returning player ${validPlayer.id}`, "PlayersStore");
            // Maybe force state correction? set({ currentPlayerIndex: players.indexOf(validPlayer) });
            return validPlayer;
          }
          return undefined; // No valid players
        }
        // logDebug(`getCurrentPlayer: Returning player ${players[currentPlayerIndex].id}`, 'PlayersStore'); // Can be noisy
        return players[currentPlayerIndex];
      },

      /** Determines the lead player based on the floor number. */
      getLeadPlayer: (floorNumber: number): Player | undefined => {
        const { players } = get();
        if (!players || players.length !== 2) {
          logError(`getLeadPlayer: Invalid players array state.`, "PlayersStore");
          return undefined;
        }

        // Block number determines lead (1-based index for blocks)
        const blockNumber: number = Math.ceil(floorNumber / LEAD_PLAYER_BLOCK_SIZE);
        // Player A leads on odd blocks (1, 3, 5...)
        const playerALeads: boolean = blockNumber % 2 === 1;

        // Use O(1) lookup using the internal player map
        const leadPlayerId: string = playerALeads ? 
          players[PLAYER_A_INDEX].id : 
          players[PLAYER_B_INDEX].id;
        
        const leadPlayer: Player | undefined = get().getPlayerById(leadPlayerId);

        if (!leadPlayer) {
          logError(`getLeadPlayer: Could not find lead player for floor ${floorNumber} (block ${blockNumber}, playerALeads=${playerALeads}).`, 'PlayersStore');
          // Fallback: return Player A if possible
          return players[PLAYER_A_INDEX] ?? players[PLAYER_B_INDEX];
        }
        // logDebug(`getLeadPlayer for floor ${floorNumber}: ${leadPlayer.id}`, 'PlayersStore'); // Can be noisy
        return leadPlayer;
      },

      /** Determines the responding player based on the floor number. */
      getRespondingPlayer: (floorNumber: number): Player | undefined => {
        const { players } = get();
        if (!players || players.length !== 2) {
          logError(`getRespondingPlayer: Invalid players array state.`, "PlayersStore");
          return undefined;
        }

        const leadPlayer: Player | undefined = get().getLeadPlayer(floorNumber);
        if (!leadPlayer) {
          logError(`getRespondingPlayer: Cannot determine responding player because lead player is undefined for floor ${floorNumber}.`, 'PlayersStore');
          // Fallback: return Player B if possible
          return players[PLAYER_B_INDEX] ?? players[PLAYER_A_INDEX];
        }
        
        // Use O(1) lookup to find the responding player
        const respondingPlayerId: string = leadPlayer.id === players[PLAYER_A_INDEX].id ? 
          players[PLAYER_B_INDEX].id : 
          players[PLAYER_A_INDEX].id;

        const respondingPlayer: Player | undefined = get().getPlayerById(respondingPlayerId);

        if (!respondingPlayer) {
          logError(`getRespondingPlayer: Could not find responding player (opposite of ${leadPlayer.id}).`, 'PlayersStore');
          // Fallback logic might depend on game rules, returning the other player index is safest
          return players[PLAYER_A_INDEX]?.id === leadPlayer.id ? players[PLAYER_B_INDEX] : players[PLAYER_A_INDEX];
        }
        // logDebug(`getRespondingPlayer for floor ${floorNumber}: ${respondingPlayer.id}`, 'PlayersStore'); // Can be noisy
        return respondingPlayer;
      },

      /** Checks if the given player is Player A (index 0). */
      isPlayerA: (player: Player): boolean => {
        const { players } = get();
        if (!players || players.length === 0 || !player) {
          logError(`isPlayerA check failed: Invalid arguments or state.`, "PlayersStore");
          return false;
        }
        // Check based on the player at index 0, assumes players array is stable [A, B]
        return players[PLAYER_A_INDEX]?.id === player.id;
      },

      /** Gets the human player object */
      getHumanPlayer: (): Player | undefined => {
        const { players } = get();
        return players.find((p: Player) => p?.type === PlayerType.Human);
      },

      /** Gets the AI player object */
      getAIPlayer: (): Player | undefined => {
        const { players } = get();
        return players.find((p: Player) => p?.type === PlayerType.AI);
      },

      /** Returns a combined list of cards currently in the deck and all player hands. */
      getRemainingCards: (): CardData[] => {
        const { deck, players } = get();

        if (!Array.isArray(deck) || !Array.isArray(players)) {
          logError(`getRemainingCards: Invalid state - deck or players not arrays.`, 'PlayersStore');
          return [];
        }

        const cardsInHands: CardData[] = players.reduce((acc: CardData[], player: Player): CardData[] => {
          if (player && Array.isArray(player.hand)) {
            return acc.concat(player.hand);
          }
          return acc;
        }, []);

        const remaining: CardData[] = [...deck, ...cardsInHands];
        // logDebug(`getRemainingCards: ${remaining.length} total (${deck.length} deck, ${cardsInHands.length} hands)`, 'PlayersStore');
        return remaining;
      },

      /* -------------------------------- Debug ------------------------------- */
      logPlayerState: (): void => {
        const s: PlayersStoreState = get();
        logDebug("-------- PLAYER STATE DEBUG --------", "PlayersStore");
        logDebug(`Players Count: ${s.players?.length ?? 'undefined'}`, "PlayersStore");
        logDebug(`Current Player Index: ${s.currentPlayerIndex}`, "PlayersStore");
        logDebug(`Cards Being Dealt: ${s.cardsBeingDealt}`, "PlayersStore");
        logDebug(`Selected Hand Card: ${s.selectedHandCardId ?? 'none'}`, "PlayersStore");
        logDebug(`Selected Counter Card: ${s.selectedCounterCardId ?? 'none'}`, "PlayersStore");
        logDebug(`Deck Size: ${s.deck?.length ?? 'undefined'}`, "PlayersStore");
        logDebug(`Deck Version: ${s.deckVersion}`, "PlayersStore");
        logDebug(`Current Score: ${s.currentScore}`, "PlayersStore");
        s.players?.forEach((p: Player, i: number): void =>
          logDebug(
            `Player ${i}: ID=${p?.id ?? 'N/A'} Name=${p?.name ?? 'N/A'} Role=${p?.role ?? 'N/A'} Type=${p?.type ?? 'N/A'} Hand=${p?.hand?.length ?? 'N/A'} Tokens=${p?.recallTokens ?? 'N/A'} IsLead=${p?.isLeadPlayer ?? 'N/A'}`,
            "PlayersStore"
          )
        );
        logDebug("------------------------------------", "PlayersStore");
      },

      /* ------------------------ 💥 Emergency Reset ------------------------- */
      /** Resets the store to a default initial state (Human Developer vs AI Community, Player A random). */
      resetToDefaults: (): void => {
        logDebug("[PlayerAction] !!! Emergency reset of player store triggered !!!", "PlayersStore");
        logDebug("Resetting player store to default initial state.", "PlayersStore");
        
        if (get().cardsBeingDealt) {
          logDebug("Reset called while dealing was in progress, forcing completion flag.", "PlayersStore");
          set((state: PlayersStoreState): void => {
            state.cardsBeingDealt = false;
          });
        }
        
        set((state: PlayersStoreState): void => {
          Object.assign(state, initialState);
        });
        logDebug("Player store reset complete.", "PlayersStore");
      },
    };
  })
);