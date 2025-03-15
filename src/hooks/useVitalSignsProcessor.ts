
import { useRef, useState, useCallback } from 'react';
import { VitalSignsProcessor, VitalSignsResult, RRData } from '../modules';

/**
 * Hook para procesamiento de signos vitales que mantiene un estado consistente
 * NOTA: Este hook utiliza los procesadores modulares refactorizados pero mantiene
 * la interfaz original para compatibilidad con index.tsx y PPGSignalMeter.tsx
 */
export function useVitalSignsProcessor() {
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  const sessionIdRef = useRef<string>(Math.random().toString(36).substring(2, 9));
  const processedSignalsRef = useRef<number>(0);
  const arrhythmiaCounterRef = useRef<number>(0);
  const fingerDetectedRef = useRef<boolean>(false);

  // Inicializar el procesador si no existe
  if (!processorRef.current) {
    processorRef.current = new VitalSignsProcessor();
  }

  /**
   * Procesa una señal PPG y calcula signos vitales
   */
  const processSignal = useCallback((
    value: number,
    rrData?: RRData,
    isFingerDetected: boolean = false
  ): VitalSignsResult | null => {
    if (!processorRef.current) return null;

    // Actualizar estado de detección de dedo
    fingerDetectedRef.current = isFingerDetected;
    
    // Si no hay dedo detectado, retornar valores vacíos claramente indicados como "sin señal"
    if (!isFingerDetected) {
      console.log("useVitalSignsProcessor: Sin dedo detectado, retornando valores vacíos");
      return {
        spo2: 0,
        pressure: "SIN SEÑAL",
        arrhythmiaStatus: "SIN SEÑAL",
        glucose: 0,
        lipids: {
          totalCholesterol: 0,
          triglycerides: 0
        },
        hemoglobin: 0,
        calibration: {
          isCalibrating: false,
          progress: {
            heartRate: 0,
            spo2: 0,
            pressure: 0,
            arrhythmia: 0,
            glucose: 0,
            lipids: 0,
            hemoglobin: 0,
            atrialFibrillation: 0
          }
        },
        lastArrhythmiaData: null
      };
    }
    
    // Incrementar contador de señales procesadas
    processedSignalsRef.current++;
    
    try {
      // Procesar la señal sólo si el dedo está detectado
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
      
      // Actualizar resultados válidos si hay sustancia
      if (
        result.spo2 > 0 && 
        result.pressure !== "--/--" && 
        result.pressure !== "0/0" &&
        result.pressure !== "SIN SEÑAL"
      ) {
        setLastValidResults(result);
      }
      
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
      fingerDetectedRef.current = false;
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
    isFingerDetected: () => fingerDetectedRef.current
  };
}
