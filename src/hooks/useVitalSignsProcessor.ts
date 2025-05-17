
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useRef, useEffect } from 'react';
import { VitalSignsResult } from '../modules/vital-signs/types/vital-signs-result';
import { useArrhythmiaVisualization } from './vital-signs/use-arrhythmia-visualization';
import { useSignalProcessing } from './vital-signs/use-signal-processing';
import { useVitalSignsLogging } from './vital-signs/use-vital-signs-logging';
import { UseVitalSignsProcessorReturn } from './vital-signs/types';

/**
 * Hook for processing vital signs with direct algorithms only
 * No simulation or reference values are used
 */
export const useVitalSignsProcessor = (): UseVitalSignsProcessorReturn => {
  // State management - only direct measurement, no simulation
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  
  // Session tracking
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
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
      timestamp: new Date().toISOString()
    });
    
    // Create new instances for direct measurement
    initializeProcessor();
    
    return () => {
      console.log("useVitalSignsProcessor: Processor cleanup", {
        sessionId: sessionId.current,
        totalArrhythmias: getArrhythmiaCounter(),
        processedSignals: processedSignals.current,
        timestamp: new Date().toISOString()
      });
    };
  }, [initializeProcessor, getArrhythmiaCounter, processedSignals]);
  
  /**
   * Process PPG signal directly
   * No simulation or reference values
   */
  const processSignal = (value: number): VitalSignsResult => {
    try {
      // Process signal directly - no simulation - fixed parameter count
      let result = processVitalSignal(value);
      
      // Log detallado SIEMPRE para supervisar resultados - no condicionado
      console.log("useVitalSignsProcessor: Resultado procesamiento:", {
        heartRate: result.heartRate ? Math.round(result.heartRate) : 0,
        spo2: result.spo2 ? Math.round(result.spo2) : 0,
        arrhythmiaStatus: result.arrhythmiaStatus,
        hemoglobin: result.hemoglobin ? Math.round(result.hemoglobin * 10) / 10 : 0,
        pressure: result.pressure,
        glucose: result.glucose ? Math.round(result.glucose) : 0,
        lipids: result.lipids ? {
          totalCholesterol: Math.round(result.lipids.totalCholesterol),
          triglycerides: Math.round(result.lipids.triglycerides)
        } : { totalCholesterol: 0, triglycerides: 0 }
      });
      
      // Redondeo numérico para visualización consistente
      if (result.heartRate) result.heartRate = Math.round(result.heartRate);
      if (result.spo2) result.spo2 = Math.round(result.spo2);
      if (result.glucose) result.glucose = Math.round(result.glucose);
      if (result.hemoglobin) result.hemoglobin = Math.round(result.hemoglobin * 10) / 10;
      if (result.hydration) result.hydration = Math.round(result.hydration);
      if (result.lipids) {
        result.lipids.totalCholesterol = Math.round(result.lipids.totalCholesterol);
        result.lipids.triglycerides = Math.round(result.lipids.triglycerides);
      }
      
      const currentTime = Date.now();
      
      // Verificar detección de arritmias - usando el formato estandarizado "ARRITMIA"
      if (result && 
          result.arrhythmiaStatus && 
          typeof result.arrhythmiaStatus === 'string' && 
          result.arrhythmiaStatus.includes("ARRITMIA") && 
          result.lastArrhythmiaData) {
        
        // Agregar log adicional para confirmar detección de arritmia
        console.log("useVitalSignsProcessor: ¡ARRITMIA DETECTADA!", {
          status: result.arrhythmiaStatus,
          timestamp: result.lastArrhythmiaData.timestamp,
          rmssd: result.lastArrhythmiaData.rmssd,
          rrVariation: result.lastArrhythmiaData.rrVariation
        });
        
        const arrhythmiaTime = result.lastArrhythmiaData.timestamp;
        
        // Window based on real heart rate
        let windowWidth = 400;
        
        // Agregar ventana visual para la arritmia
        addArrhythmiaWindow(arrhythmiaTime - windowWidth/2, arrhythmiaTime + windowWidth/2);
      }
      
      // Log processed signals
      logSignalData(value, result, processedSignals.current);
      
      // Actualizar lastValidResults SIEMPRE que haya un resultado con heartRate
      if (result && result.heartRate && result.heartRate > 0) {
        setLastValidResults(result);
      }
      
      // Always return real result
      return result;
    } catch (error) {
      console.error("Error processing vital signs:", error);
      
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
    
    // Almacenar el último resultado válido antes del reset
    const result = lastValidResults;
    
    // Luego hacer el reset de UI
    setLastValidResults(null);
    
    return result;
  };
  
  /**
   * Perform full reset - clear all data
   * No simulations or reference values
   */
  const fullReset = () => {
    fullResetProcessor();
    setLastValidResults(null);
    clearArrhythmiaWindows();
    clearLog();
  };

  return {
    processSignal,
    reset,
    fullReset,
    arrhythmiaCounter: getArrhythmiaCounter(),
    lastValidResults,
    arrhythmiaWindows,
    debugInfo: getDebugInfo()
  };
};
