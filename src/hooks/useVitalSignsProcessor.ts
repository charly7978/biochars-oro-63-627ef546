/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useCallback, useRef } from 'react';
import { VitalSignsProcessor, DetailedSignalQuality } from '@/modules/vital-signs/VitalSignsProcessor';
import { VitalSignsResult } from '@/modules/vital-signs/types/vital-signs-result';
import { ArrhythmiaWindow } from '@/hooks/vital-signs/types';
import { useArrhythmiaVisualization } from './vital-signs/use-arrhythmia-visualization';
import { useVitalSignsLogging } from './vital-signs/use-vital-signs-logging';

// Re-export DetailedSignalQuality so other hooks can import it from here
export type { DetailedSignalQuality };

// Define the return type for the hook, including the new getter
export interface UseVitalSignsProcessorReturn {
  processSignal: (value: number, rrData?: { intervals: number[], lastPeakTime: number | null }) => VitalSignsResult | null;
  reset: () => null; // Reset now consistently returns null
  fullReset: () => void;
  arrhythmiaCounter: number;
  lastValidResults: VitalSignsResult | null; // Value from the processor instance
  arrhythmiaWindows: ArrhythmiaWindow[];
  debugInfo: { processedSignals: number; signalLog: { timestamp: number, value: number, result: any }[]; };
  getDetailedQuality: () => DetailedSignalQuality;
}

export const useVitalSignsProcessor = (): UseVitalSignsProcessorReturn => {
  // Keep a single instance of the processor using useRef
  const processorRef = useRef<VitalSignsProcessor>(new VitalSignsProcessor());

  // Hooks for specific functionalities
  const { arrhythmiaWindows, addArrhythmiaWindow, clearArrhythmiaWindows } = useArrhythmiaVisualization();
  const { logSignalData, clearLog, getSignalLog } = useVitalSignsLogging();

  // State for values that need to trigger re-renders in consuming components
  const [arrhythmiaCounter, setArrhythmiaCounter] = useState(0);
  // Note: lastValidResults is now directly from processorRef.current if needed outside, or handled by useOptimizedVitalSigns

  // Ref to track processed signals count without causing re-renders
  const processedSignalsRef = useRef(0);

  const processSignal = useCallback((value: number, rrData?: { intervals: number[], lastPeakTime: number | null }): VitalSignsResult | null => {
    processedSignalsRef.current += 1;

    // Process the signal using the processor instance
    const result = processorRef.current.processSignal(value, rrData);

    // Update state and perform side effects only if we get a valid result
    if (result) {
      const currentArrhythmiaCount = processorRef.current.getArrhythmiaCounter();
      if (currentArrhythmiaCount !== arrhythmiaCounter) {
         setArrhythmiaCounter(currentArrhythmiaCount);
      }

      logSignalData(value, result, processedSignalsRef.current);

      // Corrected call to addArrhythmiaWindow with start and end arguments
      if (result.lastArrhythmiaData && result.arrhythmiaStatus !== '--' && result.arrhythmiaStatus !== 'normal') {
          const now = Date.now();
          // Pass start and end times as separate arguments
          addArrhythmiaWindow(now - 1000, now);
       }
    } else {
       // Handle null result (e.g., log quality issue if needed)
       // console.log("useVitalSignsProcessor: processSignal returned null due to low quality.");
    }

    return result;
  }, [addArrhythmiaWindow, logSignalData, arrhythmiaCounter]); // Added arrhythmiaCounter dependency

  const reset = useCallback((): null => {
    processorRef.current.reset(); // Reset the processor instance
    clearArrhythmiaWindows(); // Use clearArrhythmiaWindows
    setArrhythmiaCounter(0);
    clearLog();
    processedSignalsRef.current = 0;
    return null;
  }, [clearArrhythmiaWindows, clearLog]);

  const fullReset = useCallback((): void => {
    processorRef.current.fullReset();
    clearArrhythmiaWindows(); // Use clearArrhythmiaWindows
    setArrhythmiaCounter(0);
    clearLog();
    processedSignalsRef.current = 0;
  }, [clearArrhythmiaWindows, clearLog]);

  // Getter function for detailed quality
  const getDetailedQuality = useCallback((): DetailedSignalQuality => {
      // Ensure processor exists, though it should with useRef initialization
      return processorRef.current?.getDetailedQuality() ?? { cardiacClarity: 0, ppgStability: 0, overallQuality: 0 };
  }, []);

  return {
    processSignal,
    reset,
    fullReset,
    // Provide state/ref values via getters if they don't need to be memoized individually
    get arrhythmiaCounter() {
      return arrhythmiaCounter;
    },
    get lastValidResults() {
      // Directly return the processor's last valid results if needed, 
      // but useOptimizedVitalSigns likely manages its own display state
      return processorRef.current?.getLastValidResults() ?? null;
    },
    arrhythmiaWindows,
    get debugInfo() {
       return {
           processedSignals: processedSignalsRef.current,
           signalLog: getSignalLog()
       };
    },
    getDetailedQuality // Return the getter function
  };
};
