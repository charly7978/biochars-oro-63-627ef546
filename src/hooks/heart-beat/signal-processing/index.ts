
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Index file for signal processing utilities
 * Enhanced with improved algorithms and detection methods
 */
export * from './signal-quality';
export * from './peak-detection';
export * from './result-processor';

// Export specific functions for direct use
export { 
  checkWeakSignal, 
  shouldProcessMeasurement, 
  createWeakSignalResult,
  resetSignalQualityState,
  isFingerDetected,
  getSignalQualityDebugInfo
} from './signal-quality';

export { 
  handlePeakDetection,
  detectPeak,
  resetPeakDetector
} from './peak-detection';

export { 
  updateLastValidBpm, 
  processLowConfidenceResult 
} from './result-processor';
