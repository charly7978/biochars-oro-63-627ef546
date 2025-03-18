
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useRef } from 'react';

/**
 * Hook to detect weak signals or finger removal
 * No simulation is used
 */
export const useSignalQualityDetector = () => {
  // Weak signal counter to detect finger removal
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const WEAK_SIGNAL_THRESHOLD = 0.10;
  const MAX_CONSECUTIVE_WEAK_SIGNALS = 3;
  
  /**
   * Check for weak signals based on real data amplitude
   */
  const detectWeakSignal = (value: number): boolean => {
    // Check for weak signal to detect finger removal
    if (Math.abs(value) < WEAK_SIGNAL_THRESHOLD) {
      consecutiveWeakSignalsRef.current++;
      
      // If too many weak signals, signal is invalid
      if (consecutiveWeakSignalsRef.current > MAX_CONSECUTIVE_WEAK_SIGNALS) {
        return true;
      }
    } else {
      // Reset weak signal counter
      consecutiveWeakSignalsRef.current = 0;
    }
    
    return false;
  };
  
  /**
   * Reset the signal quality detector
   */
  const reset = () => {
    consecutiveWeakSignalsRef.current = 0;
  };
  
  return {
    detectWeakSignal,
    reset,
    consecutiveWeakSignalsRef,
    WEAK_SIGNAL_THRESHOLD,
    MAX_CONSECUTIVE_WEAK_SIGNALS
  };
};
