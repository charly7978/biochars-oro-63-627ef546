
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Finger detection utilities
 */

// Signal strength threshold for finger detection
const SIGNAL_STRENGTH_THRESHOLD = 0.02;
const VARIANCE_THRESHOLD = 0.0001;

// State tracking for finger detection
let consecutiveDetections = 0;
const REQUIRED_CONSECUTIVE_DETECTIONS = 3;
let fingerDetected = false;

/**
 * Reset the finger detector state
 */
export function resetFingerDetector(): void {
  consecutiveDetections = 0;
  fingerDetected = false;
}

/**
 * Check if a finger is detected based on signal characteristics
 */
export function isFingerDetected(signalBuffer: number[]): boolean {
  if (signalBuffer.length < 5) {
    return false;
  }
  
  // Calculate signal statistics
  const recent = signalBuffer.slice(-5);
  const mean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
  const variance = recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recent.length;
  
  // Check signal strength and variance
  const signalStrength = Math.abs(mean);
  const hasSignal = signalStrength > SIGNAL_STRENGTH_THRESHOLD && variance > VARIANCE_THRESHOLD;
  
  // Update consecutive detection counter
  if (hasSignal) {
    consecutiveDetections++;
  } else {
    consecutiveDetections = 0;
  }
  
  // Update finger detected state
  if (consecutiveDetections >= REQUIRED_CONSECUTIVE_DETECTIONS) {
    fingerDetected = true;
  } else if (consecutiveDetections === 0) {
    fingerDetected = false;
  }
  
  return fingerDetected;
}

/**
 * Get the current signal strength
 */
export function getSignalStrength(signalBuffer: number[]): number {
  if (signalBuffer.length < 5) {
    return 0;
  }
  
  const recent = signalBuffer.slice(-5);
  const mean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
  const variance = recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recent.length;
  
  return Math.abs(mean) * 10 + variance * 100;
}
