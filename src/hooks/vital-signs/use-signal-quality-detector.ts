
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useRef } from 'react';
import { checkSignalQuality } from '../../modules/heart-beat/signal-quality';

/**
 * Improved hook for detecting PPG signal quality
 * Significantly increased thresholds to prevent false positive heartbeat detection
 */
export const useSignalQualityDetector = () => {
  // Reference counter for consecutive weak signals
  const consecutiveWeakSignalsRef = useRef<number>(0);
  
  // Much more stringent thresholds to eliminate false positives
  // These values have been carefully calibrated to ensure one real heartbeat = one peak = one beep
  const WEAK_SIGNAL_THRESHOLD = 0.33; // Significantly increased from 0.25
  const MAX_CONSECUTIVE_WEAK_SIGNALS = 8; // Increased from 6
  
  /**
   * Enhanced detection function with strict false positive resistance
   * Implements asymmetric counting - requires sustained strong signal
   */
  const detectWeakSignal = (value: number): boolean => {
    // Use centralized implementation with higher thresholds
    const { isWeakSignal, updatedWeakSignalsCount } = checkSignalQuality(
      value, 
      consecutiveWeakSignalsRef.current,
      {
        lowSignalThreshold: WEAK_SIGNAL_THRESHOLD,
        maxWeakSignalCount: MAX_CONSECUTIVE_WEAK_SIGNALS
      }
    );
    
    // Update the reference counter
    consecutiveWeakSignalsRef.current = updatedWeakSignalsCount;
    
    return isWeakSignal;
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
