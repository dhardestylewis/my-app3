// src/hooks/useGameStateMachine.ts
import { useEffect } from 'react';
import { useMachine } from '@xstate/react';
import { gameMachine } from '@/stateMachine/gameMachine';
import { gameEvents } from '@/utils/eventBus';
import { logDebug } from '@/utils/logger';

export function useGameStateMachine() {
  // [current state, send fn, underlying service]
  const [state, send, service] = useMachine(gameMachine);

  useEffect(() => {
    // wire up all bus events to state-machine sends
    const unsubs = [
      gameEvents.on('game:started'   , () => send({ type: 'START_GAME' })),
      gameEvents.on('proposal:made'  , () => send({ type: 'PROPOSE' })),
      gameEvents.on('proposal:countered', () => send({ type: 'COUNTER' })),
      gameEvents.on('proposal:accepted' , () => send({ type: 'ACCEPT' })),
      gameEvents.on('proposal:passed'   , () => send({ type: 'PASS' })),
      gameEvents.on('floor:completed'   , () => {
        const isGameOver = false; // TODO: replace with real check
        send({ type: isGameOver ? 'GAME_OVER' : 'NEXT_FLOOR' });
      }),
      gameEvents.on('floor:recalled' , () => send({ type: 'RECALL' })),
      gameEvents.on('game:ended'     , () => send({ type: 'GAME_OVER' })),
      gameEvents.on('error:game'     , () => send({ type: 'ERROR' })),
    ];

    // optional: log every transition
    const subscription = service.subscribe(s =>
      logDebug(`State machine transition: ${s.value}`, 'StateMachine')
    );

    return () => {
      unsubs.forEach(fn => fn());
      subscription.unsubscribe();
      // no need for service.stop() — useMachine cleans up automatically
    };
  }, [send, service]);

  return {
    // expose just the primitive value
    state: state.value,
    send,
    matches: state.matches.bind(state),
    can: (evt: string) => state.can({ type: evt }),
    service,
  };
}
