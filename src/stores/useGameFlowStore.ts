// src/stores/useGameFlowStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { CardData } from "@/data/types";
import { BALANCE_THRESHOLD, RECALL_SCORE_PENALTY, MAX_STORIES, MAX_HAND_SIZE, PROPOSAL_TIMER_MS as PROPOSAL_TIMER, AI_TURN_DELAY_MS } from '@/data/constants';
import { usePlayersStore, PlayerRole, PlayerType } from './usePlayersStore';
import { useFloorStore, FloorStatus, Committer } from './useFloorStore';
import { useBuildingStore } from './useBuildingStore';
import { useTelemetryStore } from './useTelemetryStore';
import { useAIStore } from './useAIStore';
import { logDebug, logError } from '@/utils/logger';
import { validationFailed, validateAll, validateGamePhase, validateNotDealing } from '@/utils/validation';

export enum GamePhase {
  Title = 'title',
  Playing = 'playing',
  GameOver = 'gameOver',
}

export interface GameWinResult {
  isOver: boolean;
  reason?: string;
  winner?: 'developer' | 'community' | 'balanced';
}

interface GameFlowStoreState {
  gamePhase: GamePhase;
  isAiTurn: boolean;
  gameLog: string[];
  gameOverReason: string | null;
  winnerMessage: string | null;
  negotiationStartTime: number | null;
  proposalTimer: number | null;

  startGame: (humanPlayerRole: PlayerRole) => void;
  resetGame: () => void;
  logAction: (message: string) => void;
  proposeCard: () => void;
  counterPropose: () => void;
  acceptProposal: () => void;
  passProposal: () => void;
  useRecallToken: (floorNumber: number) => void;
  advanceToNextFloor: () => void;
  mediateProposals: (floorNumber: number) => CardData | undefined;
  drawCard: () => void;
  toggleAiTurn: () => void;
  canAccessDeckSelector: () => boolean;

  evaluateGameEnd: () => GameWinResult;
  determineWinner: (finalScore: number) => 'developer' | 'community' | 'balanced';
  checkImpossibleFinish: () => boolean;
  analyzeRemainingCards: (cards: CardData[]) => {
    maxPositiveImpact: number;
    maxNegativeImpact: number;
    topPositiveCards: CardData[];
    topNegativeCards: CardData[];
  };
}

export const useGameFlowStore = create<GameFlowStoreState>()(
  immer((set, get) => ({
    gamePhase: GamePhase.Title,
    isAiTurn: false,
    gameLog: ["Welcome to Urban Balance"],
    gameOverReason: null,
    winnerMessage: null,
    negotiationStartTime: null,
    proposalTimer: PROPOSAL_TIMER,

    startGame: (humanPlayerRole) => {
      logDebug(`Starting new game: Player selected ${humanPlayerRole} role`, 'GameFlow');
      logDebug(`Game initialization beginning`, 'GameFlow');

      const { initializePlayers } = usePlayersStore.getState();
      const { initializeFloors } = useFloorStore.getState();
      const { resetBuilding } = useBuildingStore.getState();
      const { resetTelemetry } = useTelemetryStore.getState();

      initializePlayers(humanPlayerRole);
      initializeFloors();
      resetBuilding();
      resetTelemetry();

      const currentPlayer = usePlayersStore.getState().getCurrentPlayer();
      const isAiTurn = currentPlayer?.type === PlayerType.AI;
      const aiRole = humanPlayerRole === PlayerRole.Developer ? PlayerRole.Community : PlayerRole.Developer;
      const baselineScore = useBuildingStore.getState().building.baselineScore;

      const startMessages = [
        `Game started. You: ${humanPlayerRole}. AI: ${aiRole}.`,
        `Starting score: ${baselineScore} (city climate requirements).`,
        `You are Player ${currentPlayer?.isLeadPlayer ? 'A' : 'B'}. Player A leads floors 1-5, Player B leads floors 6-10, etc.`,
        `Each player has ${usePlayersStore.getState().players[0]?.recallTokens} recall tokens to reopen floors.`,
        `Goal: Keep final score within ±${BALANCE_THRESHOLD} for a balanced project.`,
        `--- Floor 1: ${currentPlayer?.name}'s Turn to Propose ---`
      ];
      startMessages.forEach(msg => logDebug(msg, 'GameFlow'));

      set(state => {
        state.gamePhase = GamePhase.Playing;
        state.isAiTurn = isAiTurn;
        state.gameLog = startMessages;
        state.gameOverReason = null;
        state.winnerMessage = null;
        state.negotiationStartTime = Date.now();
        state.proposalTimer = PROPOSAL_TIMER;
      });

      if (isAiTurn) {
        logDebug(`AI starts the game. Preparing AI turn...`, 'GameFlow');
        setTimeout(() => {
          if (get().gamePhase === GamePhase.Playing && get().isAiTurn) {
            logDebug(`Triggering AI turn after startup delay`, 'GameFlow');
            useAIStore.getState().aiPlayTurn();
          }
        }, AI_TURN_DELAY_MS);
      }
    },

    resetGame: () => {
      logDebug(`Game reset requested`, 'GameFlow');
      const telemetryState = useTelemetryStore.getState() as { clear?: () => void };
      if (typeof telemetryState.clear === 'function') {
        telemetryState.clear();
      }

      set(state => {
        state.gamePhase = GamePhase.Title;
        state.isAiTurn = false;
        state.gameLog = ["Welcome to Urban Balance"];
        state.gameOverReason = null;
        state.winnerMessage = null;
        state.negotiationStartTime = null;
        state.proposalTimer = null;
      });

      logDebug(`Game reset complete`, 'GameFlow');
    },

    logAction: (message) => {
      logDebug(message, 'GameEvent');
      set(state => {
        state.gameLog = [message, ...state.gameLog.slice(0, 49)];
      });
    },

    drawCard: () => {
      if (get().gamePhase !== GamePhase.Playing || get().isAiTurn) {
        logDebug(`Draw card rejected: gamePhase=${get().gamePhase}, isAiTurn=${get().isAiTurn}`, 'GameFlow');
        return;
      }

      const playersState = usePlayersStore.getState();
      if (playersState.cardsBeingDealt) {
        get().logAction('Please wait for initial cards to be dealt.');
        logDebug(`Draw card rejected: Initial dealing in progress`, 'GameFlow');
        return;
      }

      const drawnCard = playersState.drawCard();
      const currentPlayer = playersState.getCurrentPlayer();

      if (drawnCard) {
        get().logAction(`${currentPlayer?.name} drew ${drawnCard.name}`);
        logDebug(`Card drawn successfully: ${drawnCard.id} by player ${currentPlayer?.id}`, 'GameFlow');
      } else {
        get().logAction('Cannot draw: deck is empty or hand is full.');
        logDebug(`Draw card failed: deck empty or hand full by player ${currentPlayer?.id}`, 'GameFlow');
      }
    },

    proposeCard: () => {
      const playersState = usePlayersStore.getState();
      const floorState = useFloorStore.getState();
      const {
        selectedHandCardId,
        currentPlayerIndex,
        cardsBeingDealt,
        getCurrentPlayer,
        playCardFromHand,
        getLeadPlayer,
        isPlayerA,
        setCurrentPlayerIndex,
        selectHandCard
      } = playersState;
      const { currentFloor, setProposal, getCurrentFloorState } = floorState;

      if (get().gamePhase !== GamePhase.Playing) {
        logDebug(`proposeCard rejected: wrong phase ${get().gamePhase}`, 'GameFlow');
        return;
      }
      if (!selectedHandCardId) {
        logDebug(`proposeCard rejected: no card selected`, 'GameFlow');
        return;
      }
      if (cardsBeingDealt) {
        logDebug(`proposeCard rejected: dealing in progress`, 'GameFlow');
        return;
      }

      const player = getCurrentPlayer();
      if (!player) {
        logDebug(`proposeCard rejected: no current player`, 'GameFlow');
        return;
      }
      const lead = getLeadPlayer(currentFloor);
      if (!lead || lead.id !== player.id) {
        logDebug(`proposeCard rejected: not lead player`, 'GameFlow');
        return;
      }

      const hand = player.hand;
      const cardToPlay = hand.find(c => c.id === selectedHandCardId);
      if (!cardToPlay) {
        logDebug(`proposeCard rejected: card ${selectedHandCardId} not in hand`, 'GameFlow');
        return;
      }
      const cardCopy = { ...cardToPlay };

      playCardFromHand(currentPlayerIndex, selectedHandCardId);
      setProposal(isPlayerA(player), cardCopy);

      const floorSnapshot = getCurrentFloorState();
      const proposalCheck = isPlayerA(player)
        ? floorSnapshot?.proposalA
        : floorSnapshot?.proposalB;
      if (!proposalCheck) {
        logDebug(`Warning: proposal not set correctly`, 'GameFlow');
      }

      get().logAction(
        `${player.name} proposes ${cardCopy.name} for floor ${currentFloor}.`
      );
      logDebug(
        `proposeCard: player=${player.id}, card=${cardCopy.id}, floor=${currentFloor}`,
        'GameFlow'
      );

      const responder = usePlayersStore.getState().getRespondingPlayer(currentFloor);
      if (!responder) {
        logDebug(`Error: no responder for floor ${currentFloor}`, 'GameFlow');
        return;
      }
      const nextIdx = usePlayersStore.getState()
        .players.findIndex(p => p.id === responder.id);
      setCurrentPlayerIndex(nextIdx);
      selectHandCard(null);

      set(state => {
        state.isAiTurn = responder.type === PlayerType.AI;
        state.negotiationStartTime = Date.now();
        state.proposalTimer = PROPOSAL_TIMER;
      });

      get().logAction(`${responder.name} to accept, counter, or pass.`);
      logDebug(
        `Turn passed to player=${responder.id} (AI=${responder.type === PlayerType.AI})`,
        'GameFlow'
      );

      if (responder.type === PlayerType.AI) {
        setTimeout(() => {
          if (get().gamePhase === GamePhase.Playing && get().isAiTurn) {
            useAIStore.getState().aiPlayTurn();
          }
        }, 1500);
      }
    },

    counterPropose: () => {
      const playerStore = usePlayersStore.getState();
      const floorStore = useFloorStore.getState();

      const {
        currentPlayerIndex,
        selectedCounterCardId,
        getCurrentPlayer,
        getRespondingPlayer,
        playCardFromHand,
        selectCounterCard,
        setCurrentPlayerIndex,
        cardsBeingDealt,
        isPlayerA,
      } = playerStore;
      const { currentFloor, setProposal } = floorStore;

      logDebug(
        `counterPropose called: card=${selectedCounterCardId}, floor=${currentFloor}`,
        'GameFlow'
      );

      if (
        get().gamePhase !== GamePhase.Playing ||
        get().isAiTurn ||
        cardsBeingDealt ||
        !selectedCounterCardId
      ) {
        logDebug('Counter-propose rejected: invalid state or no card selected', 'GameFlow');
        return;
      }

      const currentPlayer = getCurrentPlayer();
      const responder = getRespondingPlayer(currentFloor);

      if (!currentPlayer || currentPlayer.id !== responder?.id) {
        logDebug('Counter-propose rejected: not current responder', 'GameFlow');
        return;
      }

      const playerIsA = isPlayerA(currentPlayer);
      const playerName = currentPlayer.name;
      const handCard = currentPlayer.hand.find(c => c.id === selectedCounterCardId);
      if (!handCard) {
        logDebug(`Counter-propose rejected: card ${selectedCounterCardId} not in hand`, 'GameFlow');
        return;
      }
      const cardCopy = { ...handCard };

      const played = playCardFromHand(currentPlayerIndex, selectedCounterCardId);
      if (!played) {
        logDebug(`Counter-propose rejected: failed to play ${selectedCounterCardId}`, 'GameFlow');
        return;
      }
      setProposal(playerIsA, cardCopy);

      get().logAction(
        `${playerName} counter-proposes ${cardCopy.name} for floor ${currentFloor}.`
      );
      logDebug(
        `Counter-proposal: player=${currentPlayer.id}, card=${cardCopy.id}`,
        'GameFlow'
      );

      const freshPlayers = usePlayersStore.getState();
      const lead = freshPlayers.getLeadPlayer(currentFloor);
      if (!lead) {
        logDebug(`Error: lead player missing on floor ${currentFloor}`, 'GameFlow');
        return;
      }
      const nextIndex = freshPlayers.players.findIndex(p => p.id === lead.id);
      setCurrentPlayerIndex(nextIndex);
      selectCounterCard(null);

      set(state => {
        state.isAiTurn = lead.type === PlayerType.AI;
        state.negotiationStartTime = Date.now();
        state.proposalTimer = PROPOSAL_TIMER;
      });

      get().logAction(`${lead.name} to accept counter-offer or pass.`);
      logDebug(
        `Turn passed to lead player ${lead.id} (AI=${lead.type === PlayerType.AI})`,
        'GameFlow'
      );

      if (lead.type === PlayerType.AI) {
        setTimeout(() => {
          if (get().gamePhase === GamePhase.Playing && get().isAiTurn) {
            useAIStore.getState().aiPlayTurn();
          }
        }, 1000);
      }
    },

    acceptProposal: () => {
      const playersState = usePlayersStore.getState();
      const floorState = useFloorStore.getState();
      const { getCurrentPlayer, isPlayerA, cardsBeingDealt } = playersState;
      const { currentFloor, getCurrentFloorState, finalizeFloor } = floorState;

      logDebug(`acceptProposal invoked (floor ${currentFloor})`, 'GameFlow');

      if (get().gamePhase !== GamePhase.Playing || cardsBeingDealt) {
        logDebug('acceptProposal aborted – not in playable state', 'GameFlow');
        return;
      }
      const currentPlayer = getCurrentPlayer();
      const currentFloorData = getCurrentFloorState();
      if (!currentPlayer || !currentFloorData) {
        logDebug('acceptProposal aborted – missing player or floor data', 'GameFlow');
        return;
      }

      const { proposalA, proposalB } = currentFloorData;
      let acceptedCard: CardData | undefined;
      let committer: Committer | null = null;

      if (proposalA && proposalB) {
        if (isPlayerA(currentPlayer)) {
          acceptedCard = proposalB;
          committer = Committer.PlayerB;
        } else {
          acceptedCard = proposalA;
          committer = Committer.PlayerA;
        }
      } else if (proposalA && !isPlayerA(currentPlayer)) {
        acceptedCard = proposalA;
        committer = Committer.PlayerA;
      } else if (proposalB && isPlayerA(currentPlayer)) {
        acceptedCard = proposalB;
        committer = Committer.PlayerB;
      }

      if (!acceptedCard || committer === null) {
        logDebug(`acceptProposal aborted – could not determine card to accept or committer. Player: ${currentPlayer.id}, isA: ${isPlayerA(currentPlayer)}, propA: ${!!proposalA}, propB: ${!!proposalB}`, 'GameFlow');
        return;
      }

      const acceptedCardCopy = { ...acceptedCard };

      get().logAction(`${currentPlayer.name} accepted ${acceptedCardCopy.name} for floor ${currentFloor}.`);
      logDebug(`Accepted card ${acceptedCardCopy.id} committed by ${committer}`, 'GameFlow');

      finalizeFloor(currentFloor, FloorStatus.Agreed, acceptedCardCopy, committer);

      if (get().negotiationStartTime) {
        const negotiationTime = Math.round((Date.now() - get().negotiationStartTime!) / 1000);
        useTelemetryStore.getState().recordNegotiationTime(currentFloor, negotiationTime);
        logDebug(`Negotiation (ended by accept) completed in ${negotiationTime}s`, 'GameFlow');
      }

      const gameEndResult = get().evaluateGameEnd();
      if (gameEndResult.isOver) {
        logDebug(`Game over after accept: ${gameEndResult.reason}. Winner: ${gameEndResult.winner}`, 'GameFlow');
        set(state => {
          state.gamePhase = GamePhase.GameOver;
          state.gameOverReason = gameEndResult.reason || 'Game over';
          state.winnerMessage = gameEndResult.winner === 'balanced'
            ? 'Project BALANCED'
            : `Project FAVORS ${gameEndResult.winner?.toUpperCase()}`;
        });
        if (gameEndResult.winner) {
          useTelemetryStore.getState().recordWin(gameEndResult.winner);
        }
        return;
      }

      logDebug(`Advancing to next floor after accept`, 'GameFlow');
      get().advanceToNextFloor();
    },

    passProposal: () => {
      const playersState = usePlayersStore.getState();
      const floorState = useFloorStore.getState();
      const buildingState = useBuildingStore.getState();

      const { getCurrentPlayer, cardsBeingDealt, isPlayerA } = playersState;
      const { currentFloor, getCurrentFloorState, finalizeFloor } = floorState;

      logDebug(`passProposal called: currentFloor=${currentFloor}, isAiTurn=${get().isAiTurn}`, 'GameFlow');

      if (get().gamePhase !== GamePhase.Playing || cardsBeingDealt) {
        logDebug(`Pass proposal rejected: gamePhase=${get().gamePhase}, cardsBeingDealt=${cardsBeingDealt}`, 'GameFlow');
        return;
      }

      const currentPlayer = getCurrentPlayer();
      if (!currentPlayer) {
        logDebug(`Pass proposal rejected: no current player`, 'GameFlow');
        return;
      }

      const floorData = getCurrentFloorState();
      if (!floorData) {
        logDebug(`Pass proposal rejected: no current floor state for floor ${currentFloor}`, 'GameFlow');
        return;
      }

      const proposalA = floorData.proposalA;
      const proposalB = floorData.proposalB;

      if (proposalA && proposalB) {
        get().logAction(`${currentPlayer.name} passes. AI mediator will select the fairest proposal.`);
        logDebug(`Both proposals exist on floor ${currentFloor} - initiating mediation`, 'GameFlow');

        const proposalACopy = { ...proposalA };
        const proposalBCopy = { ...proposalB };
        const currentScore = buildingState.building.baselineScore;

        logDebug(`Mediating between A (${proposalACopy.name}, impact=${proposalACopy.netScoreImpact}) and B (${proposalBCopy.name}, impact=${proposalBCopy.netScoreImpact}) at score ${currentScore}`, 'GameFlow');

        const scoreAfterA = currentScore + (proposalACopy.netScoreImpact || 0);
        const scoreAfterB = currentScore + (proposalBCopy.netScoreImpact || 0);
        const mediatedWinner = Math.abs(scoreAfterA) <= Math.abs(scoreAfterB) ? proposalACopy : proposalBCopy;

        logDebug(`Mediation selected: ${mediatedWinner.name} (results in score of ${currentScore + (mediatedWinner.netScoreImpact || 0)})`, 'GameFlow');
        get().logAction(`AI mediator selected ${mediatedWinner.name} for floor ${currentFloor}.`);

        finalizeFloor(currentFloor, FloorStatus.Agreed, mediatedWinner, Committer.Auto);

      } else if (proposalA || proposalB) {
        const existingProposal = proposalA ?? proposalB;
        const committer = proposalA ? Committer.PlayerA : Committer.PlayerB;
        const existingProposalCopy = { ...existingProposal! };

        get().logAction(`${currentPlayer.name} passes. Only one proposal exists.`);
        get().logAction(`${existingProposalCopy.name} is automatically accepted for floor ${currentFloor}.`);
        logDebug(`One proposal exists on floor ${currentFloor}, auto-accepting: ${existingProposalCopy.id} (committed by ${committer})`, 'GameFlow');

        finalizeFloor(currentFloor, FloorStatus.Agreed, existingProposalCopy, committer);

      } else {
        get().logAction(`${currentPlayer.name} passes. No proposals made.`);
        get().logAction(`Skipping floor ${currentFloor}.`);
        logDebug(`No proposals exist on floor ${currentFloor}, skipping floor`, 'GameFlow');

        finalizeFloor(currentFloor, FloorStatus.Skipped, undefined, Committer.None);
      }

      if (get().negotiationStartTime) {
        const negotiationTime = Math.round((Date.now() - get().negotiationStartTime!) / 1000);
        useTelemetryStore.getState().recordNegotiationTime(currentFloor, negotiationTime);
        logDebug(`Negotiation (ended by pass) completed in ${negotiationTime}s`, 'GameFlow');
      }

      const gameEndResult = get().evaluateGameEnd();
      if (gameEndResult.isOver) {
        logDebug(`Game over after pass: ${gameEndResult.reason}. Winner: ${gameEndResult.winner}`, 'GameFlow');
        set(state => {
          state.gamePhase = GamePhase.GameOver;
          state.gameOverReason = gameEndResult.reason || "Game over";
          state.winnerMessage = gameEndResult.winner === 'balanced'
            ? 'Project BALANCED'
            : `Project FAVORS ${gameEndResult.winner?.toUpperCase()}`;
        });
        if (gameEndResult.winner) {
          useTelemetryStore.getState().recordWin(gameEndResult.winner);
        }
        return;
      }

      logDebug(`Advancing to next floor after pass`, 'GameFlow');
      get().advanceToNextFloor();
    },

    useRecallToken: (floorNumber) => {
      logDebug(`useRecallToken invoked: floorNumber=${floorNumber}`, 'GameFlow');

      if (get().gamePhase !== GamePhase.Playing) return validationFailed('Game not active');
      if (usePlayersStore.getState().cardsBeingDealt) return validationFailed('Dealing in progress');
      if (get().isAiTurn) return validationFailed('AI cannot use recall tokens');

      const playersState = usePlayersStore.getState();
      const floorState = useFloorStore.getState();
      const buildingState = useBuildingStore.getState();

      const { getCurrentPlayer, decrementRecallToken, setCurrentPlayerIndex, selectHandCard, selectCounterCard, getLeadPlayer, players } = playersState;
      const { validateRecall, applyRecall, setCurrentFloor } = floorState;
      const { applyScorePenalty } = buildingState;

      const currentPlayer = getCurrentPlayer();
      if (!currentPlayer) return validationFailed('No current player found');

      const recallValidation = validateRecall(floorNumber);
      if (!recallValidation.isValid) {
        get().logAction(recallValidation.reason);
        return validationFailed(`Recall validation failed: ${recallValidation.reason}`);
      }

      try {
        decrementRecallToken(playersState.currentPlayerIndex);
        logDebug(`Decremented recall token for player ${currentPlayer.id}`, 'GameFlow');

        const recalledInfo = applyRecall(floorNumber);
        if (!recalledInfo || !recalledInfo.winnerCard) {
          logDebug(`Recall applied, but no winner card info returned from floor ${floorNumber}. Assuming floor wasn't 'Agreed' or card missing.`, 'GameFlow');
        } else {
          logDebug(`Successfully applied recall to floor ${floorNumber}, recalled card: ${recalledInfo.winnerCard.id}`, 'GameFlow');
        }

        const scorePenalty = currentPlayer.role === PlayerRole.Community
          ? RECALL_SCORE_PENALTY
          : -RECALL_SCORE_PENALTY;
        applyScorePenalty(scorePenalty);
        logDebug(`Applied score penalty: ${scorePenalty}`, 'GameFlow');

        const newScore = useBuildingStore.getState().building.baselineScore;
        get().logAction(
          `${currentPlayer.name} used a recall token on floor ${floorNumber}. ` +
          `Score penalty: ${scorePenalty > 0 ? '+' : ''}${scorePenalty}. ` +
          `New score: ${newScore > 0 ? '+' : ''}${newScore}`
        );
        logDebug(`Recall complete: player=${currentPlayer.id}, floor=${floorNumber}, penalty=${scorePenalty}, newScore=${newScore}`, 'GameFlow');

        useTelemetryStore.getState().recordRecallUsed(currentPlayer.role);

        setCurrentFloor(floorNumber);

        const leadPlayer = getLeadPlayer(floorNumber);
        if (!leadPlayer) {
          throw new Error(`Could not determine lead player for recalled floor ${floorNumber}`);
        }

        const nextPlayerIndex = players.findIndex(p => p.id === leadPlayer.id);
        setCurrentPlayerIndex(nextPlayerIndex);
        selectHandCard(null);
        selectCounterCard(null);

        set(state => {
          state.isAiTurn = leadPlayer.type === PlayerType.AI;
          state.negotiationStartTime = Date.now();
          state.proposalTimer = PROPOSAL_TIMER;
        });

        get().logAction(`Returning to floor ${floorNumber}. ${leadPlayer.name} to propose.`);
        logDebug(`Floor reopened: currentFloor=${floorNumber}, leadPlayer=${leadPlayer.id}, isAI=${get().isAiTurn}`, 'GameFlow');

        if (get().isAiTurn) {
          setTimeout(() => {
            if (get().gamePhase === GamePhase.Playing && get().isAiTurn) {
              logDebug(`Triggering AI turn for reopened floor ${floorNumber}`, 'GameFlow');
              useAIStore.getState().aiPlayTurn();
            }
          }, AI_TURN_DELAY_MS);
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logError(`Error during recall for floor ${floorNumber}: ${errorMessage}`, error instanceof Error ? error : new Error(errorMessage), 'GameFlow');
        get().logAction(`Error recalling floor ${floorNumber}. State might be inconsistent.`);
      }
    },

    advanceToNextFloor: () => {
      const floorState = useFloorStore.getState();
      const { currentFloor, getNextPendingFloor, setCurrentFloor } = floorState;

      const nextFloor = getNextPendingFloor();
      logDebug(`advanceToNextFloor called: currentFloor=${currentFloor}, determined nextFloor=${nextFloor}`, 'GameFlow');

      if (nextFloor > MAX_STORIES) {
        get().logAction(`Building complete! Maximum height of ${MAX_STORIES} stories reached.`);
        logDebug(`Max height reached (${MAX_STORIES}), evaluating final game state.`, 'GameFlow');

        const gameEndResult = get().evaluateGameEnd();
        logDebug(`Game ending due to max height: winner=${gameEndResult.winner}, reason=${gameEndResult.reason}`, 'GameFlow');

        set(state => {
          state.gamePhase = GamePhase.GameOver;
          state.gameOverReason = gameEndResult.reason || 'Building complete';
          state.winnerMessage = gameEndResult.winner === 'balanced'
            ? 'Project BALANCED'
            : `Project FAVORS ${gameEndResult.winner?.toUpperCase()}`;
        });

        if (gameEndResult.winner) {
          useTelemetryStore.getState().recordWin(gameEndResult.winner);
        }
        return;
      }

      setCurrentFloor(nextFloor);

      const playersState = usePlayersStore.getState();
      const leadPlayer = playersState.getLeadPlayer(nextFloor);

      if (!leadPlayer) {
        logError(`Critical Error: Could not determine lead player for floor ${nextFloor}. Ending game.`, undefined, 'GameFlow');
        set(state => {
          state.gamePhase = GamePhase.GameOver;
          state.gameOverReason = 'Internal error: Cannot determine lead player';
          state.winnerMessage = 'Error';
        });
        return;
      }

      const nextPlayerIndex = playersState.players.findIndex(p => p.id === leadPlayer.id);
      playersState.setCurrentPlayerIndex(nextPlayerIndex);
      playersState.selectHandCard(null);
      playersState.selectCounterCard(null);

      set(state => {
        state.isAiTurn = leadPlayer.type === PlayerType.AI;
        state.negotiationStartTime = Date.now();
        state.proposalTimer = PROPOSAL_TIMER;
      });

      get().logAction(`Moving to floor ${nextFloor}. ${leadPlayer.name} to propose.`);
      logDebug(`Advanced to floor ${nextFloor}: leadPlayer=${leadPlayer.id}, isAI=${get().isAiTurn}`, 'GameFlow');

      if (get().isAiTurn) {
        logDebug(`AI turn required for new floor ${nextFloor}. Scheduling AI action...`, 'GameFlow');
        setTimeout(() => {
          if (get().gamePhase === GamePhase.Playing && get().isAiTurn) {
            logDebug(`Triggering AI turn for new floor ${nextFloor}`, 'GameFlow');
            useAIStore.getState().aiPlayTurn();
          }
        }, AI_TURN_DELAY_MS);
      }
    },

    mediateProposals: (floorNumber) => {
      logDebug(`mediateProposals called for floor ${floorNumber} (Note: core logic moved to passProposal)`, 'GameFlow');

      const { getFloorState } = useFloorStore.getState();
      const { building } = useBuildingStore.getState();

      const floorState = getFloorState(floorNumber);
      if (!floorState || !floorState.proposalA || !floorState.proposalB) {
        logDebug(`Mediation failed: Missing proposals on floor ${floorNumber}`, 'GameFlow');
        return undefined;
      }

      const proposalA = { ...floorState.proposalA };
      const proposalB = { ...floorState.proposalB };
      const currentScore = building.baselineScore;

      logDebug(`Mediating between A (${proposalA.name}, impact=${proposalA.netScoreImpact}) and B (${proposalB.name}, impact=${proposalB.netScoreImpact}) at score ${currentScore}`, 'GameFlow');

      const scoreAfterA = currentScore + (proposalA.netScoreImpact || 0);
      const scoreAfterB = currentScore + (proposalB.netScoreImpact || 0);
      const winner = Math.abs(scoreAfterA) <= Math.abs(scoreAfterB) ? proposalA : proposalB;

      logDebug(`Mediation selected: ${winner.name} (results in score of ${currentScore + (winner.netScoreImpact || 0)})`, 'GameFlow');
      return winner;
    },

    toggleAiTurn: () => {
      set(state => {
        state.isAiTurn = !state.isAiTurn;
      });

      const isAi = get().isAiTurn;
      get().logAction(`Turn switched to ${isAi ? 'AI' : 'Human'}`);
      logDebug(`AI turn toggled: now ${isAi ? 'AI' : 'Human'}`, 'GameFlow');
    },

    canAccessDeckSelector: (): boolean => {
      if (get().gamePhase !== GamePhase.Playing || get().isAiTurn) {
        return false;
      }

      if (usePlayersStore.getState().cardsBeingDealt) {
        return false;
      }

      const humanPlayer = usePlayersStore.getState().getHumanPlayer();
      if (!humanPlayer) {
        return false;
      }

      if (humanPlayer.hand.length >= MAX_HAND_SIZE) {
        return false;
      }

      if (usePlayersStore.getState().deck.length === 0) {
        return false;
      }

      return true;
    },

    evaluateGameEnd: () => {
      const { getCurrentNetScore } = useBuildingStore.getState();
      const { currentFloor, floors } = useFloorStore.getState();
      const { deck, players } = usePlayersStore.getState();

      const finalScore = getCurrentNetScore();

      logDebug(`Evaluating game end: score=${finalScore}, floor=${currentFloor}, deck=${deck.length}, p1Hand=${players[0]?.hand.length}, p2Hand=${players[1]?.hand.length}`, 'GameFlow');

      const lastFloorFinalized = floors[MAX_STORIES - 1]?.status === FloorStatus.Agreed || floors[MAX_STORIES - 1]?.status === FloorStatus.Skipped;
      if (currentFloor >= MAX_STORIES && lastFloorFinalized) {
        logDebug(`Game end check: Max height (${MAX_STORIES}) reached and last floor finalized.`, 'GameFlow');
        const winner = get().determineWinner(finalScore);
        logDebug(`Result: ${winner}. Final score: ${finalScore}`, 'GameFlow');
        return { isOver: true, reason: `Building complete (${MAX_STORIES} floors)`, winner: winner };
      }

      const noMoreCards = deck.length === 0 && players.every(p => p.hand.length === 0);
      if (noMoreCards) {
        get().logAction(`No more cards left to play. Game over.`);
        logDebug(`Game end check: Deck and all hands empty.`, 'GameFlow');
        const winner = get().determineWinner(finalScore);
        logDebug(`Result: ${winner}. Final score: ${finalScore}`, 'GameFlow');
        return { isOver: true, reason: 'No cards left', winner: winner };
      }

      const isImpossible = get().checkImpossibleFinish();
      if (isImpossible) {
        get().logAction(`Impossible to reach balanced outcome. Ending game.`);
        logDebug(`Game end check: Balance impossible.`, 'GameFlow');
        const winner = get().determineWinner(finalScore);
        logDebug(`Result: ${winner}. Final score: ${finalScore}`, 'GameFlow');
        return { isOver: true, reason: 'Balance impossible', winner: winner };
      }

      logDebug(`Game end conditions not met.`, 'GameFlow');
      return { isOver: false };
    },

    determineWinner: (finalScore) => {
      if (Math.abs(finalScore) <= BALANCE_THRESHOLD) {
        logDebug(`determineWinner: Score ${finalScore} is within ±${BALANCE_THRESHOLD}. Result: balanced`, 'GameFlow');
        return 'balanced';
      } else if (finalScore > BALANCE_THRESHOLD) {
        logDebug(`determineWinner: Score ${finalScore} is > ${BALANCE_THRESHOLD}. Result: community`, 'GameFlow');
        return 'community';
      } else {
        logDebug(`determineWinner: Score ${finalScore} is < -${BALANCE_THRESHOLD}. Result: developer`, 'GameFlow');
        return 'developer';
      }
    },

    checkImpossibleFinish: () => {
      const { getCurrentNetScore } = useBuildingStore.getState();
      const { currentFloor } = useFloorStore.getState();
      const { deck, players } = usePlayersStore.getState();

      const currentScore = getCurrentNetScore();
      const floorsRemaining = MAX_STORIES - currentFloor + 1;

      if (floorsRemaining <= 0) {
        logDebug(`checkImpossibleFinish: No floors remaining (${floorsRemaining}). Balance fixed.`, 'GameFlow');
        return false;
      }

      logDebug(`Checking impossible finish: score=${currentScore}, floorsRemaining=${floorsRemaining}`, 'GameFlow');

      const remainingCards = [...deck, ...players.flatMap(player => player.hand)];
      if (remainingCards.length === 0 && floorsRemaining > 0) {
        logDebug(`checkImpossibleFinish: No cards left but ${floorsRemaining} floors remain. Balance fixed.`, 'GameFlow');
        return false;
      }

      const cardMetrics = get().analyzeRemainingCards(remainingCards);
      logDebug(`Remaining card analysis: MaxPosImpact=${cardMetrics.maxPositiveImpact}, MaxNegImpact=${cardMetrics.maxNegativeImpact}`, 'GameFlow');

      const bestPossibleScore = currentScore + cardMetrics.maxPositiveImpact;
      const worstPossibleScore = currentScore + cardMetrics.maxNegativeImpact;

      const isImpossible =
        worstPossibleScore > BALANCE_THRESHOLD ||
        bestPossibleScore < -BALANCE_THRESHOLD;

      logDebug(
        `Potential score range [${worstPossibleScore}, ${bestPossibleScore}]. ` +
        `Target balance [${-BALANCE_THRESHOLD}, ${BALANCE_THRESHOLD}]. ` +
        `Impossible: ${isImpossible}`,
        'GameFlow'
      );

      return isImpossible;
    },

    analyzeRemainingCards: (cards) => {
      logDebug(`Analyzing ${cards.length} remaining cards`, 'GameFlow');

      let maxPositiveImpact = 0;
      let maxNegativeImpact = 0;
      const positiveCards: CardData[] = [];
      const negativeCards: CardData[] = [];

      for (const card of cards) {
        const impact = card.netScoreImpact ?? 0;
        if (impact > 0) {
          maxPositiveImpact += impact;
          positiveCards.push(card);
        } else if (impact < 0) {
          maxNegativeImpact += impact;
          negativeCards.push(card);
        }
      }

      positiveCards.sort((a, b) => (b.netScoreImpact ?? 0) - (a.netScoreImpact ?? 0));
      negativeCards.sort((a, b) => (a.netScoreImpact ?? 0) - (b.netScoreImpact ?? 0));

      const topPositiveCards = positiveCards.slice(0, 5);
      const topNegativeCards = negativeCards.slice(0, 5);

      logDebug(`Analysis result: MaxPos=${maxPositiveImpact}, MaxNeg=${maxNegativeImpact}`, 'GameFlow');

      return {
        maxPositiveImpact,
        maxNegativeImpact,
        topPositiveCards,
        topNegativeCards,
      };
    }
  }))
);