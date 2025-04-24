
import { useState, useEffect, useCallback, useRef } from 'react';
import { OptimizedPPGProcessor } from '../core/signal/OptimizedPPGProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';

/**
 * Hook optimizado para procesamiento de señales PPG
 * Elimina redundancias y centraliza la lógica
 */
export const useOptimizedSignalProcessor = () => {
  // Crear instancia del procesador optimizado
  const [processor] = useState(() => {
    console.log("useOptimizedSignalProcessor: Creando nueva instancia", {
      timestamp: new Date().toISOString(),
      sessionId: Math.random().toString(36).substring(2, 9)
    });
    
    return new OptimizedPPGProcessor();
  });
  
  // Estado básico
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [error, setError] = useState<ProcessingError | null>(null);
  const [framesProcessed, setFramesProcessed] = useState(0);
  const frameTimeRef = useRef<number>(0);
  const processingTimeRef = useRef<number[]>([]);
  
  // Estadísticas de señal para monitoreo de rendimiento
  const [signalStats, setSignalStats] = useState({
    minValue: Infinity,
    maxValue: -Infinity,
    avgValue: 0,
    totalValues: 0,
    avgProcessingTime: 0
  });

  /**
   * Iniciar procesamiento de señales
   */
  const startProcessing = useCallback(() => {
    console.log("useOptimizedSignalProcessor: Iniciando procesamiento");
    
    setIsProcessing(true);
    setFramesProcessed(0);
    setSignalStats({
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0,
      avgProcessingTime: 0
    });
    processingTimeRef.current = [];
    
    processor.reset();
  }, [processor]);

  /**
   * Detener procesamiento de señales
   */
  const stopProcessing = useCallback(() => {
    console.log("useOptimizedSignalProcessor: Deteniendo procesamiento", {
      framesProcessados: framesProcessed,
      tiempoPromedioMs: processingTimeRef.current.length > 0 
        ? processingTimeRef.current.reduce((a, b) => a + b, 0) / processingTimeRef.current.length 
        : 0
    });
    
    setIsProcessing(false);
  }, [framesProcessed]);

  /**
   * Procesar un frame de la cámara
   * Optimizado para rendimiento y precisión
   */
  const processFrame = useCallback((imageData: ImageData) => {
    if (!isProcessing) return;
    
    try {
      const startTime = performance.now();
      
      // Procesar frame con el procesador optimizado
      const processedSignal = processor.processFrame(imageData);
      
      // Actualizar estadísticas
      setLastSignal(processedSignal);
      setError(null);
      setFramesProcessed(prev => prev + 1);
      
      // Calcular tiempo de procesamiento
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      // Mantener historial de tiempos (máximo 100 frames)
      processingTimeRef.current.push(processingTime);
      if (processingTimeRef.current.length > 100) {
        processingTimeRef.current.shift();
      }
      
      // Actualizar estadísticas de señal con menos frecuencia para reducir re-renders
      if (framesProcessed % 10 === 0) {
        const avgProcessingTime = processingTimeRef.current.reduce((a, b) => a + b, 0) / 
                                 processingTimeRef.current.length;
        
        setSignalStats(prev => {
          return {
            minValue: Math.min(prev.minValue, processedSignal.filteredValue),
            maxValue: Math.max(prev.maxValue, processedSignal.filteredValue),
            avgValue: (prev.avgValue * prev.totalValues + processedSignal.filteredValue) / 
                     (prev.totalValues + 1),
            totalValues: prev.totalValues + 1,
            avgProcessingTime
          };
        });
      }
      
      frameTimeRef.current = performance.now();
    } catch (err) {
      console.error("useOptimizedSignalProcessor: Error procesando frame:", err);
      setError({
        code: 'PROCESSING_ERROR',
        message: err instanceof Error ? err.message : 'Error desconocido al procesar frame',
        timestamp: Date.now()
      });
    }
  }, [isProcessing, processor, framesProcessed]);

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      processor.reset();
    };
  }, [processor]);

  return {
    isProcessing,
    lastSignal,
    error,
    framesProcessed,
    signalStats,
    startProcessing,
    stopProcessing,
    processFrame,
    processingTime: processingTimeRef.current.length > 0 
      ? processingTimeRef.current.reduce((a, b) => a + b, 0) / processingTimeRef.current.length 
      : 0
  };
};
