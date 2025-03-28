
/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */

/**
 * Bus de Eventos
 * Sistema de comunicación entre módulos mediante eventos
 */

import { useEffect } from 'react';

export enum EventType {
  // Eventos de cámara
  CAMERA_FRAME_READY = 'camera:frame_ready',
  CAMERA_STARTED = 'camera:started',
  CAMERA_STOPPED = 'camera:stopped',
  CAMERA_ERROR = 'camera:error',
  
  // Eventos de extracción de señal
  HEARTBEAT_DATA = 'extraction:heartbeat_data',
  PPG_SIGNAL_EXTRACTED = 'extraction:ppg_signal',
  COMBINED_SIGNAL_DATA = 'extraction:combined_signal',
  
  // Eventos de procesamiento
  PROCESSED_HEARTBEAT = 'processing:heartbeat',
  PROCESSED_PPG = 'processing:ppg',
  HEARTBEAT_PEAK_DETECTED = 'processing:peak_detected',
  FINGER_DETECTED = 'processing:finger_detected',
  FINGER_LOST = 'processing:finger_lost',
  FINGER_DETECTION_CHANGED = 'processing:finger_detection_changed',
  SIGNAL_QUALITY_CHANGED = 'processing:signal_quality_changed',
  SIGNAL_EXTRACTED = 'processing:signal_extracted',
  
  // Eventos de optimización
  OPTIMIZED_HEART_RATE = 'optimization:heart_rate',
  OPTIMIZED_SPO2 = 'optimization:spo2',
  OPTIMIZED_BLOOD_PRESSURE = 'optimization:blood_pressure',
  OPTIMIZED_GLUCOSE = 'optimization:glucose',
  OPTIMIZED_LIPIDS = 'optimization:lipids',
  OPTIMIZED_ARRHYTHMIA = 'optimization:arrhythmia',
  
  // Eventos de resultados
  VITAL_SIGNS_UPDATED = 'results:vital_signs_updated',
  HEARTBEAT_RATE_CHANGED = 'results:heartbeat_rate_changed',
  ARRHYTHMIA_DETECTED = 'results:arrhythmia_detected',
  ARRHYTHMIA_STATUS_CHANGED = 'results:arrhythmia_status_changed',
  
  // Eventos de control
  MONITORING_STARTED = 'control:monitoring_started',
  MONITORING_STOPPED = 'control:monitoring_stopped',
  MONITORING_RESET = 'control:monitoring_reset'
}

type EventHandler = (data: any) => void;

class EventBusClass {
  private handlers: Map<EventType, EventHandler[]> = new Map();
  
  /**
   * Suscribirse a un evento
   */
  subscribe(eventType: EventType, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.push(handler);
    }
  }
  
  /**
   * Cancelar suscripción a un evento
   */
  unsubscribe(eventType: EventType, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType);
    
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }
  
  /**
   * Publicar un evento
   */
  publish(eventType: EventType, data: any): void {
    const handlers = this.handlers.get(eventType);
    
    if (handlers) {
      // Ejecutar cada manejador con los datos proporcionados
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error en manejador para evento ${eventType}:`, error);
        }
      });
    }
  }
  
  /**
   * Limpiar todas las suscripciones
   */
  clear(): void {
    this.handlers.clear();
  }
}

// Instancia singleton global
export const eventBus = new EventBusClass();

/**
 * Hook para suscribirse a eventos del bus en componentes React
 */
export const useEventSubscription = (
  eventType: EventType,
  handler: EventHandler
): void => {
  useEffect(() => {
    // Suscribirse al evento
    eventBus.subscribe(eventType, handler);
    
    // Cancelar suscripción al desmontar
    return () => {
      eventBus.unsubscribe(eventType, handler);
    };
  }, [eventType, handler]);
};

/**
 * ESTA TERMINANTEMENTE PROHIBIDA LA SIMULACION Y/O MANIPULACION DE DATOS, MEDICIONES, RESULTADOS, ETC EN ESTE CODIGO, 
 * EL IMPLEMENTO O INCORPORACION FORZOSA, DESHONESTA E ILEGAL, TENDRA CONSCUENCIAS JUDICIALES PREVISTAS EN EL CODIGO PENAL ARGENTINO.
 * 
 * YO, AI LOVABLE, TENGO TERMINANTEMENTE PROHIBIDO, APARTE DE IMPLEMENTAR FUNCIONES O MECANISMOS DE SIMULACION, 
 * TENGO PROHIBIDO TOMAR ACCIONES POR MI PARTE, SEA CUAL FUESE EL INDOLE DE GRAVEDAD O IMPORTANCIA, 
 * SIN ANTES DARLE CONOCIMIENTO Y AVISO FEHACIENTE AL USUARIO DUEÑO ABSOLUTO DE ESTE PROYECTO, ESTOY NOTIFICADA.
 */
