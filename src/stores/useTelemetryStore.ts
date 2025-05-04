// stores/useTelemetryStore.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { PlayerRole } from './usePlayersStore';

export interface GameTelemetry {
  negotiationTimes: { [floorNumber: number]: number };
  recallsUsed: { community: number; developer: number };
  winsByRole: { community: number; developer: number; balanced: number };
  winsByLeadBlock: { [blockNumber: number]: string };
  totalGamesPlayed: number;
  averageGameLength: number;
}

const initialTelemetry: GameTelemetry = {
  negotiationTimes: {},
  recallsUsed: { community: 0, developer: 0 },
  winsByRole: { community: 0, developer: 0, balanced: 0 },
  winsByLeadBlock: {},
  totalGamesPlayed: 0,
  averageGameLength: 0,
};

interface TelemetryStoreState {
  // State
  telemetry: GameTelemetry;
  gameStartTime: number | null;
  
  // Actions
  resetTelemetry: () => void;
  recordNegotiationTime: (floorNumber: number, seconds: number) => void;
  recordRecallUsed: (role: PlayerRole) => void;
  recordWin: (winner: 'community' | 'developer' | 'balanced') => void;
  recordGameEnd: (leadBlock?: number) => void;
  
  // Getters
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

export const useTelemetryStore = create<TelemetryStoreState>()(
  immer((set, get) => ({
    // State
    telemetry: { ...initialTelemetry },
    gameStartTime: null,
    
    // Actions
    resetTelemetry: () => {
      set(state => {
        // Reset for new game, but keep historical data
        state.gameStartTime = Date.now();
        
        // Don't reset global statistics like winsByRole
        state.telemetry.negotiationTimes = {};
        state.telemetry.recallsUsed = { community: 0, developer: 0 };
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
        // Increment win counter for the appropriate role
        state.telemetry.winsByRole[winner]++;
      });
    },
    
    recordGameEnd: (leadBlock) => {
      // Capture what we need before mutations
      const gameStartTime = get().gameStartTime;
      const totalGames = get().telemetry.totalGamesPlayed;
      const currentAvg = get().telemetry.averageGameLength;
      
      // Get a snapshot of current wins (before mutation)
      const { community: communityWins, developer: developerWins } = 
        { ...get().telemetry.winsByRole };
      
      set(state => {
        // Calculate game length
        if (gameStartTime) {
          const gameLength = (Date.now() - gameStartTime) / 1000; // in seconds
          
          // Update average game length
          state.telemetry.averageGameLength = 
            (currentAvg * totalGames + gameLength) / (totalGames + 1);
          
          state.telemetry.totalGamesPlayed++;
        }
        
        // Record which player won in which lead block if provided
        if (leadBlock !== undefined) {
          const winner = 
            communityWins > developerWins 
              ? 'community' 
              : developerWins > communityWins 
                ? 'developer' 
                : 'balanced';
          
          state.telemetry.winsByLeadBlock[leadBlock] = winner;
        }
        
        // Reset game start time
        state.gameStartTime = null;
      });
    },
    
    // Getters
    getAverageNegotiationTime: () => {
      const { negotiationTimes } = get().telemetry;
      const times = Object.values(negotiationTimes);
      
      if (times.length === 0) return 0;
      
      const sum = times.reduce((acc, time) => acc + time, 0);
      return sum / times.length;
    },
    
    getRecallStatistics: () => {
      const { recallsUsed } = get().telemetry;
      
      return {
        total: recallsUsed.community + recallsUsed.developer,
        byRole: { ...recallsUsed }
      };
    },
    
    getWinStatistics: () => {
      const { winsByRole } = get().telemetry;
      const total = winsByRole.community + winsByRole.developer + winsByRole.balanced;
      
      return {
        total,
        byRole: {
          ...winsByRole,
          communityPercent: total ? (winsByRole.community / total) * 100 : 0,
          developerPercent: total ? (winsByRole.developer / total) * 100 : 0,
          balancedPercent: total ? (winsByRole.balanced / total) * 100 : 0
        }
      };
    }
  }))
);