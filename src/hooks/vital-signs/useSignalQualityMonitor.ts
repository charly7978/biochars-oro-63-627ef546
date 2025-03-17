
/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 */
import { useRef } from 'react';
import { ProcessorConfig } from '../../modules/vital-signs/ProcessorConfig';
import { SignalAnalyzer } from '../../modules/signal-analysis/SignalAnalyzer';

export function useSignalQualityMonitor() {
  // Weak signal counter to detect finger removal
  const consecutiveWeakSignalsRef = useRef<number>(0);
  const WEAK_SIGNAL_THRESHOLD = ProcessorConfig.WEAK_SIGNAL_THRESHOLD;
  const MAX_CONSECUTIVE_WEAK_SIGNALS = 3;
  
  const checkSignalQuality = (value: number) => {
    // Check for weak signal to detect finger removal
    if (Math.abs(value) < WEAK_SIGNAL_THRESHOLD) {
      consecutiveWeakSignalsRef.current++;
      
      // If too many weak signals, return zeros
      if (consecutiveWeakSignalsRef.current > MAX_CONSECUTIVE_WEAK_SIGNALS) {
        console.log("SignalQualityMonitor: Too many weak signals, returning zeros", {
          weakSignals: consecutiveWeakSignalsRef.current,
          threshold: MAX_CONSECUTIVE_WEAK_SIGNALS,
          value
        });
        return {
          isWeakSignal: true,
          result: SignalAnalyzer.createEmptyResult()
        };
      }
    } else {
      // Reset weak signal counter
      consecutiveWeakSignalsRef.current = 0;
    }
    
    return {
      isWeakSignal: false,
      weakSignalCount: consecutiveWeakSignalsRef.current
    };
  };
  
  const reset = () => {
    consecutiveWeakSignalsRef.current = 0;
  };
  
  return {
    checkSignalQuality,
    reset,
    weakSignalCount: () => consecutiveWeakSignalsRef.current
  };
}
