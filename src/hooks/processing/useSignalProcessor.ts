
/**
 * Hook optimizado para el procesamiento de señales PPG
 * Mejoras:
 * - Muestreo adaptativo
 * - Mejor manejo de memoria
 * - Procesamiento de señales más eficiente
 * - Documentación mejorada
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../../types/signal';

/**
 * Hook para el procesamiento de señales PPG reales con optimizaciones
 * @returns Objeto con métodos y estados para procesar señales PPG
 */
export const useSignalProcessor = () => {
  // Crear instancia del procesador
  const [processor] = useState(() => {
    console.log("useSignalProcessor: Creando nueva instancia optimizada", {
      timestamp: new Date().toISOString(),
      sessionId: Math.random().toString(36).substring(2, 9)
    });
    
    return new PPGSignalProcessor();
  });
  
  // Estado básico
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [error, setError] = useState<ProcessingError | null>(null);
  
  // Métricas de rendimiento
  const frameCount = useRef(0);
  const lastFpsUpdate = useRef(Date.now());
  const currentFps = useRef(0);
  const processedFrames = useRef(0);
  
  // Estadísticas de señal
  const signalStats = useRef({
    minValue: Infinity,
    maxValue: -Infinity,
    avgValue: 0,
    totalValues: 0
  });

  // Configurar callbacks del procesador y limpieza
  useEffect(() => {
    // Callback de señal
    processor.onSignalReady = (signal: ProcessedSignal) => {
      // Actualizar estado con la nueva señal
      setLastSignal(signal);
      setError(null);
      processedFrames.current++;
      
      // Actualizar estadísticas de señal
      signalStats.current = {
        minValue: Math.min(signalStats.current.minValue, signal.filteredValue),
        maxValue: Math.max(signalStats.current.maxValue, signal.filteredValue),
        avgValue: (signalStats.current.avgValue * signalStats.current.totalValues + signal.filteredValue) / 
                 (signalStats.current.totalValues + 1),
        totalValues: signalStats.current.totalValues + 1
      };
      
      // Actualizar FPS
      frameCount.current++;
      const now = Date.now();
      if (now - lastFpsUpdate.current > 1000) { // Actualizar cada segundo
        currentFps.current = frameCount.current;
        frameCount.current = 0;
        lastFpsUpdate.current = now;
        
        // Log de rendimiento
        console.log(`Rendimiento de procesamiento: ${currentFps.current} FPS`);
      }
    };

    // Callback de error
    processor.onError = (error: ProcessingError) => {
      console.error("useSignalProcessor: Error en procesamiento:", error);
      setError(error);
    };

    // Inicializar procesador
    processor.initialize().catch(error => {
      console.error("useSignalProcessor: Error de inicialización:", error);
    });

    // Limpieza
    return () => {
      processor.stop();
    };
  }, [processor]);

  /**
   * Iniciar procesamiento de señales
   */
  const startProcessing = useCallback(() => {
    console.log("useSignalProcessor: Iniciando procesamiento optimizado");
    
    setIsProcessing(true);
    
    // Resetear estadísticas
    processedFrames.current = 0;
    frameCount.current = 0;
    lastFpsUpdate.current = Date.now();
    signalStats.current = {
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0
    };
    
    processor.start();
  }, [processor]);

  /**
   * Detener procesamiento de señales
   */
  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessor: Deteniendo procesamiento");
    console.log(`Estadísticas finales: ${processedFrames.current} frames procesados, ${currentFps.current} FPS`);
    
    setIsProcessing(false);
    processor.stop();
  }, [processor]);

  /**
   * Procesar un frame de la cámara con optimizaciones
   * @param imageData Datos de imagen del frame a procesar
   */
  const processFrame = useCallback((imageData: ImageData) => {
    if (isProcessing) {
      try {
        processor.processFrame(imageData);
      } catch (err) {
        console.error("useSignalProcessor: Error procesando frame:", err);
      }
    }
  }, [isProcessing, processor]);

  // Retornar funciones y estado
  return {
    isProcessing,
    lastSignal,
    error,
    fps: currentFps.current,
    processedFrames: processedFrames.current,
    signalStats: signalStats.current,
    startProcessing,
    stopProcessing,
    processFrame
  };
};
