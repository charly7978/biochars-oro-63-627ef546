
/**
 * Bus de Eventos Centralizado para comunicación entre módulos
 * Implementa un patrón publicación-suscripción para permitir retroalimentación bidireccional
 */

type EventCallback<T = any> = (data: T) => void;

export enum EventType {
  // Eventos de cámara
  CAMERA_READY = 'camera:ready',
  CAMERA_ERROR = 'camera:error',
  CAMERA_FRAME = 'camera:frame',
  
  // Eventos de extracción de señal
  SIGNAL_EXTRACTED = 'signal:extracted',
  PPG_SIGNAL_EXTRACTED = 'signal:ppg',
  COMBINED_SIGNAL_DATA = 'signal:combined',
  SIGNAL_QUALITY_CHANGED = 'signal:quality',
  FINGER_DETECTED = 'signal:finger',
  FINGER_LOST = 'signal:finger-lost',
  FINGER_DETECTION_RESULT = 'signal:finger-result',
  
  // Eventos de latido cardíaco
  HEARTBEAT_DATA = 'heart:data',
  HEARTBEAT_DETECTED = 'heart:beat',
  HEARTBEAT_RATE_CHANGED = 'heart:rate',
  
  // Eventos de procesamiento
  PROCESSED_HEARTBEAT = 'process:heartbeat',
  PROCESSED_PPG = 'process:ppg',
  
  // Eventos de optimización
  OPTIMIZED_HEART_RATE = 'optimize:heart-rate',
  OPTIMIZED_SPO2 = 'optimize:spo2',
  OPTIMIZED_BLOOD_PRESSURE = 'optimize:blood-pressure',
  OPTIMIZED_GLUCOSE = 'optimize:glucose',
  OPTIMIZED_LIPIDS = 'optimize:lipids',
  OPTIMIZED_ARRHYTHMIA = 'optimize:arrhythmia',
  
  // Eventos de signos vitales
  VITAL_SIGNS_UPDATED = 'vitals:updated',
  VITAL_SIGNS_FINAL = 'vitals:final',
  ARRHYTHMIA_DETECTED = 'vitals:arrhythmia',
  
  // Eventos de estado de monitorización
  MONITORING_STARTED = 'monitor:start',
  MONITORING_STOPPED = 'monitor:stop',
  MONITORING_RESET = 'monitor:reset',
  
  // Eventos de retroalimentación de procesamiento
  PROCESSOR_FEEDBACK = 'process:feedback',
  OPTIMIZATION_APPLIED = 'process:optimized',
  
  // Eventos de error
  ERROR_OCCURRED = 'error:occurred'
}

class EventBus {
  private listeners: Map<EventType, Set<EventCallback>> = new Map();
  
  /**
   * Suscribirse a un evento
   */
  subscribe<T = any>(event: EventType, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    
    this.listeners.get(event)!.add(callback);
    
    // Devolver función de cancelación de suscripción
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
   * Publicar un evento con datos
   */
  publish<T = any>(event: EventType, data: T): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error en manejador de evento para ${event}:`, error);
        }
      });
    }
  }
  
  /**
   * Limpiar todos los oyentes para un evento
   */
  clear(event?: EventType): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// Instancia singleton
export const eventBus = new EventBus();

// Hooks auxiliares para componentes React
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
