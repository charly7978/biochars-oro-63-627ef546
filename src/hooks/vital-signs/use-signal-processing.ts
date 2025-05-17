
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useRef, useCallback } from 'react';
import { VitalSignsResult } from '../../modules/vital-signs/types/vital-signs-result';
import { VitalSignsProcessor } from '../../modules/vital-signs/VitalSignsProcessor';
import { ResultFactory } from '../../modules/vital-signs/factories/result-factory';

/**
 * Hook for processing signal using the VitalSignsProcessor
 * Direct measurement only, no simulation
 */
export const useSignalProcessing = () => {
  // Reference for processor instance
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const processedSignals = useRef<number>(0);
  const signalLog = useRef<{timestamp: number, value: number, result: any}[]>([]);
  
  /**
   * Process PPG signal directly
   * No simulation or reference values
   */
  const processSignal = useCallback((
    value: number 
  ): VitalSignsResult => {
    if (!processorRef.current) {
      console.log("useVitalSignsProcessor: Processor not initialized");
      return ResultFactory.createEmptyResults();
    }
    
    processedSignals.current++;
    
    // Logging para diagnóstico - más frecuente para depuración
    if (processedSignals.current % 3 === 0) {
      console.log("useVitalSignsProcessor: Processing signal DIRECTLY", {
        inputValue: value,
        arrhythmiaCount: processorRef.current.getArrhythmiaCount(),
        signalNumber: processedSignals.current
      });
    }
    
    try {
      // Process signal directly - no simulation
      let result = processorRef.current.processSignal(value);
      
      // Log detallado para resultados de procesamiento
      console.log("Signal processing result:", {
        heartRate: result.heartRate ? Math.round(result.heartRate) : 0,
        spo2: result.spo2 ? Math.round(result.spo2) : 0,
        glucose: result.glucose ? Math.round(result.glucose) : 0,
        arrhythmiaStatus: result.arrhythmiaStatus
      });
      
      // Verificar detección de arritmias con el nuevo formato "ARRITMIA"
      if (result && 
          result.arrhythmiaStatus && 
          typeof result.arrhythmiaStatus === 'string' && 
          result.arrhythmiaStatus.includes("ARRITMIA") && 
          result.lastArrhythmiaData) {
        const arrhythmiaTime = result.lastArrhythmiaData.timestamp;
        
        console.log("Arrhythmia detected:", {
          time: arrhythmiaTime,
          status: result.arrhythmiaStatus,
          rmssd: result.lastArrhythmiaData.rmssd,
          rrVariation: result.lastArrhythmiaData.rrVariation
        });
      }
      
      // Log processed signals
      signalLog.current.push({
        timestamp: Date.now(),
        value,
        result
      });
      
      if (signalLog.current.length > 100) {
        signalLog.current = signalLog.current.slice(-100);
      }
      
      // Always return real result
      return result;
    } catch (error) {
      console.error("Error processing vital signs:", error);
      
      // Return safe fallback values on error
      return ResultFactory.createEmptyResults();
    }
  }, []);

  /**
   * Initialize the processor
   * Direct measurement only
   */
  const initializeProcessor = useCallback(() => {
    console.log("useVitalSignsProcessor: Initializing processor for DIRECT MEASUREMENT ONLY", {
      timestamp: new Date().toISOString()
    });
    
    // Create new instances for direct measurement
    processorRef.current = new VitalSignsProcessor();
    
    // Log para debugging
    console.log("useVitalSignsProcessor: Initialized VitalSignsProcessor instance");
    
    // Verificar que el contador de arritmias está en cero
    if (processorRef.current) {
      console.log("ArrhythmiaCounter initial value:", processorRef.current.getArrhythmiaCount());
    }
  }, []);

  /**
   * Reset the processor
   * No simulations or reference values
   */
  const reset = useCallback(() => {
    if (!processorRef.current) return null;
    
    console.log("useVitalSignsProcessor: Reset initiated - DIRECT MEASUREMENT mode only");
    
    processorRef.current.reset();
    
    console.log("useVitalSignsProcessor: Reset completed - all values at zero for direct measurement");
    return null;
  }, []);
  
  /**
   * Perform full reset - clear all data
   * No simulations or reference values
   */
  const fullReset = useCallback(() => {
    if (!processorRef.current) return;
    
    console.log("useVitalSignsProcessor: Full reset initiated - DIRECT MEASUREMENT mode only");
    
    processorRef.current.fullReset();
    processedSignals.current = 0;
    signalLog.current = [];
    
    console.log("useVitalSignsProcessor: Full reset complete - direct measurement mode active");
  }, []);

  /**
   * Get the arrhythmia counter
   */
  const getArrhythmiaCounter = useCallback(() => {
    const count = processorRef.current?.getArrhythmiaCount() || 0;
    console.log("Getting arrhythmia counter:", count);
    return count;
  }, []);

  /**
   * Get debug information about signal processing
   */
  const getDebugInfo = useCallback(() => {
    return {
      processedSignals: processedSignals.current,
      signalLog: signalLog.current.slice(-10),
      arrhythmiaCount: processorRef.current?.getArrhythmiaCount() || 0
    };
  }, []);

  return {
    processSignal,
    initializeProcessor,
    reset,
    fullReset,
    getArrhythmiaCounter,
    getDebugInfo,
    processorRef,
    processedSignals,
    signalLog
  };
};
