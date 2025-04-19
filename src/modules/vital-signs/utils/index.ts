
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

// Import and re-export with renamed functions to avoid name clashes
import * as signalProcessingUtils from './signal-processing-utils';
import * as peakDetectionUtils from './peak-detection-utils';
import * as filterUtils from './filter-utils';
import * as perfusionUtils from './perfusion-utils';

// Export utility functions with explicit names
export { 
  // From signal-processing-utils
  signalProcessingUtils as signalProcessing 
};

// From peak-detection-utils with renamed exports to avoid collisions
export {
  peakDetectionUtils as peakDetection
};

// Export filter utilities
export { 
  filterUtils as filters
};

// Export perfusion utilities
export { 
  perfusionUtils as perfusion
};

// For direct access to common functions, export them individually
// Explicitly rename any conflicting functions
export { 
  // Explicitly rename functions from peak-detection-utils to avoid conflicts
  findPeaks as findSignalPeaks,
  findValleys as findSignalValleys
} from './peak-detection-utils';

// Export filter functions directly
export {
  applyBandpassFilter,
  applyLowpassFilter,
  applyHighpassFilter
} from './filter-utils';

// Export perfusion functions directly
export {
  calculatePerfusionIndex,
  normalizePerfusion
} from './perfusion-utils';
