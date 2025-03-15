
import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';
import { useAdvancedSignalProcessing } from './useAdvancedSignalProcessing';

interface ProcessorConfig {
  fingerDetectionThreshold?: number;
  minSignalQuality?: number;
  adaptiveSensitivity?: boolean;
  enhancedProcessing?: boolean;
}

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
  const [signalStats, setSignalStats] = useState({
    minValue: Infinity,
    maxValue: -Infinity,
    avgValue: 0,
    totalValues: 0
  });
  
  const { processSignalQuality, detectRobustFingerPresence } = useAdvancedSignalProcessing();
  
  const qualityHistoryRef = useRef<number[]>([]);
  const fingerDetectedHistoryRef = useRef<boolean[]>([]);
  const HISTORY_SIZE = 5; // Ventana de historial para promedio
  
  const processRobustFingerDetection = useCallback((signal: ProcessedSignal): ProcessedSignal => {
    qualityHistoryRef.current.push(signal.quality);
    if (qualityHistoryRef.current.length > HISTORY_SIZE) {
      qualityHistoryRef.current.shift();
    }
    
    fingerDetectedHistoryRef.current.push(signal.fingerDetected);
    if (fingerDetectedHistoryRef.current.length > HISTORY_SIZE) {
      fingerDetectedHistoryRef.current.shift();
    }
    
    // Algoritmo mejorado de calidad de señal con ponderación exponencial
    let weightedQualitySum = 0;
    let weightSum = 0;
    qualityHistoryRef.current.forEach((quality, index) => {
      // Función exponencial para dar mucho más peso a las muestras recientes
      const weight = Math.pow(1.8, index + 1); 
      weightedQualitySum += quality * weight;
      weightSum += weight;
    });
    
    const avgQuality = weightSum > 0 ? weightedQualitySum / weightSum : 0;
    
    // Análisis de consenso con umbrales adaptativos
    const trueCount = fingerDetectedHistoryRef.current.filter(detected => detected).length;
    const detectionRatio = fingerDetectedHistoryRef.current.length > 0 ? 
      trueCount / fingerDetectedHistoryRef.current.length : 0;
    
    // Análisis avanzado de calidad y presencia de dedo usando la función especializada
    const { enhancedQuality, robustFingerDetected } = processSignalQuality({
      original: signal,
      detectionRatio,
      rawQuality: avgQuality,
      historyLength: fingerDetectedHistoryRef.current.length,
      signalFeatures: {
        snr: signal.spectralPower && signal.perfusionIndex ? signal.spectralPower / (signal.perfusionIndex + 0.01) : 0,
        variance: calculateVariance(qualityHistoryRef.current),
        stability: calculateStability(fingerDetectedHistoryRef.current)
      }
    });
    
    console.log("useSignalProcessor: Detección robusta", {
      original: signal.fingerDetected,
      robust: robustFingerDetected,
      detectionRatio,
      trueCount,
      historyLength: fingerDetectedHistoryRef.current.length,
      originalQuality: signal.quality.toFixed(2),
      enhancedQuality: enhancedQuality.toFixed(2),
      rawValue: signal.rawValue.toFixed(2),
      filteredValue: signal.filteredValue.toFixed(2)
    });
    
    return {
      ...signal,
      fingerDetected: robustFingerDetected,
      quality: enhancedQuality
    };
  }, [processSignalQuality]);

  // Función auxiliar para calcular la varianza (indicador de estabilidad)
  const calculateVariance = (values: number[]): number => {
    if (values.length < 2) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  };

  // Función auxiliar para calcular la estabilidad de la detección
  const calculateStability = (detections: boolean[]): number => {
    if (detections.length < 2) return 0;
    let changes = 0;
    for (let i = 1; i < detections.length; i++) {
      if (detections[i] !== detections[i-1]) changes++;
    }
    return 1 - (changes / (detections.length - 1));
  };

  useEffect(() => {
    console.log("useSignalProcessor: Configurando callbacks", {
      timestamp: new Date().toISOString(),
      processorExists: !!processor
    });
    
    processor.onSignalReady = (signal: ProcessedSignal) => {
      const modifiedSignal = processRobustFingerDetection(signal);
      
      console.log("useSignalProcessor: Señal procesada:", {
        timestamp: modifiedSignal.timestamp,
        formattedTime: new Date(modifiedSignal.timestamp).toISOString(),
        quality: modifiedSignal.quality.toFixed(1),
        rawQuality: signal.quality.toFixed(1),
        rawValue: modifiedSignal.rawValue.toFixed(3),
        filteredValue: modifiedSignal.filteredValue.toFixed(3),
        fingerDetected: modifiedSignal.fingerDetected,
        originalFingerDetected: signal.fingerDetected,
        processingTime: Date.now() - modifiedSignal.timestamp
      });
      
      setLastSignal(modifiedSignal);
      setError(null);
      setFramesProcessed(prev => prev + 1);
      
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
      try {
        processor.processFrame(imageData);
        setFramesProcessed(prev => prev + 1);
      } catch (err) {
        console.error("useSignalProcessor: Error procesando frame:", err);
      }
    }
  }, [isProcessing, processor]);

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
