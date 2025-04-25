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
import { PPGProcessor } from '../core/signal/PPGProcessor';

/**
 * Hook for processing vital signs with direct algorithms only
 * No simulation or reference values are used
 */
export const useVitalSignsProcessor = (): UseVitalSignsProcessorReturn => {
  // State management - only direct measurement, no simulation
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  
  // Session tracking
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  // Signal quality tracking - MODIFICADO: Umbrales más permisivos
  const weakSignalsCountRef = useRef<number>(0);
  const LOW_SIGNAL_THRESHOLD = 0.02; // MODIFICADO: Umbral más permisivo (0.03 → 0.02)
  const MAX_WEAK_SIGNALS = 10;      // MODIFICADO: Mayor tolerancia (15 → 10)
  
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
    processedSignals,
    getLastValidResults
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
  
  // Initialize PPG processor for frame processing
  const ppgProcessorRef = useRef<PPGProcessor | null>(null);

  useEffect(() => {
    // Initialize PPG processor for frame processing
    ppgProcessorRef.current = new PPGProcessor((signal) => {
      // Process signal when ready
      if (signal && signal.filteredValue && signal.fingerDetected) {
        processSignal(signal.filteredValue);
      }
    });
    
    ppgProcessorRef.current.initialize();
    
    return () => {
      if (ppgProcessorRef.current) {
        ppgProcessorRef.current.stop();
      }
    };
  }, []);

  /**
   * Process PPG signal directly
   * No simulation or reference values
   */
  const processSignal = (value: number, rrData?: { intervals: number[], lastPeakTime: number | null }): VitalSignsResult => {
    console.log("useVitalSignsProcessor: Processing signal with value", { 
      value, 
      hasRRData: !!rrData,
      rrIntervals: rrData?.intervals?.length || 0
    });
    
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
      // MODIFICADO: Procesamos la señal incluso si es débil para obtener más resultados
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
      
      // Log más detallado para debug - MODIFICADO: Frecuencia reducida para claridad
      if (processedSignals.current % 20 === 0) {
        console.log("useVitalSignsProcessor: Evaluating results", {
          sessionId: sessionId.current,
          processCount: processedSignals.current,
          heartRate: result.heartRate,
          spo2: result.spo2,
          pressure: result.pressure,
          glucose: result.glucose,
          hydration: result.hydration,
          lipids: result.lipids,
          hemoglobin: result.hemoglobin
        });
      }
      
      // Guardar resultados - MEJORA: verificación individual más clara
      if (result) {
        let hasValidData = false;
        let logDetails = {
          hasHeartRate: false,
          hasSpo2: false,
          hasPressure: false,
          hasGlucose: false,
          hasLipids: false,
          hasHemoglobin: false,
          hasHydration: false,
          result: {} as any
        };
        
        // Verificar cada signo vital individualmente
        if (result.heartRate > 0) {
          hasValidData = true;
          logDetails.hasHeartRate = true;
        }
        
        if (result.spo2 > 0) {
          hasValidData = true;
          logDetails.hasSpo2 = true;
        }
        
        if (result.pressure && result.pressure !== "--/--") {
          hasValidData = true;
          logDetails.hasPressure = true;
        }
        
        if (result.glucose > 0) {
          hasValidData = true;
          logDetails.hasGlucose = true;
        }
        
        if ((result.lipids && result.lipids.totalCholesterol > 0) || 
            (result.lipids && result.lipids.triglycerides > 0)) {
          hasValidData = true;
          logDetails.hasLipids = true;
        }
        
        if (result.hemoglobin > 0) {
          hasValidData = true;
          logDetails.hasHemoglobin = true;
        }
        
        if (result.hydration > 0) {
          hasValidData = true;
          logDetails.hasHydration = true;
        }
        
        logDetails.result = {
          heartRate: result.heartRate,
          spo2: result.spo2,
          pressure: result.pressure,
          glucose: result.glucose,
          hydration: result.hydration,
          lipids: result.lipids,
          hemoglobin: result.hemoglobin
        };
        
        // MODIFICADO: Solo logeamos cuando realmente hay un cambio para evitar spam
        if (processedSignals.current % 20 === 0) {
          console.log("useVitalSignsProcessor: Validating results", logDetails);
        }
        
        // MODIFICADO: Más permisivo con guardar resultados
        // Siempre guardamos el resultado si hay al menos un dato válido
        if (hasValidData) {
          console.log("useVitalSignsProcessor: Guardando resultado válido", result);
          setLastValidResults(result);
        } else if (processedSignals.current % 20 === 0) {
          console.log("useVitalSignsProcessor: No hay datos válidos para guardar");
          
          // MODIFICADO: Intento recuperar el último resultado válido del procesador
          const lastValidFromProcessor = getLastValidResults();
          if (lastValidFromProcessor) {
            console.log("useVitalSignsProcessor: Recuperado último resultado válido del procesador", lastValidFromProcessor);
            setLastValidResults(lastValidFromProcessor);
          }
        }
      }
      
      // Return processed result
      return result;
    } catch (error) {
      console.error("Error processing vital signs:", error);
      
      // Return safe fallback values on error
      return {
        spo2: 0,
        heartRate: 0,
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
    clearLog();
  };

  /**
   * Process video frame and extract PPG signal
   * @param imageData Raw image data from camera
   * @returns Processed signal data or null if not ready
   */
  const processFrame = (imageData: ImageData) => {
    try {
      if (ppgProcessorRef.current) {
        ppgProcessorRef.current.processFrame(imageData);
        return ppgProcessorRef.current;
      }
      return null;
    } catch (error) {
      console.error("Error processing frame:", error);
      return null;
    }
  };

  return {
    processSignal,
    reset,
    fullReset,
    arrhythmiaCounter: getArrhythmiaCounter(),
    lastValidResults, // Return last valid results
    arrhythmiaWindows,
    debugInfo: getDebugInfo(),
    processFrame // Add the processFrame function to the return object
  };
};
