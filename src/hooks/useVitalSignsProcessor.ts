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

/**
 * Hook for processing vital signs with direct algorithms only
 * No simulation or reference values are used
 */
export const useVitalSignsProcessor = (): UseVitalSignsProcessorReturn => {
  // State management - only direct measurement, no simulation
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  
  // Session tracking
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 9));
  
  // Signal quality tracking
  const weakSignalsCountRef = useRef<number>(0);
  const LOW_SIGNAL_THRESHOLD = 0.05;
  const MAX_WEAK_SIGNALS = 10;
  
  // Arrhythmia tracking
  const lastArrhythmiaTriggeredRef = useRef<number>(0);
  const MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL = 5000; // Aumentado a 5 segundos para evitar alertas excesivas
  
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
   * Process PPG signal directly - mejorado para detección precisa de arritmias
   * No simulation or reference values are used
   */
  const processSignal = (
    value: number, 
    rrData?: { intervals: number[], lastPeakTime: number | null }, 
    externalWeakSignal: boolean = false
  ): VitalSignsResult => {
    // Enhanced weak signal detection
    const { 
      isWeakSignal: detectedWeakSignal, 
      updatedWeakSignalsCount 
    } = checkSignalQuality(
      value,
      weakSignalsCountRef.current,
      {
        lowSignalThreshold: LOW_SIGNAL_THRESHOLD,
        maxWeakSignalCount: MAX_WEAK_SIGNALS
      }
    );

    const isWeakSignal = detectedWeakSignal || externalWeakSignal;
    weakSignalsCountRef.current = updatedWeakSignalsCount;

    // Process signal directly - no simulation
    try {
      const result = processVitalSignal(value, rrData, isWeakSignal);
      const currentTime = Date.now();
      
      // Identificar cada latido arrítmico individualmente de forma más precisa
      if (result && 
          result.arrhythmiaStatus && 
          typeof result.arrhythmiaStatus === 'string' && 
          result.arrhythmiaStatus.includes("ARRHYTHMIA DETECTED") && 
          result.lastArrhythmiaData) {
        
        const arrhythmiaTime = result.lastArrhythmiaData.timestamp;
        
        // Ventana más precisa para cada latido arrítmico individual
        let windowWidth = 350; // Ancho predeterminado más pequeño
        
        // Ajustar ventana basada en intervalos RR reales si están disponibles
        if (rrData && rrData.intervals && rrData.intervals.length > 0) {
          const lastIntervals = rrData.intervals.slice(-4);
          const avgInterval = lastIntervals.reduce((sum, val) => sum + val, 0) / lastIntervals.length;
          windowWidth = Math.max(250, Math.min(600, avgInterval * 1.2)); // Ventana más acotada
        }
        
        // Registrar solo una ventana específica y precisa para cada arritmia
        const startWindow = arrhythmiaTime - windowWidth/3;
        const endWindow = arrhythmiaTime + windowWidth/3;
        
        // Añadir ventana de arritmia para visualización
        addArrhythmiaWindow(startWindow, endWindow);
        
        console.log("useVitalSignsProcessor: Arritmia detectada con precisión", {
          time: new Date(arrhythmiaTime).toISOString(),
          windowStart: new Date(startWindow).toISOString(),
          windowEnd: new Date(endWindow).toISOString(),
          windowWidth,
          status: result.arrhythmiaStatus,
          arrhythmiaCount: getArrhythmiaCounter()
        });
        
        // Activar feedback solo para latidos arrítmicos específicos con intervalo mínimo para evitar exceso de notificaciones
        if (currentTime - lastArrhythmiaTriggeredRef.current > MIN_ARRHYTHMIA_NOTIFICATION_INTERVAL) {
          lastArrhythmiaTriggeredRef.current = currentTime;
          const count = parseInt(result.arrhythmiaStatus.split('|')[1] || '0');
          
          // Usar la función centralizada para notificar arritmias
          FeedbackService.signalArrhythmia(count);
          
          console.log("useVitalSignsProcessor: Notificación de arritmia activada", {
            count,
            timeSinceLastNotification: currentTime - lastArrhythmiaTriggeredRef.current
          });
        }
      }
      
      // Log processed signals
      logSignalData(value, result, processedSignals.current);
      
      // Save valid results
      if (result && result.heartRate > 0) {
        setLastValidResults(result);
      }
      
      // Return processed result
      return result;
    } catch (error) {
      console.error("Error processing vital signs:", error);
      
      // Return safe fallback values on error that include heartRate
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
    lastArrhythmiaTriggeredRef.current = 0;
    
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
    lastArrhythmiaTriggeredRef.current = 0;
    clearLog();
  };

  return {
    processSignal,
    reset,
    fullReset,
    arrhythmiaCounter: getArrhythmiaCounter(),
    lastValidResults: lastValidResults,
    arrhythmiaWindows,
    debugInfo: getDebugInfo()
  };
};
