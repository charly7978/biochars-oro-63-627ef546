
/**
 * Módulo de extracción de datos PPG
 * Proporciona funcionalidades para extraer información de señales PPG
 * Integra canal de diagnóstico y sistema de priorización
 */
export * from './HeartbeatExtractor';
export * from './PPGSignalExtractor';
export * from './CombinedExtractor';
export * from './DiagnosticsCollector';
export * from './OptimizedCircularBuffer';

// Nuevos componentes para streaming de datos y observable pattern
export * from './observable/SignalObservable';
export * from './messaging/MessageBus';
export * from './workers/WorkerManager';

// Re-exportar enumeración de prioridad para uso externo
export { ProcessingPriority } from './CombinedExtractor';

// Exportar interfaces de diagnóstico
export type { DiagnosticsEntry } from './DiagnosticsCollector';

// Exportar tipos y funciones del sistema de mensajería
export type { 
  Message, 
  RawDataMessage, 
  ProcessedDataMessage,
  PeakDetectedMessage, 
  DiagnosticsMessage 
} from './messaging/MessageBus';

export {
  MessageType,
  MessagePriority
} from './messaging/MessageBus';

// Exportar tipos y funciones del sistema de worker
export type {
  WorkerManagerConfig,
  WorkerProcessingResult
} from './workers/WorkerManager';

export {
  WorkerManagerState
} from './workers/WorkerManager';
