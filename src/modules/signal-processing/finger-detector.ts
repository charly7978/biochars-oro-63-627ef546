/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Finger detection helper functions
 */

// Store state information for finger detection
let fingerBuffer: number[] = [];
let isFingerDetected = false;
let consecutiveDetections = 0;
let consecutiveNonDetections = 0;

/**
 * Reset the finger detector state
 */
export function resetFingerDetector(): void {
  fingerBuffer = [];
  isFingerDetected = false;
  consecutiveDetections = 0;
  consecutiveNonDetections = 0;
  console.log("Finger detector has been reset");
}

/**
 * Process a signal to detect if a finger is present
 */
export function detectFinger(signal: number, threshold: number = 0.1): boolean {
  // Add to buffer
  fingerBuffer.push(signal);
  
  // Keep buffer at reasonable size
  if (fingerBuffer.length > 20) {
    fingerBuffer.shift();
  }
  
  // Need minimum data to make a determination
  if (fingerBuffer.length < 10) {
    return false;
  }
  
  // Check signal stability and strength
  const mean = fingerBuffer.reduce((sum, val) => sum + val, 0) / fingerBuffer.length;
  const deviation = fingerBuffer.map(v => Math.abs(v - mean)).reduce((sum, val) => sum + val, 0) / fingerBuffer.length;
  
  // Finger detected if signal strength above threshold and there is some variation
  const signalPresent = Math.abs(mean) > threshold;
  const variationPresent = deviation > 0.01 && deviation < 0.5;
  
  // Check current detection
  const currentDetection = signalPresent && variationPresent;
  
  // Need several consecutive detections to confirm
  if (currentDetection) {
    consecutiveDetections++;
    consecutiveNonDetections = 0;
  } else {
    consecutiveNonDetections++;
    consecutiveDetections = 0;
  }
  
  // Update state with hysteresis to prevent rapid toggling
  if (consecutiveDetections >= 5) {
    isFingerDetected = true;
  } else if (consecutiveNonDetections >= 10) {
    isFingerDetected = false;
  }
  
  return isFingerDetected;
}
