// stores/index.ts - Root store exports

// Export all stores to simplify imports
export { useBuildingStore } from './useBuildingStore';
export { useFloorStore }          from './useFloorStore';
export { usePlayersStore, PlayerRole } from './usePlayersStore';
export { useGameFlowStore, GamePhase } from './useGameFlowStore';
export { useAIStore } from './useAIStore';
export { useTelemetryStore } from './useTelemetryStore';