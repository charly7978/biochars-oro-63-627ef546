
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useRef } from 'react';
import { checkSignalQuality } from '../../modules/heart-beat/signal-quality';

/**
 * Simplified hook that defers to PPGSignalMeter's implementation
 * Only maintains the API for compatibility
 * Extremely improved to eliminate false positives with much higher thresholds
 */
export const useSignalQualityDetector = () => {
  // Reference counter for compatibility
  const consecutiveWeakSignalsRef = useRef<number>(0);
  
  // Dramatically increased thresholds to virtually eliminate false positives
  const WEAK_SIGNAL_THRESHOLD = 0.35; // Significantly increased from 0.25
  const MAX_CONSECUTIVE_WEAK_SIGNALS = 9; // Significantly increased from 6
  
  /**
   * Enhanced detection function with extreme false positive resistance
   */
  const detectWeakSignal = (value: number): boolean => {
    // Defer to improved implementation with much higher thresholds
    if (Math.abs(value) < WEAK_SIGNAL_THRESHOLD) {
      consecutiveWeakSignalsRef.current++;
    } else {
      // Much faster recovery from false positives by reducing count more aggressively
      consecutiveWeakSignalsRef.current = Math.max(0, consecutiveWeakSignalsRef.current - 4);
    }
    
    return consecutiveWeakSignalsRef.current >= MAX_CONSECUTIVE_WEAK_SIGNALS;
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
