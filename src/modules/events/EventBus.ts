
/**
 * Event Bus para comunicación entre módulos
 * Implementa patrón publish-subscribe para desacoplar componentes
 */

import { useState, useEffect } from 'react';

// Tipos de eventos del sistema
export enum EventType {
  // Eventos de entrada de datos
  CAMERA_FRAME_READY = 'camera_frame_ready',
  CAMERA_ERROR = 'camera_error',
  CAMERA_READY = 'camera_ready',
  
  // Eventos de extracción de señal
  SIGNAL_EXTRACTED = 'signal_extracted',
  SIGNAL_OPTIMIZED = 'signal_optimized',
  SIGNAL_PROCESSED = 'signal_processed',
  
  // Eventos de análisis de frecuencia cardíaca
  HEARTBEAT_DETECTED = 'heartbeat_detected',
  HEARTBEAT_RATE_CHANGED = 'heartbeat_rate_changed',
  
  // Eventos de datos optimizados
  OPTIMIZED_HEART_RATE = 'optimized_heart_rate',
  OPTIMIZED_SPO2 = 'optimized_spo2',
  OPTIMIZED_BLOOD_PRESSURE = 'optimized_blood_pressure',
  OPTIMIZED_GLUCOSE = 'optimized_glucose',
  OPTIMIZED_LIPIDS = 'optimized_lipids',
  OPTIMIZED_ARRHYTHMIA = 'optimized_arrhythmia',
  
  // Eventos de arritmias
  ARRHYTHMIA_DETECTED = 'arrhythmia_detected',
  ARRHYTHMIA_STATUS_CHANGED = 'arrhythmia_status_changed',
  
  // Eventos de estado
  MONITORING_STARTED = 'monitoring_started',
  MONITORING_STOPPED = 'monitoring_stopped',
  MONITORING_RESET = 'monitoring_reset',
  
  // Eventos de resultados
  VITAL_SIGNS_UPDATED = 'vital_signs_updated'
}

// Tipo para funciones de callback
type EventCallback = (data: any) => void;

// Clase principal del Event Bus
class EventBus {
  private listeners: Map<EventType, EventCallback[]> = new Map();
  
  /**
   * Suscribirse a un evento
   * @param eventType Tipo de evento
   * @param callback Función a llamar cuando ocurra el evento
   */
  public subscribe(eventType: EventType, callback: EventCallback): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }
  
  /**
   * Cancelar suscripción a un evento
   * @param eventType Tipo de evento
   * @param callback Función a remover
   */
  public unsubscribe(eventType: EventType, callback: EventCallback): void {
    if (!this.listeners.has(eventType)) return;
    
    const callbacks = this.listeners.get(eventType)!;
    const index = callbacks.indexOf(callback);
    
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }
  
  /**
   * Publicar un evento
   * @param eventType Tipo de evento
   * @param data Datos del evento
   */
  public publish(eventType: EventType, data: any): void {
    if (!this.listeners.has(eventType)) return;
    
    const callbacks = this.listeners.get(eventType)!;
    callbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Error al procesar evento ${eventType}:`, error);
      }
    });
  }
  
  /**
   * Limpiar todos los listeners
   */
  public clear(): void {
    this.listeners.clear();
  }
}

// Instancia singleton del Event Bus
export const eventBus = new EventBus();

/**
 * Hook para suscribirse a eventos
 * @param eventType Tipo de evento
 * @param callback Función a llamar cuando ocurra el evento
 */
export function useEventSubscription(eventType: EventType, callback: EventCallback): void {
  useEffect(() => {
    eventBus.subscribe(eventType, callback);
    
    return () => {
      eventBus.unsubscribe(eventType, callback);
    };
  }, [eventType, callback]);
}

/**
 * Hook para estado basado en eventos
 * @param eventType Tipo de evento
 * @param initialState Estado inicial
 */
export function useEventState<T>(eventType: EventType, initialState: T): [T, (data: T) => void] {
  const [state, setState] = useState<T>(initialState);
  
  useEffect(() => {
    const handleEvent = (data: T) => {
      setState(data);
    };
    
    eventBus.subscribe(eventType, handleEvent);
    
    return () => {
      eventBus.unsubscribe(eventType, handleEvent);
    };
  }, [eventType]);
  
  const updateState = (data: T) => {
    setState(data);
    eventBus.publish(eventType, data);
  };
  
  return [state, updateState];
}
