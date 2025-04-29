// stores/index.ts - Root store exports

// Export all stores to simplify imports
export { useBuildingStore } from './useBuildingStore';
export { useFloorStore, FloorStatus, Committer } from './useFloorStore';
export { usePlayersStore, PlayerRole, PlayerType } from './usePlayersStore';
export { useGameFlowStore, GamePhase } from './useGameFlowStore';
export { useAIStore } from './useAIStore';
export { useTelemetryStore } from './useTelemetryStore';