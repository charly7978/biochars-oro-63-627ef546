
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Index file for signal processing utilities
 */
export * from './signal-quality';
export * from './peak-detection';
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
} from './peak-detection';

export { 
  updateLastValidBpm, 
  processLowConfidenceResult 
} from './result-processor';

// Export extractors for direct access from modules/extraction
// These are now properly referenced from the correct path
export * from '../../../modules/extraction/HeartbeatExtractor';
export * from '../../../modules/extraction/PPGSignalExtractor';
export * from '../../../modules/extraction/CombinedExtractor';
