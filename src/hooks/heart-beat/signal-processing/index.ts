
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Index file for signal processing utilities
 */
export * from './signal-quality';
export * from './result-processor';

// Export specific functions for direct use
export { 
  checkWeakSignal, 
  shouldProcessMeasurement, 
  createWeakSignalResult,
  resetSignalQualityState
} from './signal-quality';

export { 
  handlePeakDetection 
} from '../signal-processing';

export { 
  updateLastValidBpm, 
  processLowConfidenceResult 
} from './result-processor';
