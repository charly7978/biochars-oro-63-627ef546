
/**
 * Sistema de eventos para comunicación entre módulos
 */

// Definición de tipos de eventos
export enum EventType {
  // Camera events
  CAMERA_STARTED = 'CAMERA_STARTED',
  CAMERA_STOPPED = 'CAMERA_STOPPED',
  CAMERA_FRAME = 'CAMERA_FRAME',
  CAMERA_FRAME_READY = 'CAMERA_FRAME_READY',
  CAMERA_READY = 'CAMERA_READY',
  CAMERA_ERROR = 'CAMERA_ERROR',
  
  // Signal events
  SIGNAL_EXTRACTED = 'SIGNAL_EXTRACTED',
  SIGNAL_PROCESSED = 'SIGNAL_PROCESSED',
  SIGNAL_OPTIMIZED = 'SIGNAL_OPTIMIZED',
  SIGNAL_QUALITY_CHANGED = 'SIGNAL_QUALITY_CHANGED',
  
  // Heartbeat events
  HEARTBEAT_DETECTED = 'HEARTBEAT_DETECTED',
  HEARTBEAT_PEAK_DETECTED = 'HEARTBEAT_PEAK_DETECTED',
  HEARTBEAT_RATE_CHANGED = 'HEARTBEAT_RATE_CHANGED',
  PROCESSED_HEARTBEAT = 'PROCESSED_HEARTBEAT',
  
  // PPG events
  PROCESSED_PPG = 'PROCESSED_PPG',
  PPG_SIGNAL_EXTRACTED = 'PPG_SIGNAL_EXTRACTED',
  
  // Finger detection events
  FINGER_DETECTED = 'FINGER_DETECTED',
  FINGER_LOST = 'FINGER_LOST',
  
  // Combined signal events
  COMBINED_SIGNAL_DATA = 'COMBINED_SIGNAL_DATA',
  HEARTBEAT_DATA = 'HEARTBEAT_DATA',
  
  // Monitoring events
  MONITORING_STARTED = 'MONITORING_STARTED',
  MONITORING_STOPPED = 'MONITORING_STOPPED',
  MONITORING_RESET = 'MONITORING_RESET',
  
  // Optimized data events
  OPTIMIZED_HEART_RATE = 'OPTIMIZED_HEART_RATE',
  OPTIMIZED_SPO2 = 'OPTIMIZED_SPO2',
  OPTIMIZED_BLOOD_PRESSURE = 'OPTIMIZED_BLOOD_PRESSURE',
  OPTIMIZED_GLUCOSE = 'OPTIMIZED_GLUCOSE',
  OPTIMIZED_LIPIDS = 'OPTIMIZED_LIPIDS',
  OPTIMIZED_ARRHYTHMIA = 'OPTIMIZED_ARRHYTHMIA',
  
  // Arrhythmia events
  ARRHYTHMIA_DETECTED = 'ARRHYTHMIA_DETECTED',
  ARRHYTHMIA_STATUS_CHANGED = 'ARRHYTHMIA_STATUS_CHANGED',
  
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
