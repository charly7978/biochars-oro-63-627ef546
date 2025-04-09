
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

// This file is deprecated and only remains for backward compatibility
// Import and re-export from the new location to avoid breaking changes
import { VitalSignsProcessor as ModulesProcessor, VitalSignsResult } from '../modules/vital-signs/VitalSignsProcessor';

/**
 * @deprecated Use VitalSignsProcessor from '../modules/vital-signs/VitalSignsProcessor' instead.
 * This class is maintained for backward compatibility only.
 */
export class VitalSignsProcessor extends ModulesProcessor {
  constructor() {
    super();
    console.warn("Using deprecated VitalSignsProcessor from core/ - please update imports to use modules/vital-signs/VitalSignsProcessor");
  }
}

// Re-export types for compatibility
export type { VitalSignsResult } from '../modules/vital-signs/types/vital-signs-result';
export { GlucoseEstimator } from './analysis/GlucoseEstimator';
export { LipidEstimator } from './analysis/LipidEstimator';
export { HemoglobinEstimator } from './analysis/HemoglobinEstimator';
