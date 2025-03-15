
/**
 * IMPORTANTE: Esta aplicación es solo para referencia médica.
 * No reemplaza dispositivos médicos certificados ni se debe utilizar para diagnósticos.
 * Todo el procesamiento es real, sin simulaciones o manipulaciones.
 */

/**
 * Utilidades centralizadas para procesamiento de señales PPG
 * Funciones comunes utilizadas por varios módulos
 */

// Re-export all functions from their respective modules
export * from './filtering/basicFilters';
export * from './analysis/signalAnalysis';
export * from './detection/peakDetection';
export * from './amplification/heartbeatAmplification';
