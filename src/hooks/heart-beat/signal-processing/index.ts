
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Index file for signal processing utilities
 */
export * from './signal-quality';
export * from './peak-detection';
export * from './result-processor';
export * from './adaptive-control';

// Export specific functions for direct use
export { 
  checkWeakSignal, 
  shouldProcessMeasurement, 
  createWeakSignalResult,
  resetSignalQualityState,
  isFingerDetected
} from './signal-quality';

export { 
  handlePeakDetection 
} from './peak-detection';

export { 
  updateLastValidBpm, 
  processLowConfidenceResult 
} from './result-processor';

export {
  applyAdaptiveFilter,
  predictNextValue,
  correctSignalAnomalies,
  updateQualityWithPrediction,
  resetAdaptiveControl,
  getAdaptiveModelState,
  applyBayesianOptimization,
  applyGaussianProcessModeling,
  applyMixedModelPrediction
} from './adaptive-control';
