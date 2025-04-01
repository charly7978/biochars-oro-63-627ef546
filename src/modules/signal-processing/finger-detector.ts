
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Finger detection for PPG signals
 */

// Buffer to track detection history
let detectionHistory: boolean[] = [];
const HISTORY_SIZE = 10;
let lastDetectionTime = 0;
const DEBOUNCE_TIME = 300; // ms

// Parameters to tune detection
let stableCount = 0;
const STABILITY_THRESHOLD = 3;
let wasFingerDetected = false;

/**
 * Check if a finger is detected based on signal characteristics
 */
export function isFingerDetected(
  currentValue: number, 
  signalBuffer: number[], 
  sensitivity: number = 1.0
): boolean {
  const now = Date.now();
  
  // Not enough signal yet
  if (signalBuffer.length < 5) {
    return false;
  }
  
  // Calculate signal statistics
  const recent = signalBuffer.slice(-5);
  const mean = recent.reduce((sum, val) => sum + val, 0) / recent.length;
  const variance = recent.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recent.length;
  const range = Math.max(...recent) - Math.min(...recent);
  
  // Detection criteria - adjusted by sensitivity parameter
  const hasSignal = mean > 0.1 * sensitivity;
  const hasVariability = variance > 0.001 * sensitivity && variance < 0.5 / sensitivity;
  const hasAdequateRange = range > 0.05 * sensitivity && range < 2.0 / sensitivity;
  
  // Combine criteria
  const isDetected = hasSignal && hasVariability && hasAdequateRange;
  
  // Debounce rapid changes
  if (now - lastDetectionTime < DEBOUNCE_TIME) {
    return wasFingerDetected;
  }
  
  // Update history
  detectionHistory.push(isDetected);
  if (detectionHistory.length > HISTORY_SIZE) {
    detectionHistory.shift();
  }
  
  // Count number of positive detections in history
  const positiveCount = detectionHistory.filter(Boolean).length;
  const detectionRatio = positiveCount / detectionHistory.length;
  
  // Hysteresis for detection state change
  if (wasFingerDetected) {
    // Currently detecting - require several consecutive non-detections to stop
    if (detectionRatio < 0.3) {
      stableCount++;
      if (stableCount >= STABILITY_THRESHOLD) {
        wasFingerDetected = false;
        stableCount = 0;
        lastDetectionTime = now;
      }
    } else {
      stableCount = 0;
    }
  } else {
    // Currently not detecting - require several consecutive detections to start
    if (detectionRatio > 0.7) {
      stableCount++;
      if (stableCount >= STABILITY_THRESHOLD) {
        wasFingerDetected = true;
        stableCount = 0;
        lastDetectionTime = now;
      }
    } else {
      stableCount = 0;
    }
  }
  
  return wasFingerDetected;
}

/**
 * Backward compatibility alias for isFingerDetected
 */
export function detectFinger(
  currentValue: number, 
  signalBuffer: number[], 
  sensitivity: number = 1.0
): boolean {
  return isFingerDetected(currentValue, signalBuffer, sensitivity);
}

/**
 * Reset finger detector state
 */
export function resetFingerDetector(): void {
  detectionHistory = [];
  stableCount = 0;
  wasFingerDetected = false;
  lastDetectionTime = 0;
}
