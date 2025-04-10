
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Utilities for detecting fingers on camera/sensor
 */

// Buffer for detection stability
let detectionBuffer: boolean[] = [];
const DETECTION_BUFFER_SIZE = 5;

// Default sensitivity
let detectionSensitivity = 0.5;

/**
 * Configure the finger detector
 */
export function configureFingerDetector(sensitivity: number): void {
  detectionSensitivity = Math.max(0.1, Math.min(1.0, sensitivity));
  console.log(`Finger detector sensitivity set to ${detectionSensitivity}`);
}

/**
 * Reset the finger detector state
 */
export function resetFingerDetector(): void {
  detectionBuffer = [];
  console.log("Finger detector reset");
}

/**
 * Detect if a finger is present based on signal quality and strength
 */
export function detectFinger(signalStrength: number, signalQuality: number): boolean {
  // Basic detection based on signal characteristics
  const qualityThreshold = 0.3 * detectionSensitivity;
  const strengthThreshold = 0.2 * detectionSensitivity;
  
  // Raw detection result
  const detected = signalQuality > qualityThreshold && signalStrength > strengthThreshold;
  
  // Add to stability buffer
  detectionBuffer.push(detected);
  if (detectionBuffer.length > DETECTION_BUFFER_SIZE) {
    detectionBuffer.shift();
  }
  
  // Require majority of recent readings to be positive to report detection
  const positiveCount = detectionBuffer.filter(value => value).length;
  const detectionRatio = positiveCount / detectionBuffer.length;
  
  // Only report finger detected if majority of recent readings are positive
  return detectionRatio >= 0.6;
}

/**
 * Check if signal indicates movement (for detecting finger placement or removal)
 */
export function detectMovement(values: number[], timeWindow: number = 500): boolean {
  if (values.length < 2) return false;
  
  // Calculate variance in recent values
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  
  // Higher variance indicates movement
  return variance > 0.01 * detectionSensitivity;
}

/**
 * Get the current detection buffer for diagnostic purposes
 */
export function getDetectionBufferState(): {
  buffer: boolean[],
  sensitivity: number,
  detectionRatio: number
} {
  const positiveCount = detectionBuffer.filter(value => value).length;
  const detectionRatio = detectionBuffer.length > 0 ? positiveCount / detectionBuffer.length : 0;
  
  return {
    buffer: [...detectionBuffer],
    sensitivity: detectionSensitivity,
    detectionRatio
  };
}
