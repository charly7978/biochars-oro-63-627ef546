/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Functions for processing heart beat results
 */

/**
 * Update last valid BPM reference
 * Simple implementation without complex validation
 */
export const updateLastValidBpm = (
  result: any,
  lastValidBpmRef: React.MutableRefObject<number>,
): void => {
  if (result && result.bpm > 40 && result.bpm < 220 && result.confidence > 0.5) {
    lastValidBpmRef.current = result.bpm;
  }
}

/**
 * Process result with low confidence
 * Simpler implementation without advanced algorithms
 */
export const processLowConfidenceResult = (
  result: any,
  currentBPM: number,
  arrhythmiaCount: number
): any => {
  // If confidence is too low, use current BPM
  if (result.confidence < 0.3) {
    return {
      ...result,
      bpm: currentBPM > 0 ? currentBPM : result.bpm,
      arrhythmiaCount
    };
  }
  
  // Otherwise use result as is
  return {
    ...result,
    arrhythmiaCount
  };
}
