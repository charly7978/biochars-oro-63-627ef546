
import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';

export const useSignalProcessor = () => {
  const [processor] = useState(() => {
    console.log("useSignalProcessor: Creando nueva instancia del procesador", {
      timestamp: new Date().toISOString(),
      sessionId: Math.random().toString(36).substring(2, 9)
    });
    return new PPGSignalProcessor();
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSignal, setLastSignal] = useState<ProcessedSignal | null>(null);
  const [error, setError] = useState<ProcessingError | null>(null);
  const [framesProcessed, setFramesProcessed] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const initAttemptRef = useRef(false);
  const processingStartTimeRef = useRef<number>(0);
  const [signalStats, setSignalStats] = useState({
    minValue: Infinity,
    maxValue: -Infinity,
    avgValue: 0,
    totalValues: 0
  });

  // Inicialización del procesador con reintentos
  const initializeProcessor = useCallback(async () => {
    if (isInitialized) return true;
    if (initAttemptRef.current) return false;
    
    initAttemptRef.current = true;
    
    try {
      console.log("useSignalProcessor: Inicializando procesador", {
        timestamp: new Date().toISOString()
      });
      
      await processor.initialize();
      
      console.log("useSignalProcessor: Procesador inicializado correctamente");
      setIsInitialized(true);
      initAttemptRef.current = false;
      return true;
    } catch (error) {
      console.error("useSignalProcessor: Error de inicialización detallado:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      
      initAttemptRef.current = false;
      return false;
    }
  }, [processor, isInitialized]);

  useEffect(() => {
    console.log("useSignalProcessor: Configurando callbacks", {
      timestamp: new Date().toISOString(),
      processorExists: !!processor
    });
    
    processor.onSignalReady = (signal: ProcessedSignal) => {
      // Evaluación robusta de detección de dedo:
      const robustFingerDetected = signal.fingerDetected && signal.quality >= 55; // Reducimos el umbral
      const modifiedSignal = { ...signal, fingerDetected: robustFingerDetected };
      console.log("useSignalProcessor: Señal recibida detallada:", {
        timestamp: modifiedSignal.timestamp,
        formattedTime: new Date(modifiedSignal.timestamp).toISOString(),
        quality: modifiedSignal.quality,
        rawValue: modifiedSignal.rawValue,
        filteredValue: modifiedSignal.filteredValue,
        // Ahora el flag fingerDetected refleja la evaluación robusta
        fingerDetected: modifiedSignal.fingerDetected,
        roi: modifiedSignal.roi,
        processingTime: Date.now() - modifiedSignal.timestamp
      });
      
      setLastSignal(modifiedSignal);
      setError(null);
      setFramesProcessed(prev => prev + 1);
      
      // Actualizar estadísticas
      setSignalStats(prev => {
        const newStats = {
          minValue: Math.min(prev.minValue, modifiedSignal.filteredValue),
          maxValue: Math.max(prev.maxValue, modifiedSignal.filteredValue),
          avgValue: (prev.avgValue * prev.totalValues + modifiedSignal.filteredValue) / (prev.totalValues + 1),
          totalValues: prev.totalValues + 1
        };
        
        if (prev.totalValues % 50 === 0) {
          console.log("useSignalProcessor: Estadísticas de señal:", newStats);
        }
        
        return newStats;
      });
    };

    processor.onError = (error: ProcessingError) => {
      console.error("useSignalProcessor: Error detallado:", {
        ...error,
        formattedTime: new Date(error.timestamp).toISOString(),
        stack: new Error().stack
      });
      setError(error);
    };

    // Iniciar el procesador al montar
    initializeProcessor().catch(error => {
      console.error("useSignalProcessor: Error en inicialización inicial:", error);
    });

    return () => {
      console.log("useSignalProcessor: Limpiando", {
        framesProcessados: framesProcessed,
        ultimaSeñal: lastSignal ? {
          calidad: lastSignal.quality,
          dedoDetectado: lastSignal.fingerDetected
        } : null,
        timestamp: new Date().toISOString()
      });
      processor.stop();
    };
  }, [processor, initializeProcessor, framesProcessed, lastSignal]);

  const startProcessing = useCallback(async () => {
    console.log("useSignalProcessor: Iniciando procesamiento", {
      estadoAnterior: isProcessing,
      timestamp: new Date().toISOString()
    });
    
    // Asegurar que el procesador esté inicializado antes de comenzar
    if (!isInitialized) {
      console.log("useSignalProcessor: Procesador no inicializado, iniciando inicialización");
      const success = await initializeProcessor();
      if (!success) {
        console.error("useSignalProcessor: No se pudo inicializar el procesador, abortando inicio");
        return;
      }
    }
    
    // Reiniciar estado para asegurar una medición limpia
    setFramesProcessed(0);
    setSignalStats({
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0
    });
    
    // Guardar el tiempo de inicio del procesamiento
    processingStartTimeRef.current = Date.now();
    
    // Forzar una calibración antes de iniciar el procesamiento
    try {
      console.log("useSignalProcessor: Realizando calibración previa al inicio");
      await processor.calibrate();
      console.log("useSignalProcessor: Calibración previa completada con éxito");
    } catch (err) {
      console.warn("Error en calibración previa:", err);
      // Continuar de todos modos
    }
    
    setIsProcessing(true);
    processor.start();
    
    console.log("useSignalProcessor: Procesamiento iniciado correctamente");
  }, [processor, isProcessing, isInitialized, initializeProcessor]);

  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessor: Deteniendo procesamiento", {
      estadoAnterior: isProcessing,
      framesProcessados: framesProcessed,
      estadisticasFinales: signalStats,
      timestamp: new Date().toISOString()
    });
    
    setIsProcessing(false);
    processor.stop();
  }, [processor, isProcessing, framesProcessed, signalStats]);

  const calibrate = useCallback(async () => {
    try {
      console.log("useSignalProcessor: Iniciando calibración", {
        timestamp: new Date().toISOString()
      });
      
      await processor.calibrate();
      
      console.log("useSignalProcessor: Calibración exitosa", {
        timestamp: new Date().toISOString()
      });
      
      return true;
    } catch (error) {
      console.error("useSignalProcessor: Error de calibración detallado:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      });
      
      return false;
    }
  }, [processor]);

  const processFrame = useCallback((imageData: ImageData) => {
    if (isProcessing && isInitialized) {
      const now = Date.now();
      // Solo procesamos si ha pasado suficiente tiempo desde el inicio
      if (now - processingStartTimeRef.current >= 100) { // 100ms de gracia para que todo se inicialice
        console.log("useSignalProcessor: Procesando nuevo frame", {
          frameNum: framesProcessed + 1,
          dimensions: `${imageData.width}x${imageData.height}`,
          timestamp: new Date().toISOString()
        });
        
        processor.processFrame(imageData);
      } else {
        console.log("useSignalProcessor: Frame ignorado (periodo de gracia)", {
          timestamp: new Date().toISOString()
        });
      }
    } else if (isProcessing && !isInitialized) {
      console.log("useSignalProcessor: Frame ignorado (procesador no inicializado)", {
        timestamp: new Date().toISOString()
      });
      
      // Intentar inicializar si estamos procesando pero no inicializado
      initializeProcessor().catch(err => {
        console.error("Error al intentar inicializar durante processFrame:", err);
      });
    } else {
      console.log("useSignalProcessor: Frame ignorado (no está procesando)", {
        timestamp: new Date().toISOString()
      });
    }
  }, [isProcessing, isInitialized, processor, framesProcessed, initializeProcessor]);

  return {
    isProcessing,
    lastSignal,
    error,
    framesProcessed,
    signalStats,
    isInitialized,
    startProcessing,
    stopProcessing,
    calibrate,
    processFrame
  };
};
