
import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';

export const useSignalProcessor = () => {
  const [processor] = useState(() => {
    console.log("useSignalProcessor: Creando nueva instancia del procesador", {
      timestamp: new Date().toISOString(),
      sessionId: Math.random().toString(36).substring(2, 9)
    });
    return new PPGSignalProcessor({
      // Configuración mejorada para detección de dedo
      fingerDetectionThreshold: 0.12, // Umbral reducido para detección más sensible
      minSignalQuality: 35, // Umbral mínimo de calidad reducido
      adaptiveSensitivity: true, // Habilitar sensibilidad adaptativa
      enhancedProcessing: true, // Habilitar algoritmos mejorados
    });
  });
  
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
  
  // Nuevas referencias para mejorar la estabilidad
  const qualityHistoryRef = useRef<number[]>([]);
  const fingerDetectedHistoryRef = useRef<boolean[]>([]);
  const HISTORY_SIZE = 5; // Ventana de historial para promedio
  
  // Función para calcular calidad promedio y detección robusta
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
    
    // Calcular calidad promedio con más peso a los valores más recientes
    let weightedQualitySum = 0;
    let weightSum = 0;
    qualityHistoryRef.current.forEach((quality, index) => {
      const weight = index + 1; // Dar más peso a valores recientes
      weightedQualitySum += quality * weight;
      weightSum += weight;
    });
    
    const avgQuality = weightSum > 0 ? weightedQualitySum / weightSum : 0;
    
    // Determinar detección robusta de dedo basada en historial
    // Principio de votación: la mayoría decide con bias hacia detección
    const trueCount = fingerDetectedHistoryRef.current.filter(detected => detected).length;
    const detectionRatio = trueCount / fingerDetectedHistoryRef.current.length;
    
    // Si más del 40% del historial muestra detección, consideramos que hay dedo
    // Este enfoque es más permisivo para mejorar la experiencia
    const robustFingerDetected = detectionRatio >= 0.4;
    
    // Mejorar calidad reportada para obtener una UI más estable
    // La calidad se escala para ser más optimista dentro de rangos razonables
    const enhancedQuality = Math.min(100, avgQuality * 1.15);
    
    return {
      ...signal,
      fingerDetected: robustFingerDetected,
      quality: enhancedQuality
    };
  }, []);

  useEffect(() => {
    console.log("useSignalProcessor: Configurando callbacks", {
      timestamp: new Date().toISOString(),
      processorExists: !!processor
    });
    
    processor.onSignalReady = (signal: ProcessedSignal) => {
      // Aplicar procesamiento robusto de detección
      const modifiedSignal = processRobustFingerDetection(signal);
      
      console.log("useSignalProcessor: Señal procesada:", {
        timestamp: modifiedSignal.timestamp,
        formattedTime: new Date(modifiedSignal.timestamp).toISOString(),
        quality: modifiedSignal.quality.toFixed(1),
        rawQuality: signal.quality.toFixed(1), // Calidad original antes del procesamiento
        rawValue: modifiedSignal.rawValue.toFixed(3),
        filteredValue: modifiedSignal.filteredValue.toFixed(3),
        fingerDetected: modifiedSignal.fingerDetected,
        originalFingerDetected: signal.fingerDetected, // Estado original antes del procesamiento
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

    console.log("useSignalProcessor: Iniciando procesador", {
      timestamp: new Date().toISOString()
    });
    
    processor.initialize().catch(error => {
      console.error("useSignalProcessor: Error de inicialización detallado:", {
        message: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
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
  }, [processor, processRobustFingerDetection]);

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
    
    // Limpiar historiales
    qualityHistoryRef.current = [];
    fingerDetectedHistoryRef.current = [];
    
    processor.start();
  }, [processor, isProcessing]);

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
    if (isProcessing) {
      console.log("useSignalProcessor: Procesando nuevo frame", {
        frameNum: framesProcessed + 1,
        dimensions: `${imageData.width}x${imageData.height}`,
        timestamp: new Date().toISOString()
      });
      
      processor.processFrame(imageData);
    } else {
      console.log("useSignalProcessor: Frame ignorado (no está procesando)", {
        timestamp: new Date().toISOString()
      });
    }
  }, [isProcessing, processor, framesProcessed]);

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
