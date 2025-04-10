
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Utility functions for processing heart rate measurement results
 * Working with real data only
 */

/**
 * Process low confidence results for better stability
 */
export function processLowConfidenceResult(
  result: any, 
  currentBPM: number,
  arrhythmiaCounter: number
): any {
  // If confidence is too low, use currentBPM for stability
  if (result.confidence < 0.2 && currentBPM > 40) {
    return {
      ...result,
      bpm: currentBPM,
      arrhythmiaCount: arrhythmiaCounter
    };
  }

  // Always include arrhythmia counter
  return {
    ...result,
    arrhythmiaCount: arrhythmiaCounter
  };
}

/**
 * Update the last valid BPM reference if the current result is reasonable
 */
export function updateLastValidBpm(
  result: any,
  lastValidBpmRef: React.MutableRefObject<number>
): void {
  // Only update if we have a reasonable BPM with decent confidence
  if (result.bpm >= 40 && 
      result.bpm <= 200 && 
      result.confidence > 0.5) {
    
    // If we never had a valid BPM, use this one
    if (lastValidBpmRef.current === 0) {
      lastValidBpmRef.current = result.bpm;
    } else {
      // Smooth transition to new value
      lastValidBpmRef.current = 
        lastValidBpmRef.current * 0.7 + result.bpm * 0.3;
    }
  }
}

/**
 * Validates if a BPM value is physiologically reasonable
 */
export function isValidBPM(bpm: number): boolean {
  return bpm >= 40 && bpm <= 200;
}

/**
 * Calculates the stability of heart rate over time
 * Higher stability means more consistent measurements
 */
export function calculateHRStability(recentBPMs: number[]): number {
  if (recentBPMs.length < 3) {
    return 0;
  }
  
  // Calculate standard deviation of recent BPMs
  const mean = recentBPMs.reduce((sum, val) => sum + val, 0) / recentBPMs.length;
  const squaredDiffs = recentBPMs.map(bpm => Math.pow(bpm - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / squaredDiffs.length;
  const stdDev = Math.sqrt(avgSquaredDiff);
  
  // Convert stdDev to a 0-1 stability metric (lower stdDev = higher stability)
  const stability = Math.max(0, Math.min(1, 1 - (stdDev / 15)));
  
  return stability;
}
