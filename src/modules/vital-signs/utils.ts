/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Re-export utilities from individual files to maintain compatibility
 * All functions process only real data without simulation.
 */

// Re-export all signal utilities from the centralized shared-signal-utils.ts
export * from './shared-signal-utils';

// Re-export peak detection utilities
export {
  findPeaksAndValleys,
  calculateAmplitude
} from './utils/peak-detection-utils';

// Re-export filter utilities
export {
  applySMAFilter,
  amplifySignal
} from './utils/filter-utils';

// Re-export perfusion utilities
export {
  calculatePerfusionIndex
} from './utils/perfusion-utils';
