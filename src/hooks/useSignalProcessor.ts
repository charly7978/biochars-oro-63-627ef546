import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';

/**
 * Hook para gestionar el procesamiento de señales PPG.
 * Esta versión limpia mantiene la misma funcionalidad pero con código más limpio.
 */
export const useSignalProcessor = () => {
  // Creamos una única instancia del procesador
  const [processor] = useState(() => {
    console.log("useSignalProcessor: Creando nueva instancia del procesador", {
      timestamp: new Date().toISOString(),
      sessionId: Math.random().toString(36).substring(2, 9)
    });
    
    return new PPGSignalProcessor();
  });
  
  // Estado del procesador
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
  
  // Referencias para historial de calidad
  const qualityHistoryRef = useRef<number[]>([]);
  const fingerDetectedHistoryRef = useRef<boolean[]>([]);
  const HISTORY_SIZE = 5; // Ventana de historial para promedio
  
  /**
   * Procesa la detección de dedo de manera robusta usando promedio móvil
   */
  const processRobustFingerDetection = useCallback((signal: ProcessedSignal): ProcessedSignal => {
    // Actualizar historial de calidad
    qualityHistoryRef.current.push(signal.quality);
    if (qualityHistoryRef.current.length > HISTORY_SIZE) {
      qualityHistoryRef.current.shift();
    }
    
    // Actualizar historial de detección
    fingerDetectedHistoryRef.current.push(signal.fingerDetected);
    if (fingerDetectedHistoryRef.current.length > HISTORY_SIZE) {
      fingerDetectedHistoryRef.current.shift();
    }
    
    // Criterios equilibrados:
    // 1. Analizamos un historial más largo para mayor estabilidad
    const recentDetections = fingerDetectedHistoryRef.current.slice(-5);
    const recentPositives = recentDetections.filter(d => d).length;
    
    // 2. Criterio equilibrado: requerimos más de la mitad de detecciones positivas (3/5)
    // Y además calidad mínima de 45
    const robustFingerDetected = recentPositives >= 3 && signal.quality >= 45;
    
    // 3. Calidad basada en varias muestras para estabilidad
    const recentQualities = qualityHistoryRef.current.slice(-3);
    const avgQuality = recentQualities.length > 0 
      ? recentQualities.reduce((sum, q) => sum + q, 0) / recentQualities.length 
      : signal.quality;
    
    // 4. Verificación de los valores de entrada (filtrado equilibrado)
    const isInStrictRange = signal.rawValue >= 80 && signal.rawValue <= 220;
    
    // 5. Verificación de estabilidad de valores crudos
    // Este paso es crucial para evitar falsos positivos por ruido aleatorio
    let isStableSignal = true;
    if (recentQualities.length >= 3) {
      const rawValues = [signal.rawValue];
      let prevSignal = lastSignal;
      for (let i = 0; i < 2 && prevSignal; i++) {
        rawValues.push(prevSignal.rawValue);
        prevSignal = null; // En un hook real aquí accederíamos al historial de señales
      }
      
      if (rawValues.length >= 2) {
        const rawDiff = Math.max(...rawValues) - Math.min(...rawValues);
        // Si hay demasiada variación en los valores crudos, es probable que sea ruido
        isStableSignal = rawDiff < 45;
      }
    }
    
    // 6. Detección de señal plana (falso positivo común)
    // Si la calidad es estable pero muy baja, es sospechoso
    const isQualitySuspicious = recentQualities.length >= 3 && 
      Math.max(...recentQualities) - Math.min(...recentQualities) < 5 && 
      avgQuality < 50;
    
    // 7. Verificación final equilibrada:
    // - El detector robusto debe ser positivo
    // - Los valores deben estar en rango
    // - La señal debe ser estable
    // - No debe ser una señal plana sospechosa
    const finalDetection = 
        robustFingerDetected && 
        isInStrictRange && 
        isStableSignal &&
        !isQualitySuspicious;
    
    // 8. Calidad final ajustada para evitar lecturas erróneas
    const enhancedQuality = 
        (finalDetection && avgQuality > 45) 
        ? Math.min(95, avgQuality * 1.05) // Limitamos a 95 para no dar falsa confianza
        : finalDetection ? avgQuality : Math.min(avgQuality, 40); // Si no hay detección, calidad baja
    
    // Devolver señal modificada
    return {
      ...signal,
      fingerDetected: finalDetection,
      quality: enhancedQuality
    };
  }, [lastSignal]);

  // Configurar callbacks y limpieza
  useEffect(() => {
    console.log("useSignalProcessor: Configurando callbacks", {
      timestamp: new Date().toISOString(),
      processorExists: !!processor
    });
    
    // Callback cuando hay señal lista
    processor.onSignalReady = (signal: ProcessedSignal) => {
      const modifiedSignal = processRobustFingerDetection(signal);
      
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

    // Callback de error
    processor.onError = (error: ProcessingError) => {
      console.error("useSignalProcessor: Error detallado:", {
        ...error,
        formattedTime: new Date(error.timestamp).toISOString(),
        stack: new Error().stack
      });
      setError(error);
    };

    // Inicializar procesador
    processor.initialize().catch(error => {
      console.error("useSignalProcessor: Error de inicialización detallado:", {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    });

    // Cleanup al desmontar
    return () => {
      processor.stop();
    };
  }, [processor, processRobustFingerDetection]);

  /**
   * Inicia el procesamiento de señales
   */
  const startProcessing = useCallback(() => {
    console.log("useSignalProcessor: Iniciando procesamiento", {
      estadoAnterior: isProcessing,
      timestamp: new Date().toISOString()
    });
    
    setIsProcessing(true);
    setFramesProcessed(0);
    setSignalStats({
      minValue: Infinity,
      maxValue: -Infinity,
      avgValue: 0,
      totalValues: 0
    });
    
    qualityHistoryRef.current = [];
    fingerDetectedHistoryRef.current = [];
    
    processor.start();
  }, [processor, isProcessing]);

  /**
   * Detiene el procesamiento de señales
   */
  const stopProcessing = useCallback(() => {
    console.log("useSignalProcessor: Deteniendo procesamiento", {
      estadoAnterior: isProcessing,
      framesProcessados: framesProcessed,
      timestamp: new Date().toISOString()
    });
    
    setIsProcessing(false);
    processor.stop();
  }, [processor, isProcessing, framesProcessed]);

  /**
   * Calibra el procesador para mejores resultados
   */
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

  /**
   * Procesa un frame de imagen
   */
  const processFrame = useCallback((imageData: ImageData) => {
    if (isProcessing) {
      try {
        processor.processFrame(imageData);
        setFramesProcessed(prev => prev + 1);
      } catch (err) {
        console.error("useSignalProcessor: Error procesando frame:", err);
      }
    }
  }, [isProcessing, processor]);

  // Devolver la misma interfaz pública que antes
  return {
    isProcessing,
    lastSignal,
    error,
    framesProcessed,
    signalStats,
    startProcessing,
    stopProcessing,
    calibrate,
    processFrame
  };
};
