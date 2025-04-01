
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Export all vital signs processors
 */

// Export original processor
export { ModularVitalSignsProcessor, type ModularVitalSignsResult, type ProcessedSignal } from './ModularVitalSignsProcessor';

// Export enhanced precision processor
export { 
  PrecisionVitalSignsProcessor, 
  type PrecisionVitalSignsResult, 
  type PrecisionProcessorOptions 
} from './PrecisionVitalSignsProcessor';
