/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useRef, useEffect } from 'react';
import { VitalSignsResult } from '../modules/vital-signs/types/vital-signs-result';
import { useArrhythmiaVisualization } from './vital-signs/use-arrhythmia-visualization';
import { useSignalProcessing } from './vital-signs/use-signal-processing';
import { useVitalSignsLogging } from './vital-signs/use-vital-signs-logging';
import { UseVitalSignsProcessorReturn } from './vital-signs/types';
import { checkSignalQuality } from '../modules/heart-beat/signal-quality';
import { FeedbackService } from '../services/FeedbackService';
import { ResultFactory } from '../modules/vital-signs/factories/result-factory';

/**
 * Hook for processing vital signs with direct algorithms only
 * No simulation or reference values are used
 */
export const useVitalSignsProcessor = (): UseVitalSignsProcessorReturn => {
  // State management - only direct measurement, no simulation
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  
  // Session tracking
  const sessionId = useRef<string>(Date.now().toString(36));
  
  // Signal quality tracking
  const weakSignalsCountRef = useRef<number>(0);
  const LOW_SIGNAL_THRESHOLD = 0.05;
  const MAX_WEAK_SIGNALS = 10;
  
  // Centralized arrhythmia tracking
  const { 
    arrhythmiaWindows, 
    addArrhythmiaWindow, 
    clearArrhythmiaWindows,
    processArrhythmiaStatus,
    registerArrhythmiaNotification
  } = useArrhythmiaVisualization();
  
  const { 
    processSignal: processVitalSignal, 
    initializeProcessor,
    reset: resetProcessor, 
    fullReset: fullResetProcessor,
    getArrhythmiaCounter,
    getDebugInfo,
    processedSignals
  } = useSignalProcessing();
  
  const { 
    logSignalData, 
    clearLog 
  } = useVitalSignsLogging();
  
  // Initialize processor components - direct measurement only
  useEffect(() => {
    console.log("useVitalSignsProcessor: Initializing processor for DIRECT MEASUREMENT ONLY", {
      sessionId: sessionId.current,
      timestamp: Date.now()
    });
    
    // Create new instances for direct measurement
    const processor = initializeProcessor();
    console.log("Processor initialized:", !!processor);
    
    return () => {
      console.log("useVitalSignsProcessor: Processor cleanup", {
        sessionId: sessionId.current,
        totalArrhythmias: getArrhythmiaCounter(),
        processedSignals: processedSignals.current,
        timestamp: Date.now()
      });
    };
  }, [initializeProcessor, getArrhythmiaCounter, processedSignals]);
  
  /**
   * Process PPG signal directly
   * No simulation or reference values
   */
  const processSignal = (value: number, rrData?: { intervals: number[], lastPeakTime: number | null }): VitalSignsResult => {
    // Check for weak signal to detect finger removal using centralized function
    const { isWeakSignal, updatedWeakSignalsCount } = checkSignalQuality(
      value,
      weakSignalsCountRef.current,
      {
        lowSignalThreshold: LOW_SIGNAL_THRESHOLD,
        maxWeakSignalCount: MAX_WEAK_SIGNALS
      }
    );
    
    weakSignalsCountRef.current = updatedWeakSignalsCount;
    
    // Log input value for debugging
    console.log("useVitalSignsProcessor: Processing signal input", {
      value,
      isWeakSignal,
      weakSignalsCount: weakSignalsCountRef.current
    });
    
    // Process signal directly - no simulation
    try {
      let result = processVitalSignal(value, rrData, isWeakSignal);
      
      // Process and handle arrhythmia events with our centralized system
      if (result && result.arrhythmiaStatus && result.lastArrhythmiaData) {
        const shouldNotify = processArrhythmiaStatus(
          result.arrhythmiaStatus, 
          result.lastArrhythmiaData
        );
        
        // Trigger feedback for arrhythmia if needed
        if (shouldNotify) {
          registerArrhythmiaNotification();
          const count = parseInt(result.arrhythmiaStatus.split('|')[1] || '0');
          FeedbackService.signalArrhythmia(count);
        }
      }
      
      // Log processed signals
      logSignalData(value, result, processedSignals.current);
      
      // Save valid results - IMPORTANT: Do this regardless of nullity in fields to ensure UI updates
      if (result) {
        console.log("Saving valid result:", {
          heartRate: result.heartRate,
          spo2: result.spo2,
          pressure: result.pressure 
        });
        setLastValidResults(result);
        
        // Keep lastValidResults updated with the most recent data
        if (result.heartRate === 0 && lastValidResults && lastValidResults.heartRate > 0) {
          result.heartRate = lastValidResults.heartRate;
        }
      }
      
      // Return processed result directly to ensure data flows to UI
      return result;
    } catch (error) {
      console.error("Error processing vital signs:", error);
      return lastValidResults || ResultFactory.createEmptyResults();
    }
  };

  /**
   * Perform complete reset - start from zero
   * No simulations or reference values
   */
  const reset = () => {
    console.log("useVitalSignsProcessor: Reset initiated");
    resetProcessor();
    clearArrhythmiaWindows();
    setLastValidResults(null);
    weakSignalsCountRef.current = 0;
    console.log("useVitalSignsProcessor: Reset completed");
    
    return null;
  };
  
  /**
   * Perform full reset - clear all data
   * No simulations or reference values
   */
  const fullReset = () => {
    console.log("useVitalSignsProcessor: Full reset initiated");
    fullResetProcessor();
    setLastValidResults(null);
    clearArrhythmiaWindows();
    weakSignalsCountRef.current = 0;
    clearLog();
    console.log("useVitalSignsProcessor: Full reset completed");
  };

  return {
    processSignal,
    reset,
    fullReset,
    arrhythmiaCounter: getArrhythmiaCounter(),
    lastValidResults: lastValidResults, // Return last valid results
    arrhythmiaWindows,
    debugInfo: getDebugInfo()
  };
};
