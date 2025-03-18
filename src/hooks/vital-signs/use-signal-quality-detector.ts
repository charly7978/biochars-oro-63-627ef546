
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useRef } from 'react';
import { checkSignalQuality } from '../../modules/heart-beat/signal-quality';

/**
 * Simplified hook that defers to PPGSignalMeter's implementation
 * Only maintains the API for compatibility
 * Improved to reduce false positives with higher thresholds
 */
export const useSignalQualityDetector = () => {
  // Reference counter for compatibility
  const consecutiveWeakSignalsRef = useRef<number>(0);
  
  // Increased thresholds to reduce false positives
  const WEAK_SIGNAL_THRESHOLD = 0.15; // Increased from 0.10
  const MAX_CONSECUTIVE_WEAK_SIGNALS = 4; // Increased from 3
  
  /**
   * Enhanced detection function with improved false positive resistance
   */
  const detectWeakSignal = (value: number): boolean => {
    // Defer to improved implementation with higher thresholds
    if (Math.abs(value) < WEAK_SIGNAL_THRESHOLD) {
      consecutiveWeakSignalsRef.current++;
    } else {
      // Faster recovery from false positives by reducing count more quickly
      consecutiveWeakSignalsRef.current = Math.max(0, consecutiveWeakSignalsRef.current - 2);
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
