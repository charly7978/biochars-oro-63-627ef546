
/**
 * Módulo central de procesamiento de señal
 * Proporciona funcionalidades avanzadas para el procesamiento de señales PPG y cardíacas
 */

// Exportar procesadores principales
export * from './ppg-processor';
export * from './heartbeat-processor';

// Exportar utilidades de procesamiento
export * from './utils/quality-detector';
export * from './utils/finger-detector';
export * from './utils/signal-normalizer';

// Exportar tipos
export * from './types';
