// src/utils/eventBus.ts

/**
 * A type-safe event bus for game-wide communication
 */
export class EventBus<EventMap extends Record<string, any>> {
  private listeners = new Map<keyof EventMap, Set<(data: any) => void>>();
  
  /**
   * Subscribe to an event
   * @returns An unsubscribe function
   */
  on<E extends keyof EventMap>(event: E, listener: (data: EventMap[E]) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(listener);
    
    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(event);
      if (listeners) {
        listeners.delete(listener);
        if (listeners.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }
  
  /**
   * Emit an event with data
   */
  emit<E extends keyof EventMap>(event: E, data: EventMap[E]): void {
    const listeners = this.listeners.get(event);
    
    if (listeners) {
      // Create a copy to avoid issues if listeners are added/removed during iteration
      Array.from(listeners).forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in event listener for ${String(event)}:`, error);
        }
      });
    }
  }
  
  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners.clear();
  }
  
  /**
   * Get the count of listeners for an event (useful for debugging)
   */
  listenerCount<E extends keyof EventMap>(event: E): number {
    return this.listeners.get(event)?.size || 0;
  }
}

// Define our game events
export interface GameEventMap {
  // Game lifecycle events
  'game:started': { humanRole: string; aiRole: string };
  'game:ended': { winner: string; reason: string; finalScore: number };
  'game:reset': void;
  
  // Turn events
  'turn:changed': { playerId: string; isAI: boolean };
  'turn:timer': { remainingTime: number; isExpiring: boolean };
  
  // Card events
  'card:drawn': { playerId: string; cardId: string; cardName: string };
  'card:played': { playerId: string; cardId: string; cardName: string; floor: number };
  'card:selected': { cardId: string | null };
  
  // Proposal events
  'proposal:made': { playerId: string; cardId: string; floor: number };
  'proposal:countered': { playerId: string; cardId: string; floor: number };
  'proposal:accepted': { playerId: string; cardId: string; floor: number };
  'proposal:passed': { playerId: string; floor: number };
  'proposal:mediated': { cardId: string; floor: number };
  
  // Floor events
  'floor:changed': { previousFloor: number; currentFloor: number };
  'floor:completed': { floor: number; cardId?: string; committedBy: string };
  'floor:recalled': { floor: number; playerId: string };
  
  // Score events
  'score:changed': { previousScore: number; newScore: number; change: number };
  
  // Error events
  'error:game': { message: string; code?: string };
  'error:network': { message: string; code?: string };
  
  // UI events
  'ui:modalOpened': { modalId: string; data?: any };
  'ui:modalClosed': { modalId: string };
}

// Create a singleton instance
export const gameEvents = new EventBus<GameEventMap>();

// Usage example:
// gameEvents.emit('game:started', { humanRole: 'developer', aiRole: 'community' });
// const unsubscribe = gameEvents.on('card:drawn', (data) => console.log(`${data.playerId} drew ${data.cardName}`));
// unsubscribe(); // When you want to stop listening