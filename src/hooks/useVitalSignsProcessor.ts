
import { useRef, useState, useCallback } from 'react';
import { VitalSignsProcessor, VitalSignsResult, RRData } from '../modules';

/**
 * Hook para procesamiento de signos vitales sin validaciones estrictas
 * Muestra resultados directamente sin filtrado
 */
export function useVitalSignsProcessor() {
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  const sessionIdRef = useRef<string>(Math.random().toString(36).substring(2, 9));
  const processedSignalsRef = useRef<number>(0);
  const arrhythmiaCounterRef = useRef<number>(0);
  const fingerDetectedRef = useRef<boolean>(false); // CAMBIO CRÍTICO: Iniciar como false
  const lastFingerDetectionTimeRef = useRef<number>(Date.now());
  const consecutiveGoodSignalsRef = useRef<number>(0);
  const qualityThreshold = 10;

  // Inicializar el procesador si no existe
  if (!processorRef.current) {
    processorRef.current = new VitalSignsProcessor();
  }

  /**
   * Procesa una señal PPG y calcula signos vitales sin validación estricta
   */
  const processSignal = useCallback((
    value: number,
    rrData?: RRData,
    isFingerDetected: boolean = false // CAMBIO CRÍTICO: Default a false
  ): VitalSignsResult | null => {
    if (!processorRef.current) return null;

    // CAMBIO CRÍTICO: Usar el valor real de detección de dedo
    fingerDetectedRef.current = isFingerDetected;
    
    // CAMBIO CRÍTICO: Si no hay dedo detectado, devolver valores en cero o mensajes adecuados
    if (!isFingerDetected) {
      console.log("useVitalSignsProcessor: No hay dedo detectado, devolviendo valores en blanco");
      
      return {
        spo2: 0,
        pressure: "--/--",
        arrhythmiaStatus: "SIN ARRITMIAS|0",
        lastArrhythmiaData: null,
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        },
        hemoglobin: 0
      };
    }
    
    lastFingerDetectionTimeRef.current = Date.now();
    
    // Incrementar contador de señales procesadas
    processedSignalsRef.current++;
    
    try {
      // Procesar la señal - Pasar correctamente los parámetros a processSignal
      const result = processorRef.current.processSignal(value, rrData);
      
      // Rastrear contador de arritmias
      if (result.arrhythmiaStatus.includes('ARRITMIA')) {
        const parts = result.arrhythmiaStatus.split('|');
        if (parts.length > 1) {
          const count = parseInt(parts[1], 10);
          if (!isNaN(count)) {
            arrhythmiaCounterRef.current = count;
          }
        }
      }
      
      // Guardar y retornar resultados
      setLastValidResults(result);
      return result;
      
    } catch (error) {
      console.error("Error procesando señal vital:", error);
      return null;
    }
  }, []);

  /**
   * Reinicia el procesador y devuelve los últimos resultados válidos
   */
  const reset = useCallback((): VitalSignsResult | null => {
    if (!processorRef.current) return null;
    
    try {
      // Reiniciar procesador
      const savedResults = processorRef.current.reset();
      consecutiveGoodSignalsRef.current = 0; // CAMBIO CRÍTICO: Iniciar en 0
      fingerDetectedRef.current = false; // CAMBIO CRÍTICO: Reiniciar detección de dedo
      return savedResults;
    } catch (error) {
      console.error("Error reiniciando procesador:", error);
      return null;
    }
  }, []);

  /**
   * Reinicia completamente el procesador y todos sus datos
   */
  const fullReset = useCallback((): void => {
    if (!processorRef.current) return;
    
    try {
      // Reinicio completo
      processorRef.current.fullReset();
      setLastValidResults(null);
      arrhythmiaCounterRef.current = 0;
      processedSignalsRef.current = 0;
      fingerDetectedRef.current = false; // CAMBIO CRÍTICO: Siempre iniciar como false
      consecutiveGoodSignalsRef.current = 0;
      lastFingerDetectionTimeRef.current = Date.now();
      sessionIdRef.current = Math.random().toString(36).substring(2, 9);
    } catch (error) {
      console.error("Error en reinicio completo:", error);
    }
  }, []);

  /**
   * Inicia el proceso de calibración
   */
  const startCalibration = useCallback((): void => {
    if (!processorRef.current) return;
    
    try {
      processorRef.current.startCalibration();
    } catch (error) {
      console.error("Error iniciando calibración:", error);
    }
  }, []);

  /**
   * Fuerza la finalización del proceso de calibración
   */
  const forceCalibrationCompletion = useCallback((): void => {
    if (!processorRef.current) return;
    
    try {
      processorRef.current.forceCalibrationCompletion();
    } catch (error) {
      console.error("Error forzando finalización de calibración:", error);
    }
  }, []);

  return {
    processSignal,
    reset,
    fullReset,
    lastValidResults,
    startCalibration,
    forceCalibrationCompletion,
    isFingerDetected: () => fingerDetectedRef.current // CAMBIO CRÍTICO: Devolver el valor real
  };
}
