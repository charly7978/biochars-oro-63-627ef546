// Punto de entrada único para utilidades de filtrado y procesamiento de señal
// Todas las funciones y clases relevantes deben importarse desde aquí

// --- FILTROS AVANZADOS (core) ---
export { BandpassFilter } from '@/core/signal/filters/BandpassFilter';
export { KalmanFilter as CoreKalmanFilter } from '@/core/signal/filters/KalmanFilter';
export { WaveletDenoiser } from '@/core/signal/filters/WaveletDenoiser';

// --- FILTROS BÁSICOS Y UTILIDADES ---
export * from './filter-utils';
export * from './peak-detection-utils';
export * from './perfusion-utils';

// --- SHARED SIGNAL UTILS (estadísticos, normalización, etc) ---
export {
  applySMAFilter,
  calculateAC,
  calculateAmplitude,
  calculateDC,
  calculateStandardDeviation,
  findPeaksAndValleys,
  normalizeValues,
  SIGNAL_CONSTANTS,
  KalmanFilter,
  evaluateSignalQuality
} from '../shared-signal-utils';

// Exportar el resto de signal-processing-utils, excluyendo los solapados
export {
  amplifySignal
} from './signal-processing-utils';

import { useVitalSignsProcessor } from "@/modules/vital-signs/utils";

/**
 * DOCUMENTACIÓN:
 * Este archivo es el ÚNICO punto de entrada para todas las utilidades de filtrado y procesamiento de señal.
 * Si necesitas agregar un nuevo filtro, función de calidad, detección de picos, etc.,
 * hazlo aquí o en los archivos importados, y reexporta desde este index.
 *
 * Ejemplo de uso en cualquier módulo:
 * import { BandpassFilter, applySMAFilter, findPeaks } from '@/modules/vital-signs/utils';
 */
