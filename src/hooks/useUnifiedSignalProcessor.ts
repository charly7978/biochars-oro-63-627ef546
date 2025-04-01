
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 * 
 * Hook unificado para procesamiento de señales
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { UnifiedSignalProcessor } from '../modules/signal-processing/unified/UnifiedSignalProcessor';
import { ProcessedPPGSignal } from '../modules/signal-processing/unified/types';

/**
 * Hook unificado que consolida la funcionalidad de varios hooks de procesamiento
 */
export const useUnifiedSignalProcessor = () => {
  // Crear el procesador
  const [processor] = useState(() => {
    console.log("useUnifiedSignalProcessor: Creando nueva instancia", {
      timestamp: new Date().toISOString(),
      sessionId: Math.random().toString(36).substring(2, 9)
    });
    
    return new UnifiedSignalProcessor();
  });
  
  // Estado
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSignal, setLastSignal] = useState<ProcessedPPGSignal | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [framesProcessed, setFramesProcessed] = useState(0);
  const [signalStats, setSignalStats] = useState({
    minValue: Infinity,
    maxValue: -Infinity,
    avgValue: 0,
    totalValues: 0
  });
  
  // Callback para cuando llega una nueva señal
  const handleSignalReady = useCallback((signal: ProcessedPPGSignal) => {
    setLastSignal(signal);
    setError(null);
    setFramesProcessed(prev => prev + 1);
    
    // Actualizar estadísticas de señal
    setSignalStats(prev => {
      return {
        minValue: Math.min(prev.minValue, signal.filteredValue),
        maxValue: Math.max(prev.maxValue, signal.filteredValue),
        avgValue: (prev.avgValue * prev.totalValues + signal.filteredValue) / (prev.totalValues + 1),
        totalValues: prev.totalValues + 1
      };
    });
  }, []);
  
  // Callback para errores
  const handleError = useCallback((err: Error) => {
    console.error("useUnifiedSignalProcessor: Error en procesamiento:", err);
    setError(err);
  }, []);
  
  // Configurar callbacks
  useEffect(() => {
    // No podemos pasarlos directamente al constructor porque las funciones
    // cambiarán en cada renderizado, pero podemos configurar manualmente
    processor.configure({
      onSignalReady: handleSignalReady,
      onError: handleError
    });
    
    // Cleanup
    return () => {
      processor.reset();
    };
  }, [processor, handleSignalReady, handleError]);
  
  /**
   * Iniciar procesamiento
   */
  const startProcessing = useCallback(() => {
    console.log("useUnifiedSignalProcessor: Iniciando procesamiento");
    
    setIsProcessing(true);
    setFramesProcessed(0);
    setSignalStats({
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0
    });
  }, []);
  
  /**
   * Detener procesamiento
   */
  const stopProcessing = useCallback(() => {
    console.log("useUnifiedSignalProcessor: Deteniendo procesamiento");
    
    setIsProcessing(false);
    processor.reset();
  }, [processor]);
  
  /**
   * Procesar un frame entero de imagen
   */
  const processImageFrame = useCallback((imageData: ImageData) => {
    if (isProcessing) {
      try {
        // Extraer valor promedio del canal rojo
        const data = imageData.data;
        let redSum = 0;
        const pixelCount = data.length / 4;
        
        for (let i = 0; i < data.length; i += 4) {
          redSum += data[i];
        }
        
        const redAvg = redSum / pixelCount / 255; // Normalizar a 0-1
        
        // Procesar señal y actualizar estado a través del callback
        processor.processSignal(redAvg);
      } catch (err) {
        console.error("useUnifiedSignalProcessor: Error procesando frame de imagen:", err);
        handleError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  }, [isProcessing, processor, handleError]);
  
  /**
   * Procesar un valor numérico
   */
  const processFrame = useCallback((value: number) => {
    if (isProcessing) {
      try {
        // Validar valor
        if (isNaN(value) || !isFinite(value)) {
          console.warn("useUnifiedSignalProcessor: Valor inválido", value);
          return;
        }
        
        // Normalizar si es necesario
        const normalizedValue = value > 1 ? value / 255 : value;
        
        // Procesar señal directamente
        processor.processSignal(normalizedValue);
        
        return lastSignal;
      } catch (err) {
        console.error("useUnifiedSignalProcessor: Error procesando valor:", err);
        handleError(err instanceof Error ? err : new Error(String(err)));
        return null;
      }
    }
    return null;
  }, [isProcessing, processor, handleError, lastSignal]);
  
  return {
    isProcessing,
    lastSignal,
    error,
    framesProcessed,
    signalStats,
    startProcessing,
    stopProcessing,
    processFrame, // Para valores numéricos
    processImageFrame, // Para imágenes completas
    // Métodos adicionales directos al procesador
    getArrhythmiaCounter: useCallback(() => processor.getArrhythmiaCounter(), [processor]),
    getRRIntervals: useCallback(() => processor.getRRIntervals(), [processor]),
    getSignalQuality: useCallback(() => processor.getSignalQualityMetrics(), [processor]),
    reset: useCallback(() => {
      processor.fullReset();
      setLastSignal(null);
      setError(null);
      setFramesProcessed(0);
      setSignalStats({
        minValue: Infinity,
        maxValue: -Infinity,
        avgValue: 0,
        totalValues: 0
      });
    }, [processor])
  };
};
