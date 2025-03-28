
/**
 * Sistema de eventos para comunicación entre módulos
 */

// Definición de tipos de eventos
export enum EventType {
  // Camera events
  CAMERA_STARTED = 'CAMERA_STARTED',
  CAMERA_STOPPED = 'CAMERA_STOPPED',
  CAMERA_FRAME = 'CAMERA_FRAME',
  
  // Signal events
  SIGNAL_EXTRACTED = 'SIGNAL_EXTRACTED',
  SIGNAL_PROCESSED = 'SIGNAL_PROCESSED',
  SIGNAL_OPTIMIZED = 'SIGNAL_OPTIMIZED',
  SIGNAL_QUALITY_CHANGED = 'SIGNAL_QUALITY_CHANGED',
  
  // Heartbeat events
  HEARTBEAT_DETECTED = 'HEARTBEAT_DETECTED',
  PROCESSED_HEARTBEAT = 'PROCESSED_HEARTBEAT',
  
  // PPG events
  PROCESSED_PPG = 'PROCESSED_PPG',
  
  // Finger detection events
  FINGER_DETECTED = 'FINGER_DETECTED',
  FINGER_LOST = 'FINGER_LOST',
  
  // Combined signal events
  COMBINED_SIGNAL_DATA = 'COMBINED_SIGNAL_DATA',
  HEARTBEAT_DATA = 'HEARTBEAT_DATA',
  
  // Result events
  VITAL_SIGNS_UPDATED = 'VITAL_SIGNS_UPDATED',
  
  // Error events
  ERROR_OCCURRED = 'ERROR_OCCURRED'
}

// Tipo para callbacks de eventos
type EventCallback = (data: any) => void;

// Bus de eventos central
class EventBus {
  private listeners: Map<EventType, EventCallback[]> = new Map();

  // Publicar un evento
  public publish(eventType: EventType, data: any): void {
    const eventListeners = this.listeners.get(eventType);
    
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error en callback para evento ${eventType}:`, error);
        }
      });
    }
  }

  // Suscribirse a un evento
  public subscribe(eventType: EventType, callback: EventCallback): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    
    const eventListeners = this.listeners.get(eventType)!;
    eventListeners.push(callback);
    
    // Retornar función para cancelar suscripción
    return () => {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    };
  }

  // Cancelar todas las suscripciones para un tipo de evento
  public clearEventListeners(eventType: EventType): void {
    this.listeners.delete(eventType);
  }

  // Cancelar todas las suscripciones
  public clearAllListeners(): void {
    this.listeners.clear();
  }
}

// Crear instancia singleton del bus de eventos
export const eventBus = new EventBus();

// Hook personalizado para usar el bus de eventos
import { useEffect } from 'react';

export const useEventSubscription = (
  eventType: EventType, 
  callback: EventCallback
): void => {
  useEffect(() => {
    const unsubscribe = eventBus.subscribe(eventType, callback);
    return () => {
      unsubscribe();
    };
  }, [eventType, callback]);
};
