
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Index file for signal processing utilities
 */

// Export functions from signal-quality.ts
export { 
  checkWeakSignal, 
  shouldProcessMeasurement, 
  createWeakSignalResult,
  resetSignalQualityState
} from './signal-quality';

// Export functions from peak-detection.ts
export { 
  handlePeakDetection 
} from './peak-detection';

// Export functions from result-processor.ts
export { 
  updateLastValidBpm, 
  processLowConfidenceResult 
} from './result-processor';
