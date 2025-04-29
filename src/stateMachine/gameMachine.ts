// src/stateMachine/gameMachine.ts

import { createMachine } from 'xstate';

/**
 * State machine for game flow
 * 
 * This defines all possible game states and valid transitions between them,
 * making impossible states impossible and providing a clear map of the
 * game flow.
 */
export const gameMachine = createMachine({
  id: 'game',
  initial: 'title',
  states: {
    // Title screen state
    title: {
      on: {
        START_GAME: 'dealing'
      }
    },
    
    // Card dealing state
    dealing: {
      on: {
        CARDS_DEALT: 'playing',
        DEAL_ERROR: 'error'
      }
    },
    
    // Playing state with nested states for different phases
    playing: {
      initial: 'waitingForProposal',
      states: {
        // Waiting for the lead player to make a proposal
        waitingForProposal: {
          on: {
            PROPOSE: 'waitingForResponse',
            PASS: 'checkingNextFloor',
            DRAW_CARD: 'waitingForProposal' // Self-transition
          }
        },
        
        // Waiting for the responding player to act
        waitingForResponse: {
          on: {
            COUNTER: 'waitingForFinalDecision',
            ACCEPT: 'finalizingFloor',
            PASS: 'checkMediationNeeded',
            DRAW_CARD: 'waitingForResponse' // Self-transition
          }
        },
        
        // Waiting for the lead player to make final decision
        waitingForFinalDecision: {
          on: {
            ACCEPT: 'finalizingFloor',
            PASS: 'mediating',
            DRAW_CARD: 'waitingForFinalDecision' // Self-transition
          }
        },
        
        // Checking if mediation is needed
        checkMediationNeeded: {
          on: {
            MEDIATE: 'mediating',
            AUTO_ACCEPT: 'finalizingFloor',
            SKIP: 'checkingNextFloor'
          }
        },
        
        // Mediating between proposals
        mediating: {
          on: {
            MEDIATION_COMPLETE: 'finalizingFloor'
          }
        },
        
        // Finalizing a floor with an accepted proposal
        finalizingFloor: {
          on: {
            NEXT_FLOOR: 'waitingForProposal',
            GAME_OVER: '#game.gameOver'
          }
        },
        
        // Checking if there's a next floor
        checkingNextFloor: {
          on: {
            MORE_FLOORS: 'waitingForProposal',
            NO_MORE_FLOORS: '#game.gameOver',
            IMPOSSIBLE_BALANCE: '#game.gameOver'
          }
        }
      },
      
      // Global transitions for the playing state
      on: {
        RECALL: '.waitingForProposal', // Re-enter waiting state when recalling a floor
        RESIGN: 'gameOver',
        ERROR: 'error'
      }
    },
    
    // Error state
    error: {
      on: {
        RETRY: 'playing',
        RESET: 'title'
      }
    },
    
    // Game over state
    gameOver: {
      type: 'final',
      on: {
        RESTART: 'title'
      }
    }
  }
});

