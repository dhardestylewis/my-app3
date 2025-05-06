// src/hooks/useGameOrchestrator.ts
//
// Thin React hook that forwards UI‑level intents to the central
// `gameOrchestrator`.  Now fully aligned with the *engine‑side*
// `GameAction` union and the canonical `PlayerRole` enum.

import { useEffect } from 'react';
import { gameOrchestrator }          from '@/orchestration/GameOrchestrator';
import { GameAction }                from '@/engine/GameEngine';
import { PlayerRole }                from '@/data/types';
import { logDebug }                  from '@/utils/logger';

export function useGameOrchestrator() {
  /* ------------------------------------------------------------------ */
  /*  housekeeping                                                       */
  /* ------------------------------------------------------------------ */
  useEffect(() => () => gameOrchestrator.cleanup(), []);

  /* ------------------------------------------------------------------ */
  /*  generic dispatcher                                                 */
  /* ------------------------------------------------------------------ */
  const dispatch = (action: GameAction) => {
    logDebug(`Dispatching action from hook: ${action.type}`, 'GameHook');

    /* START_GAME needs a complementary aiRole — add it only if missing */
    if (action.type === 'START_GAME' && action.aiRole === undefined) {
      const derivedAiRole =
        action.humanRole === PlayerRole.Developer
          ? PlayerRole.Community
          : PlayerRole.Developer;

      gameOrchestrator.dispatch({
        ...action,
        aiRole: derivedAiRole,
      });
      return;
    }

    /* everything else forwards unchanged */
    gameOrchestrator.dispatch(action);
  };

  /* ------------------------------------------------------------------ */
  /*  convenience wrappers (typed‑safe)                                  */
  /* ------------------------------------------------------------------ */
  const startGame = (humanRole: PlayerRole) => {
    /* supply both roles up‑front so the literal satisfies GameAction   */
    const aiRole =
      humanRole === PlayerRole.Developer
        ? PlayerRole.Community
        : PlayerRole.Developer;

    dispatch({ type: 'START_GAME', humanRole, aiRole });
  };

  const resetGame        = ()                             =>
    dispatch({ type: 'RESET_GAME' });

  const drawCard         = (playerId: string)             =>
    dispatch({ type: 'DRAW_CARD', playerId });

  const proposeCard      = (playerId: string,
                            instanceId: string)           =>
    dispatch({ type: 'PROPOSE_CARD', playerId, instanceId });

  const counterPropose   = (playerId: string,
                            instanceId: string)           =>
    dispatch({ type: 'COUNTER_PROPOSE', playerId, instanceId });

  const acceptProposal   = (playerId: string)             =>
    dispatch({ type: 'ACCEPT_PROPOSAL', playerId });

  const passProposal     = (playerId: string)             =>
    dispatch({ type: 'PASS_PROPOSAL',  playerId });

  const useRecallToken   = (playerId: string,
                            floorNumber: number)          =>
    dispatch({ type: 'USE_RECALL', playerId, floorNumber });

  /* ------------------------------------------------------------------ */
  /*  outward API                                                        */
  /* ------------------------------------------------------------------ */
  return {
    dispatch,
    /* high‑level helpers */
    startGame,
    resetGame,
    drawCard,
    proposeCard,
    counterPropose,
    acceptProposal,
    passProposal,
    useRecallToken,
    /* read‑only snapshot getter */
    getState: gameOrchestrator.getState.bind(gameOrchestrator),
  };
}
