
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

/**
 * Hook for processing vital signs with direct algorithms only
 * No simulation or reference values are used
 */
export const useVitalSignsProcessor = (): UseVitalSignsProcessorReturn => {
  // State management - only direct measurement, no simulation
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  
  // Session tracking
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  // Signal quality tracking - reducidos los umbrales para mayor sensibilidad
  const weakSignalsCountRef = useRef<number>(0);
  const LOW_SIGNAL_THRESHOLD = 0.04; // Reducido para mayor sensibilidad
  const MAX_WEAK_SIGNALS = 8; // Reducido para detección más rápida
  
  // Tiempo de inicio de procesamiento
  const startTimeRef = useRef<number | null>(null);
  
  // Señales procesadas
  const signalCountRef = useRef<number>(0);
  
  const { 
    arrhythmiaWindows, 
    addArrhythmiaWindow, 
    clearArrhythmiaWindows 
  } = useArrhythmiaVisualization();
  
  const { 
    processSignal: processVitalSignal, 
    initializeProcessor,
    reset: resetProcessor, 
    fullReset: fullResetProcessor,
    getArrhythmiaCounter,
    getDebugInfo,
    processedSignals,
    vitalSignsProcessor
  } = useSignalProcessing();
  
  const { 
    logSignalData, 
    clearLog 
  } = useVitalSignsLogging();
  
  // Initialize processor components - direct measurement only
  useEffect(() => {
    console.log("useVitalSignsProcessor: Inicializando procesador para MEDICIÓN DIRECTA ÚNICAMENTE", {
      sessionId: sessionId.current,
      timestamp: new Date().toISOString()
    });
    
    // Create new instances for direct measurement
    initializeProcessor();
    
    return () => {
      console.log("useVitalSignsProcessor: Limpieza del procesador", {
        sessionId: sessionId.current,
        totalArrhythmias: getArrhythmiaCounter(),
        processedSignals: processedSignals.current,
        timestamp: new Date().toISOString()
      });
    };
  }, [initializeProcessor, getArrhythmiaCounter, processedSignals]);
  
  /**
   * Aplicar calibración manual de presión arterial
   */
  const applyBloodPressureCalibration = (systolic: number, diastolic: number): void => {
    if (vitalSignsProcessor.current) {
      vitalSignsProcessor.current.applyBloodPressureCalibration(systolic, diastolic);
      console.log("useVitalSignsProcessor: Calibración aplicada", {
        systolic,
        diastolic,
        timestamp: new Date().toISOString()
      });
    }
  };
  
  /**
   * Process PPG signal directly
   * No simulation or reference values
   */
  const processSignal = (value: number, rrData?: { intervals: number[], lastPeakTime: number | null }): VitalSignsResult => {
    signalCountRef.current++;
    
    // Iniciar temporizador en la primera señal
    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }
    
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
    
    // Process signal directly - no simulation
    try {
      let result = processVitalSignal(value, rrData, isWeakSignal);
      const currentTime = Date.now();
      
      // Add safe null check for arrhythmiaStatus
      if (result && 
          result.arrhythmiaStatus && 
          typeof result.arrhythmiaStatus === 'string' && 
          result.arrhythmiaStatus.includes("ARRHYTHMIA DETECTED") && 
          result.lastArrhythmiaData) {
        const arrhythmiaTime = result.lastArrhythmiaData.timestamp;
        
        // Window based on real heart rate
        let windowWidth = 400;
        
        // Adjust based on real RR intervals
        if (rrData && rrData.intervals && rrData.intervals.length > 0) {
          const lastIntervals = rrData.intervals.slice(-4);
          const avgInterval = lastIntervals.reduce((sum, val) => sum + val, 0) / lastIntervals.length;
          windowWidth = Math.max(300, Math.min(1000, avgInterval * 1.1));
        }
        
        addArrhythmiaWindow(arrhythmiaTime - windowWidth/2, arrhythmiaTime + windowWidth/2);
      }
      
      // Log processed signals
      logSignalData(value, result, processedSignals.current);
      
      // Registro periódico del estado del procesamiento
      const elapsedTime = currentTime - (startTimeRef.current || currentTime);
      if (signalCountRef.current % 200 === 0) {
        console.log("useVitalSignsProcessor: Estado del procesamiento", {
          señalesProcesadas: signalCountRef.current,
          tiempoTranscurrido: elapsedTime / 1000,
          señalesCalidad: weakSignalsCountRef.current,
          umbralSeñalDébil: LOW_SIGNAL_THRESHOLD,
          máximoSeñalesDébiles: MAX_WEAK_SIGNALS,
          presión: result.pressure
        });
      }
      
      // Guardar resultados válidos
      if (result.pressure !== "--/--" && result.spo2 > 0) {
        setLastValidResults(result);
      }
      
      // Always return real result
      return result;
    } catch (error) {
      console.error("Error procesando signos vitales:", error);
      
      // Return safe fallback values on error that include hydration
      return {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--",
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        },
        hemoglobin: 0,
        hydration: 0
      };
    }
  };

  /**
   * Perform complete reset - start from zero
   * No simulations or reference values
   */
  const reset = () => {
    resetProcessor();
    clearArrhythmiaWindows();
    setLastValidResults(null);
    weakSignalsCountRef.current = 0;
    startTimeRef.current = null;
    signalCountRef.current = 0;
    
    return null;
  };
  
  /**
   * Perform full reset - clear all data
   * No simulations or reference values
   */
  const fullReset = () => {
    fullResetProcessor();
    setLastValidResults(null);
    clearArrhythmiaWindows();
    weakSignalsCountRef.current = 0;
    startTimeRef.current = null;
    signalCountRef.current = 0;
    clearLog();
  };

  return {
    processSignal,
    reset,
    fullReset,
    applyBloodPressureCalibration,
    arrhythmiaCounter: getArrhythmiaCounter(),
    lastValidResults, // Devolver los últimos resultados válidos guardados
    arrhythmiaWindows,
    debugInfo: getDebugInfo()
  };
};
