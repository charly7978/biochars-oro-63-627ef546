
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

// Re-exportar enumeración de prioridad para uso externo
export { ProcessingPriority } from './CombinedExtractor';

// Exportar interfaces de diagnóstico
export type { DiagnosticsEntry } from './DiagnosticsCollector';

