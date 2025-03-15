
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
  const fingerDetectedRef = useRef<boolean>(true); // Siempre asume dedo detectado
  const lastFingerDetectionTimeRef = useRef<number>(Date.now());
  const consecutiveGoodSignalsRef = useRef<number>(5); // Siempre suficientes
  const qualityThreshold = 10; // Umbral muy bajo

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
    isFingerDetected: boolean = true // Ignora este parámetro
  ): VitalSignsResult | null => {
    if (!processorRef.current) return null;

    // Siempre asume que el dedo está detectado
    fingerDetectedRef.current = true;
    lastFingerDetectionTimeRef.current = Date.now();
    
    // Incrementar contador de señales procesadas
    processedSignalsRef.current++;
    
    try {
      // Procesar la señal directamente
      const result = processorRef.current.processSignal(value, rrData);
      
      // No hay validación de los valores, usar directamente
      consecutiveGoodSignalsRef.current = 5; // Siempre suficientes señales
      
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
      
      // Guardar y retornar resultados directamente
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
      // Reiniciar procesador pero mantener resultados
      const savedResults = processorRef.current.reset();
      consecutiveGoodSignalsRef.current = 5; // Restablecer a valor válido
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
      fingerDetectedRef.current = true; // Siempre dedo detectado
      consecutiveGoodSignalsRef.current = 5; // Siempre suficientes señales
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
    isFingerDetected: () => true // Siempre retorna true
  };
}
