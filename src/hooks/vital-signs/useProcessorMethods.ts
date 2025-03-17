
/**
 * ESTA PROHIBIDO EL USO DE SIMULACION Y MANIPULACION DE DATOS, APLICACION DE USO REFERENCIAL MEDICA
 */

import { useCallback, MutableRefObject } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../../modules/vital-signs/VitalSignsProcessor';
import { ArrhythmiaProcessor } from '../../modules/arrhythmia-processor';
import { SignalAnalyzer } from '../../modules/signal-analysis/SignalAnalyzer';

/**
 * Hook that provides the main processor methods
 * Only processes genuine signals without simulation
 */
export function useProcessorMethods(
  processorRef: MutableRefObject<VitalSignsProcessor | null>,
  arrhythmiaProcessorRef: MutableRefObject<ArrhythmiaProcessor | null>,
  lastArrhythmiaTimeRef: MutableRefObject<number>,
  signalQualityMonitor: any,
  signalLogger: any,
  setLastValidResults: (results: VitalSignsResult | null) => void,
  addArrhythmiaWindow: (start: number, end: number) => void,
  resetArrhythmiaWindows: () => void
) {
  /**
   * Process PPG signal directly without simulation or reference values
   */
  const processSignal = useCallback((value: number, rrData?: { intervals: number[], lastPeakTime: number | null }): VitalSignsResult => {
    if (!processorRef.current || !arrhythmiaProcessorRef.current) {
      console.error("DEBUG: useVitalSignsProcessor - Processor not initialized in processSignal call");
      return SignalAnalyzer.createEmptyResult();
    }
    
    // Check signal quality
    const qualityCheck = signalQualityMonitor.checkSignalQuality(value);
    if (qualityCheck.isWeakSignal) {
      return qualityCheck.result;
    }
    
    // Process vital signs with genuine data
    let result: VitalSignsResult;
    try {
      result = processorRef.current.processSignal(value, rrData);
      // Only log every 100th signal to avoid console flooding
      if (Math.random() < 0.01) {
        console.log("DEBUG: useVitalSignsProcessor - Signal processed", {
          value: value.toFixed(2),
          hasRRData: !!rrData,
          result: {
            spo2: result.spo2,
            pressure: result.pressure,
            arrhythmiaStatus: result.arrhythmiaStatus
          }
        });
      }
    } catch (error) {
      console.error("DEBUG: useVitalSignsProcessor - Error processing signal:", error);
      return SignalAnalyzer.createEmptyResult();
    }
    
    // Process arrhythmias if there is enough data and signal is good
    if (rrData && rrData.intervals.length >= 4 && signalQualityMonitor.weakSignalCount() === 0) {
      try {
        const arrhythmiaResult = arrhythmiaProcessorRef.current.processRRData(rrData);
        
        // Add arrhythmia status to result
        const formattedArrhythmiaResult = SignalAnalyzer.formatArrhythmiaResult(arrhythmiaResult);
        
        // Update result with arrhythmia data
        result = {
          ...result,
          arrhythmiaStatus: formattedArrhythmiaResult.arrhythmiaStatus
        };
        
        // If new arrhythmia detected, register visualization window
        if (
          arrhythmiaResult.lastArrhythmiaData && 
          arrhythmiaResult.lastArrhythmiaData.timestamp > lastArrhythmiaTimeRef.current
        ) {
          lastArrhythmiaTimeRef.current = arrhythmiaResult.lastArrhythmiaData.timestamp;
          
          // Create arrhythmia window
          const timestamp = arrhythmiaResult.lastArrhythmiaData.timestamp;
          const avgInterval = rrData.intervals.length > 0 
            ? rrData.intervals.reduce((sum, val) => sum + val, 0) / rrData.intervals.length
            : 800;
            
          const windowWidth = Math.max(300, Math.min(1000, avgInterval * 1.2));
          addArrhythmiaWindow(timestamp - windowWidth/2, timestamp + windowWidth/2);
          
          console.log("DEBUG: useVitalSignsProcessor - New arrhythmia detected", {
            timestamp,
            avgInterval,
            windowWidth,
            arrhythmiaCount: arrhythmiaProcessorRef.current.getArrhythmiaCounter()
          });
        }
      } catch (error) {
        console.error("DEBUG: useVitalSignsProcessor - Error processing arrhythmia:", error);
      }
    }
    
    // Log the signal and result
    signalLogger.logSignal(value, result);
    
    // Store the last valid result
    setLastValidResults(result);
    
    return result;
  }, [addArrhythmiaWindow, signalLogger, signalQualityMonitor, setLastValidResults]);

  const reset = useCallback((): void => {
    console.log("DEBUG: useVitalSignsProcessor - Reset initiated");
    
    if (!processorRef.current || !arrhythmiaProcessorRef.current) {
      console.error("DEBUG: useVitalSignsProcessor - Cannot reset, processors not initialized");
      return;
    }
    
    try {
      processorRef.current.reset();
      arrhythmiaProcessorRef.current.reset();
      resetArrhythmiaWindows();
      setLastValidResults(null);
      lastArrhythmiaTimeRef.current = 0;
      signalQualityMonitor.reset();
      
      console.log("DEBUG: useVitalSignsProcessor - Reset completed successfully");
    } catch (error) {
      console.error("DEBUG: useVitalSignsProcessor - Error during reset:", error);
    }
  }, [resetArrhythmiaWindows, signalQualityMonitor, setLastValidResults]);
  
  const fullReset = useCallback((): void => {
    console.log("DEBUG: useVitalSignsProcessor - Full reset initiated");
    
    if (!processorRef.current || !arrhythmiaProcessorRef.current) {
      console.error("DEBUG: useVitalSignsProcessor - Cannot full reset, processors not initialized");
      return;
    }
    
    try {
      processorRef.current.fullReset();
      arrhythmiaProcessorRef.current.reset();
      setLastValidResults(null);
      resetArrhythmiaWindows();
      signalLogger.reset();
      lastArrhythmiaTimeRef.current = 0;
      signalQualityMonitor.reset();
      
      console.log("DEBUG: useVitalSignsProcessor - Full reset completed successfully");
    } catch (error) {
      console.error("DEBUG: useVitalSignsProcessor - Error during full reset:", error);
    }
  }, [resetArrhythmiaWindows, signalLogger, signalQualityMonitor, setLastValidResults]);

  return {
    processSignal,
    reset,
    fullReset
  };
}
