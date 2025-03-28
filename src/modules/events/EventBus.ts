
/**
 * Centralized Event Bus for inter-module communication
 * Implements a publish-subscribe pattern to enable bidirectional feedback
 */

type EventCallback<T = any> = (data: T) => void;

export enum EventType {
  // Camera events
  CAMERA_READY = 'camera:ready',
  CAMERA_ERROR = 'camera:error',
  CAMERA_FRAME = 'camera:frame',
  
  // Signal extraction events
  SIGNAL_EXTRACTED = 'signal:extracted',
  SIGNAL_QUALITY_CHANGED = 'signal:quality',
  FINGER_DETECTED = 'signal:finger',
  FINGER_LOST = 'signal:finger-lost',
  
  // Heart beat events
  HEARTBEAT_DETECTED = 'heart:beat',
  HEARTBEAT_RATE_CHANGED = 'heart:rate',
  
  // Vital signs events
  VITAL_SIGNS_UPDATED = 'vitals:updated',
  VITAL_SIGNS_FINAL = 'vitals:final',
  ARRHYTHMIA_DETECTED = 'vitals:arrhythmia',
  
  // Monitoring state events
  MONITORING_STARTED = 'monitor:start',
  MONITORING_STOPPED = 'monitor:stop',
  MONITORING_RESET = 'monitor:reset',
  
  // Processing feedback events
  PROCESSOR_FEEDBACK = 'process:feedback',
  OPTIMIZATION_APPLIED = 'process:optimized',
  
  // Error events
  ERROR_OCCURRED = 'error:occurred'
}

class EventBus {
  private listeners: Map<EventType, Set<EventCallback>> = new Map();
  
  /**
   * Subscribe to an event
   */
  subscribe<T = any>(event: EventType, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.listeners.delete(event);
        }
      }
    };
  }
  
  /**
   * Publish an event with data
   */
  publish<T = any>(event: EventType, data: T): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }
  
  /**
   * Clear all listeners for an event
   */
  clear(event?: EventType): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// Singleton instance
export const eventBus = new EventBus();

// Helper hooks for React components
import { useEffect } from 'react';

export function useEventSubscription<T = any>(
  event: EventType,
  callback: EventCallback<T>
): void {
  useEffect(() => {
    const unsubscribe = eventBus.subscribe(event, callback);
    return unsubscribe;
  }, [event, callback]);
}

export function useMultiEventSubscription(
  subscriptions: { event: EventType; callback: EventCallback }[]
): void {
  useEffect(() => {
    const unsubscribers = subscriptions.map(({ event, callback }) => 
      eventBus.subscribe(event, callback)
    );
    
    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [subscriptions]);
}
