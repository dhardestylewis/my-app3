// stores/useTelemetryStore.ts
// This is the version you provided. It correctly exports TelemetryStoreState.
// No changes needed in this file for the current batch of errors.

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { PlayerRole } from '@/data/types';

export interface GameTelemetry {
  negotiationTimes: { [floorNumber: number]: number };
  recallsUsed: { community: number; developer: number };
  winsByRole: { community: number; developer: number; balanced: number };
  winsByLeadBlock: { [blockNumber: number]: string }; // Winner role as string
  totalGamesPlayed: number;
  averageGameLength: number; // in seconds
}

const initialTelemetry: GameTelemetry = {
  negotiationTimes: {},
  recallsUsed: { community: 0, developer: 0 },
  winsByRole: { community: 0, developer: 0, balanced: 0 },
  winsByLeadBlock: {},
  totalGamesPlayed: 0,
  averageGameLength: 0,
};

// This is the main state interface for the store
export interface TelemetryStoreState {
  telemetry: GameTelemetry;
  gameStartTime: number | null;
  
  resetTelemetry: () => void; 
  fullResetGlobalTelemetry: () => void; 
  recordNegotiationTime: (floorNumber: number, seconds: number) => void;
  recordRecallUsed: (role: PlayerRole) => void;
  recordWin: (winner: 'community' | 'developer' | 'balanced') => void;
  recordGameStart: () => void; 
  recordGameEnd: () => void; 
  
  getAverageNegotiationTime: () => number;
  getRecallStatistics: () => { total: number; byRole: { community: number; developer: number } };
  getWinStatistics: () => { 
    total: number; 
    byRole: { 
      community: number; 
      developer: number; 
      balanced: number;
      communityPercent: number;
      developerPercent: number;
      balancedPercent: number;
    } 
  };
}

// Helper for deep copying initial state - place outside create() or import
function deepCopy<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export const useTelemetryStore = create<TelemetryStoreState>()(
  immer((set, get) => ({
    telemetry: deepCopy(initialTelemetry),
    gameStartTime: null,
    
    resetTelemetry: () => {
      set(state => {
        state.telemetry.negotiationTimes = {};
        state.telemetry.recallsUsed = { community: 0, developer: 0 };
      });
      get().recordGameStart();
    },

    fullResetGlobalTelemetry: () => {
        set(state => {
            state.telemetry = deepCopy(initialTelemetry);
            state.gameStartTime = null;
        });
    },
    
    recordGameStart: () => {
        set(state => {
            state.gameStartTime = Date.now();
        });
    },

    recordNegotiationTime: (floorNumber, seconds) => {
      set(state => {
        state.telemetry.negotiationTimes[floorNumber] = seconds;
      });
    },
    
    recordRecallUsed: (role) => {
      set(state => {
        if (role === PlayerRole.Community) {
          state.telemetry.recallsUsed.community++;
        } else if (role === PlayerRole.Developer) {
          state.telemetry.recallsUsed.developer++;
        }
      });
    },
    
    recordWin: (winner) => {
      set(state => {
        state.telemetry.winsByRole[winner]++;
      });
    },
    
    recordGameEnd: () => {
      const gameStartTime = get().gameStartTime;
      const totalGamesPreviously = get().telemetry.totalGamesPlayed; // Corrected: use 'totalGamesPreviously'
      const currentAvgLength = get().telemetry.averageGameLength;
      
      set(state => {
        if (gameStartTime) {
          const gameLengthSeconds = (Date.now() - gameStartTime) / 1000;
          // Ensure totalGamesPreviously + 1 is not zero if totalGamesPreviously was -1 (not possible with init)
          const newTotalGames = totalGamesPreviously + 1;
          state.telemetry.averageGameLength = 
            newTotalGames > 0 ? (currentAvgLength * totalGamesPreviously + gameLengthSeconds) / newTotalGames : gameLengthSeconds;
        }
        state.telemetry.totalGamesPlayed++;
        state.gameStartTime = null;
      });
    },
    
    getAverageNegotiationTime: () => { /* ... (as provided) ... */ 
        const { negotiationTimes } = get().telemetry;
        const times = Object.values(negotiationTimes);
        if (times.length === 0) return 0;
        const sum = times.reduce((acc, time) => acc + time, 0);
        return parseFloat((sum / times.length).toFixed(1));
    },
    getRecallStatistics: () => { /* ... (as provided) ... */ 
        const { recallsUsed } = get().telemetry;
        return { total: recallsUsed.community + recallsUsed.developer, byRole: { ...recallsUsed } };
    },
    getWinStatistics: () => { /* ... (as provided) ... */ 
        const { winsByRole } = get().telemetry;
        const total = winsByRole.community + winsByRole.developer + winsByRole.balanced;
        const calculatePercent = (value: number) => (total ? parseFloat(((value / total) * 100).toFixed(1)) : 0);
        return {
            total,
            byRole: { ...winsByRole, communityPercent: calculatePercent(winsByRole.community), developerPercent: calculatePercent(winsByRole.developer), balancedPercent: calculatePercent(winsByRole.balanced) }
        };
    }
  }))
);