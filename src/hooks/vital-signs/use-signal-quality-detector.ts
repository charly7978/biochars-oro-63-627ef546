
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useRef } from 'react';
import { checkSignalQuality } from '../../modules/heart-beat/signal-quality';

/**
 * Hook to detect weak signals or finger removal
 * No simulation is used - direct measurement only
 */
export const useSignalQualityDetector = () => {
  // Weak signal counter to detect finger removal
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const WEAK_SIGNAL_THRESHOLD = 0.15; // Increased from 0.10 to reduce false positives
  const MAX_CONSECUTIVE_WEAK_SIGNALS = 5; // Increased from 3 for more stability
  
  // Buffer for signal stability
  const recentValuesRef = useRef<number[]>([]);
  const MAX_RECENT_VALUES = 10;
  
  // Finger detection stabilizer
  const fingerDetectedBufferRef = useRef<boolean[]>([]);
  const DETECTION_BUFFER_SIZE = 8; // Larger buffer for smoother transitions
  
  /**
   * Check for weak signals based on real data amplitude using centralized function
   * Enhanced to reduce false positives
   */
  const detectWeakSignal = (value: number): boolean => {
    // Store value in recent buffer
    recentValuesRef.current.push(value);
    if (recentValuesRef.current.length > MAX_RECENT_VALUES) {
      recentValuesRef.current.shift();
    }
    
    // Calculate signal variance to detect unstable signals
    let isUnstable = false;
    if (recentValuesRef.current.length >= 5) {
      const recent = recentValuesRef.current.slice(-5);
      const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
      const variance = recent.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / recent.length;
      isUnstable = variance > 0.5; // High variance indicates unstable signal
    }
    
    // Use enhanced quality check with stricter criteria
    const { isWeakSignal, updatedWeakSignalsCount } = checkSignalQuality(
      value,
      consecutiveWeakSignalsRef.current,
      {
        lowSignalThreshold: WEAK_SIGNAL_THRESHOLD,
        maxWeakSignalCount: MAX_CONSECUTIVE_WEAK_SIGNALS
      }
    );
    
    consecutiveWeakSignalsRef.current = updatedWeakSignalsCount;
    
    // Combine weak signal with stability check
    const finalWeakSignal = isWeakSignal || isUnstable;
    
    // Update finger detection buffer for smoother transitions
    fingerDetectedBufferRef.current.push(!finalWeakSignal);
    if (fingerDetectedBufferRef.current.length > DETECTION_BUFFER_SIZE) {
      fingerDetectedBufferRef.current.shift();
    }
    
    // Only report no finger if majority of recent checks indicate weak signal
    const trueCount = fingerDetectedBufferRef.current.filter(x => x).length;
    const falseCount = fingerDetectedBufferRef.current.length - trueCount;
    
    // Require stronger consensus for finger detection (reduces false positives)
    return falseCount > trueCount * 1.5;
  };
  
  /**
   * Reset the signal quality detector
   */
  const reset = () => {
    consecutiveWeakSignalsRef.current = 0;
    recentValuesRef.current = [];
    fingerDetectedBufferRef.current = [];
  };
  
  return {
    detectWeakSignal,
    reset,
    consecutiveWeakSignalsRef,
    WEAK_SIGNAL_THRESHOLD,
    MAX_CONSECUTIVE_WEAK_SIGNALS
  };
};
