
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useRef } from 'react';
import { checkSignalQuality } from '../../modules/heart-beat/signal-quality';

/**
 * Improved hook for detecting PPG signal quality
 * Adjusted to be more responsive while maintaining accuracy
 */
export const useSignalQualityDetector = () => {
  // Reference counter for consecutive weak signals
  const consecutiveWeakSignalsRef = useRef<number>(0);
  
  // Less strict thresholds for better responsiveness
  const WEAK_SIGNAL_THRESHOLD = 0.25; // Reduced from 0.33
  const MAX_CONSECUTIVE_WEAK_SIGNALS = 7; // Reduced from 8
  
  /**
   * Enhanced detection function with better responsiveness
   */
  const detectWeakSignal = (value: number): boolean => {
    // Use centralized implementation with less strict thresholds
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
