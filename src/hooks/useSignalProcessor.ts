
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
  
  // Referencias para historial de calidad - MODIFICACIÓN CRUCIAL
  const qualityHistoryRef = useRef<number[]>([]);
  const fingerDetectedHistoryRef = useRef<boolean[]>([]);
  const HISTORY_SIZE = 8; // MODIFICACIÓN CRÍTICA 1: Aumentado de 7 a 8 para tener más muestras y mayor estabilidad
  
  // MODIFICACIÓN CRÍTICA 2: Nuevas referencias para seguimiento de estabilidad
  const stableDetectionTimeRef = useRef<number | null>(null);
  const unstableDetectionTimeRef = useRef<number | null>(null);
  const MIN_STABLE_DETECTION_MS = 300; // Mínimo tiempo para considerar detección estable
  
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
    
    // MODIFICACIÓN CRÍTICA 3: Cálculo ponderado de calidad - mucho más peso a muestras recientes
    let weightedQualitySum = 0;
    let weightSum = 0;
    qualityHistoryRef.current.forEach((quality, index) => {
      const weight = Math.pow(1.5, index); // MODIFICACIÓN: Aumentado de 1.3 a 1.5 para dar mucho más peso a muestras recientes
      weightedQualitySum += quality * weight;
      weightSum += weight;
    });
    
    const avgQuality = weightSum > 0 ? weightedQualitySum / weightSum : 0;
    
    // MODIFICACIÓN CRÍTICA 4: Calcular ratio de detección con mayor exigencia
    const trueCount = fingerDetectedHistoryRef.current.filter(detected => detected).length;
    const detectionRatio = fingerDetectedHistoryRef.current.length > 0 ? 
      trueCount / fingerDetectedHistoryRef.current.length : 0;
    
    // MODIFICACIÓN CRÍTICA 5: Introducir histéresis temporal para evitar oscilaciones rápidas
    const now = Date.now();
    let robustFingerDetected = false;
    
    if (detectionRatio >= 0.5) { // MODIFICACIÓN: Aumentado de 0.45 a 0.5 para ser más exigente
      if (stableDetectionTimeRef.current === null) {
        stableDetectionTimeRef.current = now;
      }
      unstableDetectionTimeRef.current = null;
      
      if (now - (stableDetectionTimeRef.current || 0) >= MIN_STABLE_DETECTION_MS) {
        robustFingerDetected = true;
      }
    } else {
      if (unstableDetectionTimeRef.current === null) {
        unstableDetectionTimeRef.current = now;
      }
      
      if (stableDetectionTimeRef.current !== null && 
          now - (unstableDetectionTimeRef.current || 0) >= MIN_STABLE_DETECTION_MS) {
        stableDetectionTimeRef.current = null;
        robustFingerDetected = false;
      } else {
        // Mantener estado anterior para evitar oscilaciones
        robustFingerDetected = stableDetectionTimeRef.current !== null;
      }
    }
    
    // MODIFICACIÓN CRÍTICA 6: Política mucho más estricta para calidad alta
    // Solo aumentar calidad si es realmente un dedo con buena señal
    // Un objeto estático NUNCA debería tener calidad alta
    let enhancedQuality;
    if (robustFingerDetected && signal.quality > 40) {
      // Si es buena detección, permitir calidad alta progresivamente
      enhancedQuality = Math.min(100, Math.max(signal.quality, avgQuality * 1.05));
    } else if (robustFingerDetected) {
      // Si es detección débil, mantener calidad moderada
      enhancedQuality = Math.min(60, Math.max(30, avgQuality));
    } else {
      // Si no hay detección, calidad baja forzada
      enhancedQuality = Math.min(20, avgQuality * 0.7);
    }
    
    // Devolver señal modificada
    return {
      ...signal,
      fingerDetected: robustFingerDetected,
      quality: enhancedQuality
    };
  }, []);

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
    stableDetectionTimeRef.current = null;
    unstableDetectionTimeRef.current = null;
    
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
