
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

// Re-export utility functions with proper aliases to avoid conflicts
export * from './signal-processing-utils';
export * from './peak-detection-utils';
export * from './filter-utils';
export { calculatePerfusionIndex } from './perfusion-utils';

// Re-export core functions with specific aliases
export {
  calculateAC as getACComponent,
  calculateDC as getDCComponent,
  calculateStandardDeviation as getStdDeviation,
} from '../perfusion-utils';
