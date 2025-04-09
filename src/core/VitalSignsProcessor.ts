
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

// Este archivo solo se mantiene para compatibilidad con versiones anteriores
// Importa y re-exporta desde la nueva ubicación para evitar cambios incompatibles
import { VitalSignsProcessor as ModulesProcessor } from '../modules/vital-signs/VitalSignsProcessor';

/**
 * @deprecated Use VitalSignsProcessor from '../modules/vital-signs/VitalSignsProcessor' instead.
 * Esta clase se mantiene solo para compatibilidad con versiones anteriores.
 */
export class VitalSignsProcessor extends ModulesProcessor {
  constructor() {
    super();
    console.warn("Using deprecated VitalSignsProcessor from core/ - please update imports to use modules/vital-signs/VitalSignsProcessor");
  }
}

// Re-exportar tipos para compatibilidad
export type { VitalSignsResult } from '../modules/vital-signs/types/vital-signs-result';

// Re-exportar estimadores
export { GlucoseEstimator } from './analysis/GlucoseEstimator';
export { LipidEstimator } from './analysis/LipidEstimator';
export { HemoglobinEstimator } from './analysis/HemoglobinEstimator';
