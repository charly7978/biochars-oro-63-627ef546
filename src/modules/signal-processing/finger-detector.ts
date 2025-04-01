
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Finger detection utility for PPG signals
 */

// State for finger detection
let fingerDetected = false;
let consecutiveDetections = 0;
let consecutiveNonDetections = 0;
const requiredConsecutiveDetections = 5;
const requiredConsecutiveNonDetections = 3;

/**
 * Detect if a finger is present based on signal quality
 */
export function detectFinger(signalQuality: number, signalValue: number): boolean {
  // Require minimum signal quality and non-zero value
  const detected = signalQuality > 0.3 && Math.abs(signalValue) > 0.01;
  
  if (detected) {
    consecutiveDetections++;
    consecutiveNonDetections = 0;
    
    // Require several consecutive detections to confirm
    if (consecutiveDetections >= requiredConsecutiveDetections) {
      fingerDetected = true;
    }
  } else {
    consecutiveNonDetections++;
    consecutiveDetections = 0;
    
    // Require several consecutive non-detections to confirm removal
    if (consecutiveNonDetections >= requiredConsecutiveNonDetections) {
      fingerDetected = false;
    }
  }
  
  return fingerDetected;
}

/**
 * Reset finger detection state
 */
export function resetFingerDetector(): void {
  fingerDetected = false;
  consecutiveDetections = 0;
  consecutiveNonDetections = 0;
}

/**
 * Get current finger detection status
 */
export function isFingerDetected(): boolean {
  return fingerDetected;
}
