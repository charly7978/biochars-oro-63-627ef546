
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useRef, useCallback } from 'react';
import { VitalSignsProcessor, VitalSignsResult } from '../../modules/vital-signs/VitalSignsProcessor';

// Límites de buffer ajustados para mejor rendimiento
const MAX_BUFFER_SIZE = 1000;
const TRIM_BUFFER_SIZE = 800;

export const useSignalProcessing = () => {
  // Referencias para el procesador y los resultados
  const vitalSignsProcessor = useRef<VitalSignsProcessor | null>(null);
  const processedSignals = useRef<number>(0);
  const ppgBuffer = useRef<number[]>([]);
  const debugInfo = useRef<Record<string, any>>({
    lastSignalTime: 0,
    signalsPerSecond: 0,
    bufferSize: 0,
    lastResetTime: Date.now(),
    arrhythmiaEvents: 0
  });

  // Estado para seguimiento de arritmias y depuración
  const [arrhythmiaCounter, setArrhythmiaCounter] = useState<number>(0);
  
  /**
   * Inicializa todos los procesadores
   */
  const initializeProcessor = useCallback(() => {
    console.log("useSignalProcessing: Inicializando procesador de signos vitales");
    
    // Crear una nueva instancia del procesador
    vitalSignsProcessor.current = new VitalSignsProcessor();
    
    // Activar modo de depuración
    vitalSignsProcessor.current.setDebugMode(true);
    
    // Resetear contadores
    processedSignals.current = 0;
    ppgBuffer.current = [];
    
    // Establecer valores iniciales de depuración
    debugInfo.current = {
      lastSignalTime: Date.now(),
      signalsPerSecond: 0,
      bufferSize: 0,
      lastResetTime: Date.now(),
      arrhythmiaEvents: 0
    };
    
    // Resetear contador de arritmias
    setArrhythmiaCounter(0);
    
    return () => {
      vitalSignsProcessor.current = null;
    };
  }, []);

  /**
   * Reset completo - volver a valores iniciales
   */
  const fullReset = useCallback(() => {
    console.log("useSignalProcessing: Realizando reset completo");
    
    if (vitalSignsProcessor.current) {
      vitalSignsProcessor.current.fullReset();
    }
    
    ppgBuffer.current = [];
    processedSignals.current = 0;
    
    debugInfo.current = {
      lastSignalTime: Date.now(),
      signalsPerSecond: 0,
      bufferSize: 0,
      lastResetTime: Date.now(),
      arrhythmiaEvents: 0
    };
    
    setArrhythmiaCounter(0);
  }, []);

  /**
   * Reset parcial - mantener algunos datos
   */
  const reset = useCallback(() => {
    console.log("useSignalProcessing: Realizando reset parcial");
    
    if (vitalSignsProcessor.current) {
      vitalSignsProcessor.current.reset();
    }
    
    ppgBuffer.current = [];
    
    debugInfo.current.lastResetTime = Date.now();
    
    // Mantenemos el contador de arritmias
  }, []);

  /**
   * Procesa una señal PPG y retorna resultados de signos vitales
   * No simulación - solo mediciones directas
   */
  const processSignal = useCallback((
    value: number, 
    rrData?: { intervals: number[], lastPeakTime: number | null },
    isWeakSignal?: boolean
  ): VitalSignsResult => {
    // Validar que el procesador esté inicializado
    if (!vitalSignsProcessor.current) {
      console.error("useSignalProcessing: El procesador no está inicializado");
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

    try {
      // Incrementar contador de señales procesadas
      processedSignals.current++;
      
      // Actualizar buffer PPG
      ppgBuffer.current.push(value);
      
      // Limitar tamaño del buffer
      if (ppgBuffer.current.length > MAX_BUFFER_SIZE) {
        ppgBuffer.current = ppgBuffer.current.slice(-TRIM_BUFFER_SIZE);
      }
      
      // Actualizar información de depuración
      const now = Date.now();
      const elapsed = now - debugInfo.current.lastSignalTime;
      
      if (elapsed > 1000) {
        debugInfo.current.signalsPerSecond = Math.round((processedSignals.current * 1000) / elapsed);
        debugInfo.current.lastSignalTime = now;
      }
      
      debugInfo.current.bufferSize = ppgBuffer.current.length;
      
      // Si se detecta señal débil, devolver resultado vacío
      if (isWeakSignal) {
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
      
      // Procesar la señal para obtener resultados
      const result = vitalSignsProcessor.current.processSignal(value, rrData);
      
      // Actualizar contador de arritmias si se detecta una nueva
      if (result.arrhythmiaStatus && result.arrhythmiaStatus.includes("ARRHYTHMIA DETECTED")) {
        debugInfo.current.arrhythmiaEvents++;
        setArrhythmiaCounter(current => current + 1);
      }
      
      return result;
    } catch (error) {
      console.error("useSignalProcessing: Error procesando señal", error);
      
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
  }, []);

  /**
   * Obtener información de depuración
   */
  const getDebugInfo = useCallback(() => {
    return {
      ...debugInfo.current,
      processedSignals: processedSignals.current,
      ppgBufferLength: ppgBuffer.current.length,
      arrhythmiaCounter,
      processorActive: !!vitalSignsProcessor.current
    };
  }, [arrhythmiaCounter]);

  /**
   * Obtener contador de arritmias
   */
  const getArrhythmiaCounter = useCallback(() => {
    return arrhythmiaCounter;
  }, [arrhythmiaCounter]);

  return {
    processSignal,
    initializeProcessor,
    reset,
    fullReset,
    getArrhythmiaCounter,
    getDebugInfo,
    processedSignals,
    vitalSignsProcessor
  };
};
