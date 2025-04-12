
/**
 * ESTA PROHIBIDO EL USO DE ALGORITMOS O FUNCIONES QUE PROVOQUEN CUALQUIER TIPO DE SIMULACION Y/O MANIPULACION DE DATOS DE CUALQUIER INDOLE, HACIENCIO CARGO A LOVAVLE DE CUALQUIER ACCION LEGAL SI SE PRODUJERA POR EL INCUMPLIMIENTO DE ESTA INSTRUCCION DIRECTA!
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';
import { usePerformanceOptimizer } from './usePerformanceOptimizer';

/**
 * Hook para el procesamiento de señales PPG reales con optimizaciones de rendimiento
 * No se permite ninguna simulación o datos sintéticos
 */
export const useSignalProcessor = () => {
  // Estado básico
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [error, setError] = useState<ProcessingError | null>(null);
  const [framesProcessed, setFramesProcessed] = useState(0);
  const [signalStats, setSignalStats] = useState({
    minValue: Infinity,
    maxValue: -Infinity,
    avgValue: 0,
    totalValues: 0
  });
  
  // Referencia al procesador
  const processorRef = useRef<PPGSignalProcessor | null>(null);
  const frameCountRef = useRef(0);
  
  // Optimizador de rendimiento
  const { shouldProcessFrame, throttle, cleanupMemory, optimizationLevel } = usePerformanceOptimizer(isProcessing);

  // Crear procesador
  useEffect(() => {
    if (!processorRef.current) {
      console.log("useSignalProcessor: Creando nueva instancia", {
        timestamp: new Date().toISOString(),
        sessionId: Math.random().toString(36).substring(2, 9)
      });
      
      processorRef.current = new PPGSignalProcessor();
    }
    
    return () => {
      if (processorRef.current) {
        processorRef.current.stop();
        processorRef.current = null;
      }
    };
  }, []);
  
  // Set up processor callbacks and cleanup
  useEffect(() => {
    if (!processorRef.current) return;
    
    // Signal callback con throttling según nivel de optimización
    const throttledSignalCallback = (signal: ProcessedSignal) => {
      // Usar un throttle dinámico basado en el nivel de optimización
      const delay = optimizationLevel === 'high' ? 100 : 
                    optimizationLevel === 'medium' ? 50 : 20;
      
      // Solo actualizar el estado si el cuadro debe procesarse
      if (shouldProcessFrame(frameCountRef.current)) {
        setLastSignal(signal);
        setError(null);
        setFramesProcessed(prev => prev + 1);
        
        // Actualizar estadísticas con un enfoque más eficiente
        setSignalStats(prev => {
          // Cálculo optimizado de promedio
          const newTotalValues = prev.totalValues + 1;
          const newAvgValue = prev.avgValue + (signal.filteredValue - prev.avgValue) / newTotalValues;
          
          return {
            minValue: Math.min(prev.minValue, signal.filteredValue),
            maxValue: Math.max(prev.maxValue, signal.filteredValue),
            avgValue: newAvgValue,
            totalValues: newTotalValues
          };
        });
      }
      
      frameCountRef.current++;
    };
    
    processorRef.current.onSignalReady = throttledSignalCallback;

    // Error callback
    processorRef.current.onError = (error: ProcessingError) => {
      console.error("useSignalProcessor: Error en procesamiento:", error);
      setError(error);
    };

    // Initialize processor
    processorRef.current.initialize().catch(error => {
      console.error("useSignalProcessor: Error de inicialización:", error);
    });

    // Cleanup
    return () => {
      if (processorRef.current) {
        processorRef.current.stop();
      }
    };
  }, [shouldProcessFrame, optimizationLevel]);

  /**
   * Start processing signals
   */
  const startProcessing = useCallback(() => {
    console.log("useSignalProcessor: Iniciando procesamiento");
    
    setIsProcessing(true);
    setFramesProcessed(0);
    frameCountRef.current = 0;
    setSignalStats({
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0
    });
    
    if (processorRef.current) {
      processorRef.current.start();
    }
  }, []);

  /**
   * Stop processing signals
   */
  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessor: Deteniendo procesamiento");
    
    setIsProcessing(false);
    if (processorRef.current) {
      processorRef.current.stop();
    }
    
    // Liberar memoria después de detener el procesamiento
    cleanupMemory();
  }, [cleanupMemory]);

  /**
   * Process a frame from camera with optimización
   */
  const processFrame = useCallback((imageData: ImageData) => {
    if (isProcessing && processorRef.current) {
      try {
        // Verificar si debemos procesar este cuadro
        if (shouldProcessFrame(frameCountRef.current)) {
          processorRef.current.processFrame(imageData);
        }
        
        frameCountRef.current++;
      } catch (err) {
        console.error("useSignalProcessor: Error procesando frame:", err);
      }
    }
  }, [isProcessing, shouldProcessFrame]);

  return {
    isProcessing,
    lastSignal,
    error,
    framesProcessed,
    signalStats,
    startProcessing,
    stopProcessing,
    processFrame,
    optimizationLevel
  };
};
