
import { useRef, useState, useCallback } from 'react';
import { VitalSignsProcessor, VitalSignsResult, RRData } from '../modules';

/**
 * Hook para procesamiento de signos vitales que mantiene un estado consistente
 * NOTA: Este hook utiliza el procesador de señales optimizado central
 * manteniendo compatibilidad con interfaces anteriores
 */
export function useVitalSignsProcessor() {
  const processorRef = useRef<VitalSignsProcessor | null>(null);
  const [lastValidResults, setLastValidResults] = useState<VitalSignsResult | null>(null);
  const sessionIdRef = useRef<string>(Math.random().toString(36).substring(2, 9));
  const processedSignalsRef = useRef<number>(0);
  const arrhythmiaCounterRef = useRef<number>(0);

  // Inicializar el procesador si no existe
  if (!processorRef.current) {
    processorRef.current = new VitalSignsProcessor();
  }

  /**
   * Procesa una señal PPG y calcula signos vitales
   */
  const processSignal = useCallback((
    value: number,
    rrData?: RRData
  ): VitalSignsResult | null => {
    if (!processorRef.current) return null;

    // Incrementar contador de señales procesadas
    processedSignalsRef.current++;
    
    try {
      // Procesar la señal con el optimizador central
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
      
      // Actualizar resultados válidos solo si los valores son significativos
      if (typeof result.spo2 === 'number' && result.spo2 > 0 && 
          result.pressure !== "--/--" && result.pressure !== "0/0") {
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
      sessionIdRef.current = Math.random().toString(36).substring(2, 9);
    } catch (error) {
      console.error("Error en reinicio completo:", error);
    }
  }, []);

  return {
    processSignal,
    reset,
    fullReset,
    lastValidResults
  };
}
