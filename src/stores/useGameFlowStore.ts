// stores/useGameFlowStore.ts
// Corrected for MAX_STORIES comparison and Omit type usage.

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { CardData, PlayerRole, PlayerType, FloorStatus, Committer, GamePhase, CardInstance } from "@/data/types";
import { BALANCE_THRESHOLD, RECALL_SCORE_PENALTY, MAX_STORIES, PROPOSAL_TIMER_MS, AI_TURN_DELAY_MS } from '@/data/constants';
import { usePlayersStore, ProposalBasketItem } from './usePlayersStore';
import { useFloorStore } from './useFloorStore';
import { useBuildingStore } from './useBuildingStore';
import { useTelemetryStore } from './useTelemetryStore';
import { useAIStore } from './useAIStore';
import { logDebug, logError, logWarn, logInfo } from '@/utils/logger';

const validationFailed = (reason: string): undefined => { /* ... */ return undefined; };

export interface GameWinResult { /* ... */ 
    isOver: boolean;
    reason?: string | null;
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
    waitForPlayerAcknowledgement: boolean;

    startGame: (humanPlayerRole: PlayerRole) => void;
    resetGame: () => void;
    logAction: (message: string) => void;
    proposeCard: () => void; 
    counterPropose: () => void; 
    acceptProposal: () => void;
    passProposal: () => void;
    useRecallToken: (floorNumber: number) => void;
    advanceToNextFloor: () => void;
    drawCard: () => void; 
    playerAcknowledgeAndContinue: () => void;

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

// Corrected Omit type usage
type GameFlowDefaultState = Omit<GameFlowStoreState, 
    'startGame' | 'resetGame' | 'logAction' | 'proposeCard' | 'counterPropose' | 
    'acceptProposal' | 'passProposal' | 'useRecallToken' | 'advanceToNextFloor' | 
    'drawCard' | 'playerAcknowledgeAndContinue' | 'canAccessDeckSelector' | 
    'evaluateGameEnd' | 'determineWinner' | 'checkImpossibleFinish' | 'analyzeRemainingCards'
>;

const getDefaultState = (): GameFlowDefaultState => ({
    gamePhase: GamePhase.Title,
    isAiTurn: false,
    gameLog: ["Welcome to Urban Balance"],
    gameOverReason: null,
    winnerMessage: null,
    negotiationStartTime: null,
    proposalTimer: PROPOSAL_TIMER_MS,
    waitForPlayerAcknowledgement: false,
});

export const useGameFlowStore = create<GameFlowStoreState>()(
    immer((set, get) => ({
        ...getDefaultState(),

        startGame: (humanPlayerRole) => { /* ... (Implementation from previous correct version) ... */ 
            usePlayersStore.getState().resetToDefaults();
            useFloorStore.getState().resetFloors();
            useBuildingStore.getState().resetBuilding();
            useTelemetryStore.getState().resetTelemetry();
            usePlayersStore.getState().initializePlayers(humanPlayerRole);
            useFloorStore.getState().initializeFloors(MAX_STORIES);

            const { getCurrentPlayer, players } = usePlayersStore.getState();
            const currentPlayer = getCurrentPlayer();
            const isCurrentlyAiTurn = currentPlayer?.type === PlayerType.AI;
            const aiRole = humanPlayerRole === PlayerRole.Developer ? PlayerRole.Community : PlayerRole.Developer;
            const { baselineScore } = useBuildingStore.getState().building;
            const recallTokens = players[0]?.recallTokens ?? 0; 

            const startMessages = [
                `Game started. You: ${humanPlayerRole}. AI: ${aiRole}.`,
                `Starting score: ${baselineScore >= 0 ? '+' : ''}${baselineScore} (city climate requirements).`,
                `${players[0]?.name} is Player A (leads odd blocks).`,
                `${players[1]?.name} is Player B (leads even blocks).`,
                `Each player has ${recallTokens} recall tokens.`,
                `Goal: Keep final score within ±${BALANCE_THRESHOLD} for a balanced project.`,
                `--- Floor 1: ${currentPlayer?.name}'s Turn to Propose ---`
            ];
            
            set(state => {
                state.gamePhase = GamePhase.Playing;
                state.isAiTurn = isCurrentlyAiTurn;
                state.gameLog = [...startMessages].reverse();
                state.gameOverReason = null;
                state.winnerMessage = null;
                state.negotiationStartTime = Date.now();
                state.proposalTimer = PROPOSAL_TIMER_MS;
                state.waitForPlayerAcknowledgement = false;
            });
            startMessages.forEach(msg => logDebug(msg, 'GameFlow Start'));

            usePlayersStore.getState().dealInitialCards().then(success => {
                if (!success) { logError("Initial card dealing failed.", 'GameFlow Start'); return; }
                const currentPhase = get().gamePhase;
                const currentIsAiTurn = get().isAiTurn;
                if (currentPhase === GamePhase.Playing && currentIsAiTurn) {
                    setTimeout(() => {
                        if (get().gamePhase === GamePhase.Playing && get().isAiTurn) useAIStore.getState().aiPlayTurn();
                    }, AI_TURN_DELAY_MS);
                }
            });
        },
        resetGame: () => { /* ... (Implementation from previous correct version) ... */ 
            logDebug(`Game reset requested.`, 'GameFlow');
            const telemetryState = useTelemetryStore.getState() as any; 
            if (typeof telemetryState.clear === 'function') telemetryState.clear(); 
            set(getDefaultState());
        },
        logAction: (message) => { /* ... (Implementation from previous correct version) ... */ 
            logDebug(message, 'GameEvent');
            set(state => { state.gameLog = [`(${new Date().toLocaleTimeString()}) ${message}`, ...state.gameLog.slice(0, 99)]; });
        },
        drawCard: () => { /* ... (Implementation from previous correct version) ... */ 
            logWarn("useGameFlowStore.drawCard() called. This is likely deprecated for player actions; drawing should occur via DeckSelectorPopup or specific game events.", "GameFlow");
            return undefined;
        },
        proposeCard: () => { /* ... (Implementation from previous F.3 refactor) ... */ 
            const playerState = usePlayersStore.getState();
            const floorState = useFloorStore.getState();
            const { getCurrentPlayer, isPlayerA: checkIsPlayerA, setCurrentPlayerIndex, getRespondingPlayer, players, 
                    getCurrentProposalBasket, clearAllProposalCounts, playCardFromHand 
                  } = playerState;
            const { currentFloor } = floorState;

            if (get().gamePhase !== GamePhase.Playing || get().waitForPlayerAcknowledgement) return validationFailed('Game not active or waiting.');
            if (playerState.cardsBeingDealt) return validationFailed('Dealing in progress');
            
            const player = getCurrentPlayer();
            if (!player) return validationFailed('No current player');
            const lead = playerState.getLeadPlayer(currentFloor); 
            if (!lead || lead.id !== player.id) return validationFailed('Not your turn to propose');

            const proposalBasket = getCurrentProposalBasket(); 
            if (proposalBasket.length === 0) return validationFailed('No cards selected/counted for proposal.');

            const cardsToActuallyPropose: CardInstance[] = [];
            let proposalSuccessful = true;

            for (const item of proposalBasket) {
                for (let i = 0; i < item.count; i++) {
                    const playedCardInstance = playCardFromHand(playerState.currentPlayerIndex, item.sourceHandInstanceId);
                    if (playedCardInstance) {
                        cardsToActuallyPropose.push(playedCardInstance);
                    } else {
                        logError(`Failed to play card instance ${i+1}/${item.count} of ${item.definitionId} from stack ${item.sourceHandInstanceId}. Hand stack might be depleted unexpectedly.`, "GameFlow");
                        proposalSuccessful = false;
                        break; 
                    }
                }
                if (!proposalSuccessful) break; 
            }

            if (!proposalSuccessful || cardsToActuallyPropose.length === 0) {
                return validationFailed('Proposal failed due to inability to play all counted cards.');
            }

            floorState.setProposal(checkIsPlayerA(player), cardsToActuallyPropose); 
            const proposalSummary = cardsToActuallyPropose.map(c => c.name).join(', ');
            get().logAction(`${player.name} proposes: ${proposalSummary} (total ${cardsToActuallyPropose.length} instances) for floor ${currentFloor}.`);
            
            clearAllProposalCounts(); 

            const responder = getRespondingPlayer(currentFloor);
            if (!responder) return validationFailed('Cannot find responding player'); 
            const nextIdx = players.findIndex(p => p.id === responder.id);
            if (nextIdx === -1) return validationFailed('Cannot find index for responding player');
            
            setCurrentPlayerIndex(nextIdx);
            const isNowAiTurn = responder.type === PlayerType.AI;
            set(state => { 
                state.isAiTurn = isNowAiTurn; 
                state.negotiationStartTime = Date.now(); 
                state.proposalTimer = PROPOSAL_TIMER_MS; 
            });
            get().logAction(`${responder.name} to accept, counter, or pass.`);

            if (isNowAiTurn) {
                setTimeout(() => { if (get().gamePhase === GamePhase.Playing && get().isAiTurn && usePlayersStore.getState().currentPlayerIndex === nextIdx) useAIStore.getState().aiPlayTurn(); }, AI_TURN_DELAY_MS);
            }
        },
        counterPropose: () => { /* ... (Implementation from previous F.3 refactor) ... */ 
            const playerState = usePlayersStore.getState();
            const floorState = useFloorStore.getState();
            const { getCurrentPlayer, isPlayerA: checkIsPlayerA, setCurrentPlayerIndex, getLeadPlayer, players,
                    getCurrentCounterProposalBasket, clearAllCounterProposalCounts, playCardFromHand 
                  } = playerState;
            const { currentFloor } = floorState;

            if (get().gamePhase !== GamePhase.Playing || get().waitForPlayerAcknowledgement) return validationFailed('Game not active or waiting.');
            if (playerState.cardsBeingDealt) return validationFailed('Dealing in progress');

            const currentPlayer = getCurrentPlayer();
            if (!currentPlayer) return validationFailed('No current player');
            const responder = playerState.getRespondingPlayer(currentFloor); 
            if (!responder || currentPlayer.id !== responder.id) return validationFailed('Not your turn to counter');

            const counterBasket = getCurrentCounterProposalBasket(); 
            if (counterBasket.length === 0) return validationFailed('No cards selected/counted for counter-proposal.');

            const cardsToActuallyCounter: CardInstance[] = [];
            let counterSuccessful = true;

            for (const item of counterBasket) {
                for (let i = 0; i < item.count; i++) {
                    const playedCardInstance = playCardFromHand(playerState.currentPlayerIndex, item.sourceHandInstanceId);
                    if (playedCardInstance) {
                        cardsToActuallyCounter.push(playedCardInstance);
                    } else {
                        logError(`Failed to play card instance ${i+1}/${item.count} of ${item.definitionId} from stack ${item.sourceHandInstanceId} for counter.`, "GameFlow");
                        counterSuccessful = false;
                        break; 
                    }
                }
                if (!counterSuccessful) break;
            }

            if (!counterSuccessful || cardsToActuallyCounter.length === 0) {
                return validationFailed('Counter-proposal failed due to inability to play all counted cards.');
            }

            floorState.setProposal(checkIsPlayerA(currentPlayer), cardsToActuallyCounter);
            const counterSummary = cardsToActuallyCounter.map(c => c.name).join(', ');
            get().logAction(`${currentPlayer.name} counter-proposes: ${counterSummary} (total ${cardsToActuallyCounter.length} instances) for floor ${currentFloor}.`);
            
            clearAllCounterProposalCounts(); 

            const lead = getLeadPlayer(currentFloor);
            if (!lead) return validationFailed('Cannot find lead player');
            const nextIndex = players.findIndex(p => p.id === lead.id);
            if (nextIndex === -1) return validationFailed('Cannot find index for lead player');
            
            setCurrentPlayerIndex(nextIndex);
            const isNowAiTurn = lead.type === PlayerType.AI;
            set(state => { 
                state.isAiTurn = isNowAiTurn; 
                state.negotiationStartTime = Date.now(); 
                state.proposalTimer = PROPOSAL_TIMER_MS; 
            });
            get().logAction(`${lead.name} to accept counter-offer or pass.`);

            if (isNowAiTurn) {
                setTimeout(() => { if (get().gamePhase === GamePhase.Playing && get().isAiTurn && usePlayersStore.getState().currentPlayerIndex === nextIndex) useAIStore.getState().aiPlayTurn(); }, AI_TURN_DELAY_MS);
            }
        },
        acceptProposal: () => { /* ... (Implementation from previous correct version, ensuring winnerMessage is fixed) ... */ 
            const playerState = usePlayersStore.getState();
            const floorState = useFloorStore.getState();
            const { getCurrentPlayer, isPlayerA: checkIsPlayerA, players } = playerState; 
            const { currentFloor, getCurrentFloorState: getFloorDataHook, finalizeFloor } = floorState;

            if (get().gamePhase !== GamePhase.Playing || get().waitForPlayerAcknowledgement) return validationFailed('Game not active or waiting for acknowledgement.');
            const currentPlayer = getCurrentPlayer();
            const currentFloorData = getFloorDataHook();
            if (!currentPlayer || !currentFloorData) return validationFailed('Missing player or floor data');

            const actorIsAI = currentPlayer.type === PlayerType.AI; 

            let acceptedProposalArray: CardInstance[] | undefined; 
            let committer: Committer | null = null;
            const isCurrentPlayer_A_Role = checkIsPlayerA(currentPlayer);
            const proposalA_Instances = currentFloorData.proposalA; 
            const proposalB_Instances = currentFloorData.proposalB; 

            if (proposalA_Instances?.length && proposalB_Instances?.length) { 
                acceptedProposalArray = isCurrentPlayer_A_Role ? proposalB_Instances : proposalA_Instances; 
                committer = isCurrentPlayer_A_Role ? Committer.PlayerB : Committer.PlayerA; 
            } else if (proposalA_Instances?.length && !isCurrentPlayer_A_Role) { 
                acceptedProposalArray = proposalA_Instances; committer = Committer.PlayerA; 
            } else if (proposalB_Instances?.length && isCurrentPlayer_A_Role) { 
                acceptedProposalArray = proposalB_Instances; committer = Committer.PlayerB; 
            } else return validationFailed('No valid proposal to accept.');
            
            if (!acceptedProposalArray || acceptedProposalArray.length === 0 || committer === null) return validationFailed('Internal error: Failed to determine accepted proposal.');
            
            const primaryWinnerCard = acceptedProposalArray[0]; 
            const acceptedCardsSummary = acceptedProposalArray.map(c => c.name).join(' + ');
            get().logAction(`${currentPlayer.name} accepted proposal: [${acceptedCardsSummary}] for floor ${currentFloor}.`);
            
            finalizeFloor(currentFloor, FloorStatus.Agreed, primaryWinnerCard, committer); 

            if (get().negotiationStartTime) useTelemetryStore.getState().recordNegotiationTime(currentFloor, Math.round((Date.now() - get().negotiationStartTime!) / 1000));

            const gameEndResult = get().evaluateGameEnd();
            if (gameEndResult.isOver) {
                set(state => { 
                    state.gamePhase = GamePhase.GameOver; 
                    state.gameOverReason = gameEndResult.reason ?? null; 
                    state.winnerMessage = gameEndResult.winner === 'balanced' ? 'Project BALANCED' : `Project FAVORS ${gameEndResult.winner?.toUpperCase() ?? 'UNKNOWN'}`; 
                });
                if (gameEndResult.winner) useTelemetryStore.getState().recordWin(gameEndResult.winner);
                return;
            }

            const committerPlayer = players.find(p => (committer === Committer.PlayerA && p.id === players[0]?.id) || (committer === Committer.PlayerB && p.id === players[1]?.id));
            if (actorIsAI || (committerPlayer && committerPlayer.type === PlayerType.AI)) { 
                 logInfo("Floor finalized by AI or AI's card accepted. Waiting for player acknowledgement.", "GameFlow");
                set(state => {
                    state.waitForPlayerAcknowledgement = true;
                    state.isAiTurn = false; 
                });
                return; 
            }
            
            get().advanceToNextFloor();
        },
        passProposal: () => { /* ... (Implementation from previous correct version, ensuring winnerMessage is fixed) ... */ 
            const playerState = usePlayersStore.getState();
            const floorState = useFloorStore.getState();
            const buildingState = useBuildingStore.getState();
            const { getCurrentPlayer, players } = playerState; 
            const { currentFloor, getCurrentFloorState: getFloorDataHook, finalizeFloor } = floorState;

            if (get().gamePhase !== GamePhase.Playing || get().waitForPlayerAcknowledgement) return validationFailed('Game not active or waiting for acknowledgement.');
            const currentPlayer = getCurrentPlayer();
            if (!currentPlayer) return validationFailed('No current player');
            const currentFloorData = getFloorDataHook();
            if (!currentFloorData) return validationFailed('No current floor state');
            
            const actorIsAI = currentPlayer.type === PlayerType.AI;

            const proposalA_Instances = currentFloorData.proposalA; 
            const proposalB_Instances = currentFloorData.proposalB;
            let finalPrimaryWinnerCard: CardInstance | undefined = undefined; 
            let finalStatus: FloorStatus; 
            let finalCommitter: Committer | null = null;

            if (proposalA_Instances?.length && proposalB_Instances?.length) { 
                const primaryCardA = proposalA_Instances[0]; 
                const primaryCardB = proposalB_Instances[0];
                const currentScore = buildingState.getCurrentNetScore();
                finalPrimaryWinnerCard = Math.abs(currentScore + (primaryCardA.netScoreImpact || 0)) <= Math.abs(currentScore + (primaryCardB.netScoreImpact || 0)) ? primaryCardA : primaryCardB;
                finalCommitter = finalPrimaryWinnerCard === primaryCardA ? Committer.PlayerA : Committer.PlayerB;
                finalStatus = FloorStatus.Agreed; 
                get().logAction(`${currentPlayer.name} passes. AI mediator selected proposal with ${finalPrimaryWinnerCard.name} (from Player ${finalCommitter}).`);
            } else if (proposalA_Instances?.length) { 
                finalPrimaryWinnerCard = proposalA_Instances[0]; 
                finalCommitter = Committer.PlayerA; 
                finalStatus = FloorStatus.Agreed; 
                get().logAction(`${currentPlayer.name} passes. Proposal with ${finalPrimaryWinnerCard.name} (from Player A) automatically accepted.`); 
            } else if (proposalB_Instances?.length) { 
                finalPrimaryWinnerCard = proposalB_Instances[0]; 
                finalCommitter = Committer.PlayerB; 
                finalStatus = FloorStatus.Agreed; 
                get().logAction(`${currentPlayer.name} passes. Proposal with ${finalPrimaryWinnerCard.name} (from Player B) automatically accepted.`); 
            } else { 
                finalCommitter = Committer.None; 
                finalStatus = FloorStatus.Skipped; 
                get().logAction(`${currentPlayer.name} passes. Skipping floor ${currentFloor}.`); 
            }
            finalizeFloor(currentFloor, finalStatus, finalPrimaryWinnerCard, finalCommitter); 

            if (get().negotiationStartTime) useTelemetryStore.getState().recordNegotiationTime(currentFloor, Math.round((Date.now() - get().negotiationStartTime!) / 1000));

            const gameEndResult = get().evaluateGameEnd();
            if (gameEndResult.isOver) { 
                 set(state => { 
                    state.gamePhase = GamePhase.GameOver; 
                    state.gameOverReason = gameEndResult.reason ?? null; 
                    state.winnerMessage = gameEndResult.winner === 'balanced' ? 'Project BALANCED' : `Project FAVORS ${gameEndResult.winner?.toUpperCase() ?? 'UNKNOWN'}`; 
                });
                if (gameEndResult.winner) useTelemetryStore.getState().recordWin(gameEndResult.winner);
                return;
            }

            const committerPlayer = finalCommitter ? players.find(p => (finalCommitter === Committer.PlayerA && p.id === players[0]?.id) || (finalCommitter === Committer.PlayerB && p.id === players[1]?.id)) : null;
            const mediationOccurred = !!(proposalA_Instances?.length && proposalB_Instances?.length); 
            if (actorIsAI || (committerPlayer && committerPlayer.type === PlayerType.AI) || (mediationOccurred && !actorIsAI && finalCommitter !== Committer.None) ) { 
                logInfo("Floor finalized after pass involving AI/Mediation. Waiting for player acknowledgement.", "GameFlow");
                set(state => {
                    state.waitForPlayerAcknowledgement = true;
                    state.isAiTurn = false; 
                });
                return;
            }
            get().advanceToNextFloor();
        },
        useRecallToken: (floorNumber: number) => { /* ... (Implementation from previous correct version) ... */ 
             logDebug(`useRecallToken: floor ${floorNumber}`, 'GameFlow Recall');
            if (get().gamePhase !== GamePhase.Playing || get().waitForPlayerAcknowledgement) return validationFailed('Game not active or waiting for acknowledgement.');
            
            const playerState = usePlayersStore.getState();
            const floorStateHook = useFloorStore.getState();
            const {isAiTurn: currentIsAiTurnCheck} = get(); 

            if (currentIsAiTurnCheck) return validationFailed('AI cannot use recall tokens');
            
             try {
                const currentPlayerForRecall = playerState.getCurrentPlayer(); 
                if(!currentPlayerForRecall) return validationFailed('No current player for recall.');

                const recallValidation = floorStateHook.validateRecall(floorNumber);
                if (!recallValidation.isValid) {
                    get().logAction(recallValidation.reason); 
                    return validationFailed(`Recall validation: ${recallValidation.reason}`);
                }

                playerState.decrementRecallToken(playerState.currentPlayerIndex);
                const recalledInfo = floorStateHook.applyRecall(floorNumber);
                if (recalledInfo?.recalledCard && recalledInfo.ownerId) {
                    const ownerIndex = playerState.players.findIndex(p => p.id === recalledInfo.ownerId);
                    if (ownerIndex !== -1) playerState.addCardToHand(ownerIndex, recalledInfo.recalledCard);
                    else logWarn(`Could not find owner for recalled card.`, 'GameFlow Recall');
                }

                const buildingState = useBuildingStore.getState();
                const scorePenalty = currentPlayerForRecall.role === PlayerRole.Community ? RECALL_SCORE_PENALTY : -RECALL_SCORE_PENALTY;
                buildingState.applyScorePenalty(scorePenalty);
                get().logAction(`${currentPlayerForRecall.name} used recall. Penalty: ${scorePenalty}. New score: ${buildingState.getCurrentNetScore()}.`);
                useTelemetryStore.getState().recordRecallUsed(currentPlayerForRecall.role);
                
                floorStateHook.setCurrentFloor(floorNumber); 
                
                const leadPlayer = playerState.getLeadPlayer(floorNumber);
                if (!leadPlayer) return validationFailed('Cannot set turn for recalled floor.');
                const nextPlayerIndex = playerState.players.findIndex(p => p.id === leadPlayer.id);
                if (nextPlayerIndex === -1) return validationFailed('Cannot find lead player index post-recall.');
                
                playerState.setCurrentPlayerIndex(nextPlayerIndex);
                const isNowAiTurnAfterRecall = leadPlayer.type === PlayerType.AI;
                set(state => { 
                    state.isAiTurn = isNowAiTurnAfterRecall; 
                    state.negotiationStartTime = Date.now(); 
                    state.proposalTimer = PROPOSAL_TIMER_MS; 
                });
                get().logAction(`Returning to floor ${floorNumber}. ${leadPlayer.name} to propose.`);

                if (isNowAiTurnAfterRecall) {
                    setTimeout(() => { 
                        if (get().gamePhase === GamePhase.Playing && get().isAiTurn && useFloorStore.getState().currentFloor === floorNumber) {
                            useAIStore.getState().aiPlayTurn();
                        }
                    }, AI_TURN_DELAY_MS);
                }
            } catch (error) {
                 logError(`Error during recall: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error : undefined, 'GameFlow Recall');
                 get().logAction(`Error recalling floor ${floorNumber}.`);
            }
        },
        playerAcknowledgeAndContinue: () => { /* ... (Implementation from previous correct version, ensuring winnerMessage fixed) ... */ 
            if (!get().waitForPlayerAcknowledgement) {
                logWarn("playerAcknowledgeAndContinue called when no acknowledgement was pending.", "GameFlow");
                return;
            }
            if (get().gamePhase !== GamePhase.Playing) {
                 logWarn("playerAcknowledgeAndContinue called but game is not in Playing phase.", "GameFlow");
                 set(state => { state.waitForPlayerAcknowledgement = false; });
                 return;
            }

            logInfo("Player acknowledged. Proceeding.", "GameFlow");
            set(state => {
                state.waitForPlayerAcknowledgement = false;
            });

            const gameEndResult = get().evaluateGameEnd(); 
            if (gameEndResult.isOver) {
                set(state => { 
                    state.gamePhase = GamePhase.GameOver; 
                    state.gameOverReason = gameEndResult.reason ?? null; 
                    state.winnerMessage = gameEndResult.winner === 'balanced' ? 'Project BALANCED' : `Project FAVORS ${gameEndResult.winner?.toUpperCase() ?? 'UNKNOWN'}`; 
                });
                if (gameEndResult.winner) useTelemetryStore.getState().recordWin(gameEndResult.winner);
                return;
            }
            get().advanceToNextFloor();
        },
        advanceToNextFloor: () => { /* ... (Implementation from previous correct version) ... */ 
            if (get().waitForPlayerAcknowledgement) {
                logWarn("AdvanceToNextFloor called prematurely while waiting for player acknowledgement.", "GameFlow");
                return; 
            }
            const floorState = useFloorStore.getState();
            const nextFloor = floorState.getNextPendingFloor();
            logDebug(`Advancing. Current: ${floorState.currentFloor}, Next pending: ${nextFloor}`, 'GameFlow Advance');

            if (MAX_STORIES > 0 && nextFloor > MAX_STORIES) {
                 logWarn(`AdvanceToNextFloor: nextFloor (${nextFloor}) is beyond MAX_STORIES (${MAX_STORIES}) but game not flagged as over. This implies no more pending floors. Ending game.`, "GameFlow");
                 const finalScore = useBuildingStore.getState().getCurrentNetScore();
                 const winnerType = get().determineWinner(finalScore);
                 set(state => { 
                    state.gamePhase = GamePhase.GameOver; 
                    state.gameOverReason = "All playable floors completed or building reached max height.";
                    state.winnerMessage = winnerType === 'balanced' ? 'Project BALANCED' : `Project FAVORS ${winnerType.toUpperCase()}`;
                 });
                 useTelemetryStore.getState().recordWin(winnerType);
                return;
            }

            floorState.setCurrentFloor(nextFloor);
            const playerState = usePlayersStore.getState();
            const leadPlayer = playerState.getLeadPlayer(nextFloor);
            if (!leadPlayer) { 
                logError("Cannot advance: No lead player found for the next floor.", undefined, "GameFlow");
                set(state => { state.gamePhase = GamePhase.GameOver; state.gameOverReason = 'Error: No lead player for next floor.'; state.winnerMessage = 'Error'; });
                return; 
            }
            const nextPlayerIndex = playerState.players.findIndex(p => p.id === leadPlayer.id);
            if (nextPlayerIndex === -1) { 
                logError("Cannot advance: Lead player index not found.", undefined, "GameFlow");
                 set(state => { state.gamePhase = GamePhase.GameOver; state.gameOverReason = 'Error: Lead player index not found.'; state.winnerMessage = 'Error'; });
                return; 
            }
            
            playerState.setCurrentPlayerIndex(nextPlayerIndex);
            const isNowAiTurn = leadPlayer.type === PlayerType.AI;
            set(state => { 
                state.isAiTurn = isNowAiTurn; 
                state.negotiationStartTime = Date.now(); 
                state.proposalTimer = PROPOSAL_TIMER_MS; 
            });
            get().logAction(`Moving to floor ${nextFloor}. ${leadPlayer.name} to propose.`);

            if (isNowAiTurn) {
                setTimeout(() => { 
                    if (get().gamePhase === GamePhase.Playing && get().isAiTurn && useFloorStore.getState().currentFloor === nextFloor) {
                        useAIStore.getState().aiPlayTurn();
                    }
                }, AI_TURN_DELAY_MS);
            }
        },
        canAccessDeckSelector: () => { /* ... (Implementation from previous correct version) ... */ 
            if (get().gamePhase !== GamePhase.Playing || get().isAiTurn || get().waitForPlayerAcknowledgement) return false;
             const playerState = usePlayersStore.getState();
             if (playerState.cardsBeingDealt) return false; 
             if (!playerState.getHumanPlayer()) return false; 
             return true; 
        },
        evaluateGameEnd: () => {
            const { getCurrentNetScore } = useBuildingStore.getState();
            const { currentFloor, floors } = useFloorStore.getState();
            const { players, deckCardDefinitions } = usePlayersStore.getState();
            const finalScore = getCurrentNetScore();
            
            // Corrected: MAX_STORIES comparison for game end logic
            if (MAX_STORIES <= 0) { 
                // Game ends immediately if MAX_STORIES isn't positive, assuming setup validation or specific rule.
                return { isOver: true, reason: `Game setup with MAX_STORIES=${MAX_STORIES}. Final Score: ${finalScore}`, winner: get().determineWinner(finalScore) };
            }

            const lastFloorData = floors.find(f => f.floorNumber === MAX_STORIES);
            const lastFloorFinalized = !!lastFloorData && (lastFloorData.status === FloorStatus.Agreed || lastFloorData.status === FloorStatus.Skipped);

            if ((currentFloor > MAX_STORIES) || (currentFloor === MAX_STORIES && lastFloorFinalized)) {
                return { isOver: true, reason: `Building complete (${MAX_STORIES} floors). Final Score: ${finalScore}`, winner: get().determineWinner(finalScore) };
            }
            
            // For infinite deck, "no cards left" isn't a primary game end condition unless no player can make a move.
            // This would be better handled by checkImpossibleFinish or if AI/Player continually pass.
            // For now, removing the deck.length check specific to finite decks.
            // const noMoreCardsInFiniteDeck = deck.length === 0 && players.every(p => p.hand.length === 0);
            // if (noMoreCardsInFiniteDeck) { 
            //     return { isOver: true, reason: `No cards left (finite deck). Final Score: ${finalScore}`, winner: get().determineWinner(finalScore) };
            // }

            if (get().checkImpossibleFinish()) { // This becomes more important for game end with infinite deck
                return { isOver: true, reason: `Achieving balance is impossible. Final Score: ${finalScore}`, winner: get().determineWinner(finalScore) };
            }
            return { isOver: false };
        },
        determineWinner: (finalScore) => (Math.abs(finalScore) <= BALANCE_THRESHOLD ? 'balanced' : (finalScore > BALANCE_THRESHOLD ? 'community' : 'developer')),
        checkImpossibleFinish: () => { /* ... (This needs a robust implementation based on game rules) ... */ return false; },
        analyzeRemainingCards: (cards) => { /* ... (This needs a robust implementation) ... */ return { maxPositiveImpact: 0, maxNegativeImpact: 0, topPositiveCards: [], topNegativeCards: []}; }
    }))
);

export { GamePhase };