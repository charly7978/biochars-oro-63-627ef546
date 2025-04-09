
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Sistema de bus de mensajes tipado para comunicación entre módulos
 * Proporciona una manera estructurada de intercambiar datos
 */

// Tipos de mensajes soportados
export enum MessageType {
  // Mensajes de control
  INITIALIZE = 'INITIALIZE',
  RESET = 'RESET',
  START_PROCESSING = 'START_PROCESSING',
  STOP_PROCESSING = 'STOP_PROCESSING',
  CONFIGURE = 'CONFIGURE',
  
  // Mensajes de datos
  RAW_DATA = 'RAW_DATA',
  PROCESSED_DATA = 'PROCESSED_DATA',
  PEAK_DETECTED = 'PEAK_DETECTED',
  SIGNAL_QUALITY = 'SIGNAL_QUALITY',
  
  // Mensajes de diagnóstico
  PERFORMANCE_METRICS = 'PERFORMANCE_METRICS',
  DIAGNOSTICS_REPORT = 'DIAGNOSTICS_REPORT',
  ERROR = 'ERROR'
}

// Prioridades de mensaje
export enum MessagePriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

// Interfaz base para mensajes
export interface Message {
  type: MessageType;
  timestamp: number;
  priority: MessagePriority;
  sender: string;
}

// Mensaje de datos crudo
export interface RawDataMessage extends Message {
  type: MessageType.RAW_DATA;
  payload: {
    value: number;
    frameId?: number;
  };
}

// Mensaje de datos procesados
export interface ProcessedDataMessage extends Message {
  type: MessageType.PROCESSED_DATA;
  payload: {
    rawValue: number;
    filteredValue: number;
    quality: number;
    fingerDetected: boolean;
    hasPeak?: boolean;
    instantaneousBPM?: number | null;
    buffer?: ArrayBuffer; // Para transferencia de datos eficiente
  };
}

// Mensaje de pico detectado (alta prioridad)
export interface PeakDetectedMessage extends Message {
  type: MessageType.PEAK_DETECTED;
  priority: MessagePriority.HIGH;
  payload: {
    timestamp: number;
    value: number;
    confidence: number;
    rrInterval?: number | null;
  };
}

// Mensaje de configuración
export interface ConfigureMessage extends Message {
  type: MessageType.CONFIGURE;
  payload: {
    [key: string]: any;
  };
}

// Mensaje de diagnóstico
export interface DiagnosticsMessage extends Message {
  type: MessageType.DIAGNOSTICS_REPORT;
  priority: MessagePriority.LOW;
  payload: {
    processingTime: number;
    memoryUsage?: number;
    queueLength?: number;
    extractorType: string;
    [key: string]: any;
  };
}

// Mensaje de error
export interface ErrorMessage extends Message {
  type: MessageType.ERROR;
  priority: MessagePriority.HIGH;
  payload: {
    code: string;
    message: string;
    details?: any;
  };
}

// Tipo unión para todos los mensajes
export type MessageUnion = 
  | RawDataMessage
  | ProcessedDataMessage
  | PeakDetectedMessage
  | ConfigureMessage
  | DiagnosticsMessage
  | ErrorMessage
  | Message;

// Handler de mensajes
export type MessageHandler = (message: MessageUnion) => void;

/**
 * Bus de mensajes tipado para comunicación entre módulos
 */
export class MessageBus {
  private static instance: MessageBus;
  private subscribers: Map<MessageType, Set<MessageHandler>> = new Map();
  private globalSubscribers: Set<MessageHandler> = new Set();
  
  private constructor() {}
  
  /**
   * Obtiene la instancia singleton del bus de mensajes
   */
  public static getInstance(): MessageBus {
    if (!MessageBus.instance) {
      MessageBus.instance = new MessageBus();
    }
    return MessageBus.instance;
  }
  
  /**
   * Suscribe un handler a un tipo específico de mensaje
   */
  public subscribe(type: MessageType, handler: MessageHandler): () => void {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }
    
    this.subscribers.get(type)!.add(handler);
    
    // Devolver función para desuscribirse
    return () => {
      const handlers = this.subscribers.get(type);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }
  
  /**
   * Suscribe un handler a todos los mensajes
   */
  public subscribeToAll(handler: MessageHandler): () => void {
    this.globalSubscribers.add(handler);
    
    // Devolver función para desuscribirse
    return () => {
      this.globalSubscribers.delete(handler);
    };
  }
  
  /**
   * Publica un mensaje en el bus
   */
  public publish(message: MessageUnion): void {
    // Añadir timestamp si no lo tiene
    if (!message.timestamp) {
      message = { ...message, timestamp: Date.now() };
    }
    
    // Notificar a subscriptores específicos
    const typeSubscribers = this.subscribers.get(message.type);
    if (typeSubscribers) {
      typeSubscribers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error(`Error en handler de mensaje ${message.type}:`, error);
        }
      });
    }
    
    // Notificar a subscriptores globales
    this.globalSubscribers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error(`Error en handler global para mensaje ${message.type}:`, error);
      }
    });
  }
  
  /**
   * Limpia todas las suscripciones
   */
  public clear(): void {
    this.subscribers.clear();
    this.globalSubscribers.clear();
  }
}

/**
 * Crea un mensaje de datos crudo
 */
export function createRawDataMessage(value: number, sender: string, frameId?: number): RawDataMessage {
  return {
    type: MessageType.RAW_DATA,
    timestamp: Date.now(),
    priority: MessagePriority.MEDIUM,
    sender,
    payload: {
      value,
      frameId
    }
  };
}

/**
 * Crea un mensaje de datos procesados
 */
export function createProcessedDataMessage(
  data: {
    rawValue: number;
    filteredValue: number;
    quality: number;
    fingerDetected: boolean;
    hasPeak?: boolean;
    instantaneousBPM?: number | null;
  },
  sender: string,
  buffer?: ArrayBuffer
): ProcessedDataMessage {
  return {
    type: MessageType.PROCESSED_DATA,
    timestamp: Date.now(),
    priority: data.hasPeak ? MessagePriority.HIGH : MessagePriority.MEDIUM,
    sender,
    payload: {
      ...data,
      buffer
    }
  };
}

/**
 * Crea un mensaje de pico detectado
 */
export function createPeakDetectedMessage(
  timestamp: number,
  value: number,
  confidence: number,
  sender: string,
  rrInterval?: number | null
): PeakDetectedMessage {
  return {
    type: MessageType.PEAK_DETECTED,
    timestamp: Date.now(),
    priority: MessagePriority.HIGH,
    sender,
    payload: {
      timestamp,
      value,
      confidence,
      rrInterval
    }
  };
}

/**
 * Crea un mensaje de diagnóstico
 */
export function createDiagnosticsMessage(
  data: {
    processingTime: number;
    extractorType: string;
    [key: string]: any;
  },
  sender: string
): DiagnosticsMessage {
  return {
    type: MessageType.DIAGNOSTICS_REPORT,
    timestamp: Date.now(),
    priority: MessagePriority.LOW,
    sender,
    payload: data
  };
}
