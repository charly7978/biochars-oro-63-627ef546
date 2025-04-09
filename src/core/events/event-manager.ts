
/**
 * Event manager for system-wide event handling
 * Provides a unified pub-sub system for better coupling of components
 */

type EventHandler = (...args: any[]) => void;

export class EventManager {
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  
  /**
   * Subscribe to an event
   */
  public subscribe(eventName: string, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(eventName)) {
      this.eventHandlers.set(eventName, new Set());
    }
    
    this.eventHandlers.get(eventName)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.unsubscribe(eventName, handler);
    };
  }
  
  /**
   * Unsubscribe from an event
   */
  public unsubscribe(eventName: string, handler: EventHandler): boolean {
    const handlers = this.eventHandlers.get(eventName);
    
    if (handlers && handlers.has(handler)) {
      handlers.delete(handler);
      return true;
    }
    
    return false;
  }
  
  /**
   * Publish an event
   */
  public publish(eventName: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(eventName);
    
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in event handler for "${eventName}":`, error);
        }
      });
    }
  }
  
  /**
   * Clear all event handlers
   */
  public clear(): void {
    this.eventHandlers.clear();
  }
  
  /**
   * Clear handlers for a specific event
   */
  public clearEvent(eventName: string): boolean {
    return this.eventHandlers.delete(eventName);
  }
}

// Create and export a global event manager instance
export const eventManager = new EventManager();
