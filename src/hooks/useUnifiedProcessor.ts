
/**
 * Unified Processor Hook
 * Provides a single integration point for signal processing, vital signs, and heart rate
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useCentralSignalProcessor } from './useCentralSignalProcessor';
import { SignalProcessingResult } from './useCentralSignalProcessor';
import { toast } from 'sonner';

export interface UnifiedProcessorResult {
  // Signal state
  lastSignal: {
    value: number;
    filteredValue: number;
    quality: number;
    fingerDetected: boolean;
  } | null;
  
  // Heart rate state
  heartRate: number;
  isArrhythmia: boolean;
  
  // Vital signs
  vitalSigns: {
    spo2: number;
    pressure: string;
    arrhythmiaStatus: string;
    arrhythmiaCount: number;
    glucose: number;
    lipids: {
      totalCholesterol: number;
      triglycerides: number;
    };
    hemoglobin: number;
  };
  
  // Status
  elapsedTime: number;
  isProcessing: boolean;
  
  // Arrhythmia data for visualization
  arrhythmiaData?: {
    timestamp: number;
    rmssd: number;
    rrVariation: number;
  } | null;
}

export function useUnifiedProcessor() {
  const {
    processSignal,
    processFrame,
    startProcessing,
    stopProcessing: stopCentralProcessing,
    reset: resetCentralProcessor,
    lastResult,
    isProcessing,
    elapsedTime,
    arrhythmiaCount
  } = useCentralSignalProcessor();
  
  const [result, setResult] = useState<UnifiedProcessorResult>({
    lastSignal: null,
    heartRate: 0,
    isArrhythmia: false,
    vitalSigns: {
      spo2: 0,
      pressure: "--/--",
      arrhythmiaStatus: "--",
      arrhythmiaCount: 0,
      glucose: 0,
      lipids: {
        totalCholesterol: 0,
        triglycerides: 0
      },
      hemoglobin: 0
    },
    elapsedTime: 0,
    isProcessing: false
  });
  
  useEffect(() => {
    if (lastResult) {
      const now = Date.now();
      
      // Registrar timestamp del procesamiento
      console.log(`Procesando señal en: ${new Date(now).toISOString()}`);
      
      // Update the result state with all the data
      setResult({
        lastSignal: {
          value: lastResult.value,
          filteredValue: lastResult.filteredValue,
          quality: lastResult.quality,
          fingerDetected: lastResult.fingerDetected
        },
        heartRate: lastResult.heartRate,
        isArrhythmia: lastResult.isArrhythmia,
        vitalSigns: {
          ...lastResult.vitalSigns,
          arrhythmiaCount
        },
        elapsedTime,
        isProcessing,
        arrhythmiaData: lastResult.arrhythmiaData
      });
    }
  }, [lastResult, elapsedTime, isProcessing, arrhythmiaCount]);
  
  const startMonitoring = useCallback(() => {
    startProcessing();
    toast.success("Medición iniciada");
  }, [startProcessing]);
  
  const stopMonitoring = useCallback(() => {
    stopCentralProcessing();
    toast.info("Medición detenida");
  }, [stopCentralProcessing]);
  
  const reset = useCallback(() => {
    resetCentralProcessor();
    
    setResult({
      lastSignal: null,
      heartRate: 0,
      isArrhythmia: false,
      vitalSigns: {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "--",
        arrhythmiaCount: 0,
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        },
        hemoglobin: 0
      },
      elapsedTime: 0,
      isProcessing: false
    });
    
    toast.success("Medición reiniciada");
  }, [resetCentralProcessor]);
  
  // Versión compatible de processFrame para evitar el error de TypeScript
  const processFrameCompat = useCallback((imageData: any) => {
    // Creamos un objeto ImageData compatible
    const compatImageData = new ImageData(
      imageData.data, 
      imageData.width, 
      imageData.height
    );
    
    // Procesamos con el ImageData compatible
    return processFrame(compatImageData);
  }, [processFrame]);
  
  return {
    result,
    processSignal,
    processFrame: processFrameCompat,
    startMonitoring,
    stopMonitoring,
    reset,
    isProcessing,
    elapsedTime
  };
}
