
import { useState, useRef, useCallback } from 'react';
import { VitalSignsProcessor } from '../modules/vital-signs/VitalSignsProcessor';
import { UseVitalSignsProcessorReturn, ArrhythmiaWindow } from './vital-signs/types';
import { VitalSignsResult } from '../modules/vital-signs/types/vital-signs-result';
import { useSignalLogging } from './vital-signs/use-vital-signs-logging';

/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

/**
 * Hook que proporciona un procesador de signos vitales
 * Solo utiliza mediciones directas sin simulación
 */
export const useVitalSignsProcessor = (): UseVitalSignsProcessorReturn => {
  // Inicializar procesador
  const [processor] = useState(() => new VitalSignsProcessor());
  const { logSignal } = useSignalLogging();
  
  // State para resultados y eventos
  const lastValidResults = useRef<VitalSignsResult | null>(null);
  const processedSignals = useRef<number>(0);
  const ppgBuffer = useRef<number[]>([]);
  const debugInfo = useRef<{ [key: string]: any }>({});
  const arrhythmiaWindows = useRef<ArrhythmiaWindow[]>([]);
  const vitalSignsProcessor = useRef<VitalSignsProcessor | null>(null);
  
  // Contador de arritmias
  const [arrhythmiaCounter, setArrhythmiaCounter] = useState<number>(0);
  
  // Inicializar el procesador si no está inicializado
  const ensureProcessorInitialized = useCallback(() => {
    if (!vitalSignsProcessor.current) {
      vitalSignsProcessor.current = processor;
      console.log("useVitalSignsProcessor: Procesador inicializado");
    }
    return vitalSignsProcessor.current;
  }, [processor]);
  
  /**
   * Procesar una señal PPG y calcular signos vitales
   * Sin simulación de datos
   */
  const processSignal = useCallback((value: number, rrData?: { intervals: number[], lastPeakTime: number | null }): VitalSignsResult => {
    // Asegurar que procesador está inicializado
    const processor = ensureProcessorInitialized();
    
    // Actualizar contador procesados
    processedSignals.current += 1;
    
    // Guardar valor en buffer
    ppgBuffer.current.push(value);
    if (ppgBuffer.current.length > 300) {
      ppgBuffer.current.shift();
    }
    
    try {
      // Procesar señal real sin simulación
      const results = processor.processSignal(value, rrData);
      
      // Guardar resultados válidos
      if (results.spo2 > 0 || results.pressure !== "--/--") {
        lastValidResults.current = results;
      }
      
      // Registrar señal para depuración
      logSignal(value, results);
      
      // Actualizar contadores y ventanas de arritmia
      if (results.arrhythmiaStatus === "Detectada") {
        setArrhythmiaCounter(prev => prev + 1);
        
        // Añadir ventana de arritmia
        if (results.lastArrhythmiaData) {
          const now = Date.now();
          arrhythmiaWindows.current.push({
            start: now - results.lastArrhythmiaData.duration,
            end: now
          });
          
          // Mantener solo las últimas 10 ventanas
          if (arrhythmiaWindows.current.length > 10) {
            arrhythmiaWindows.current.shift();
          }
        }
      }
      
      return results;
    } catch (error) {
      console.error("useVitalSignsProcessor: Error procesando señal", error);
      
      // Devolver resultados vacíos o último válido en caso de error
      return lastValidResults.current || {
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
  }, [ensureProcessorInitialized, logSignal]);
  
  /**
   * Reiniciar el procesador
   */
  const reset = useCallback((): VitalSignsResult | null => {
    const processor = ensureProcessorInitialized();
    const results = processor.reset();
    
    // Reset state
    processedSignals.current = 0;
    ppgBuffer.current = [];
    
    return results;
  }, [ensureProcessorInitialized]);
  
  /**
   * Reinicio completo
   */
  const fullReset = useCallback(() => {
    const processor = ensureProcessorInitialized();
    processor.fullReset();
    
    // Reset complete state
    processedSignals.current = 0;
    ppgBuffer.current = [];
    lastValidResults.current = null;
    arrhythmiaWindows.current = [];
    setArrhythmiaCounter(0);
    
    console.log("useVitalSignsProcessor: Reset completo realizado");
  }, [ensureProcessorInitialized]);
  
  /**
   * Aplicar calibración de presión arterial
   */
  const applyBloodPressureCalibration = useCallback((systolic: number, diastolic: number): void => {
    const processor = ensureProcessorInitialized();
    processor.applyBloodPressureCalibration(systolic, diastolic);
  }, [ensureProcessorInitialized]);
  
  /**
   * Obtener contador de arritmias
   */
  const getArrhythmiaCounter = useCallback(() => {
    return arrhythmiaCounter;
  }, [arrhythmiaCounter]);
  
  /**
   * Obtener información de depuración
   */
  const getDebugInfo = useCallback(() => {
    return {
      processedSignals: processedSignals.current,
      ppgBufferLength: ppgBuffer.current.length,
      arrhythmiaCounter,
      processorActive: !!vitalSignsProcessor.current,
      signalLog: []  // Campo requerido por el tipo
    };
  }, [arrhythmiaCounter]);

  return {
    processSignal,
    reset,
    fullReset,
    applyBloodPressureCalibration,
    arrhythmiaCounter: getArrhythmiaCounter(),
    lastValidResults: lastValidResults.current,
    arrhythmiaWindows: arrhythmiaWindows.current,
    debugInfo: getDebugInfo()
  };
};
