
import { useState, useEffect, useCallback, useRef } from 'react';
import { PPGSignalProcessor } from '../modules/SignalProcessor';
import { ProcessedSignal, ProcessingError } from '../types/signal';

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
  
  const signalBufferRef = useRef<ProcessedSignal[]>([]);
  const MAX_BUFFER_SIZE = 10;
  
  const qualityHistoryRef = useRef<number[]>([]);
  const fingerDetectedHistoryRef = useRef<boolean[]>([]);
  const HISTORY_SIZE = 3;
  
  // Enhanced finger detection with hysteresis to prevent flickering
  const processRobustFingerDetection = useCallback((signal: ProcessedSignal): ProcessedSignal => {
    // Add current values to history
    qualityHistoryRef.current.push(signal.quality);
    if (qualityHistoryRef.current.length > HISTORY_SIZE) {
      qualityHistoryRef.current.shift();
    }
    
    fingerDetectedHistoryRef.current.push(signal.fingerDetected);
    if (fingerDetectedHistoryRef.current.length > HISTORY_SIZE) {
      fingerDetectedHistoryRef.current.shift();
    }
    
    // Calculate weighted average quality giving more weight to recent values
    let weightedQualitySum = 0;
    let weightSum = 0;
    qualityHistoryRef.current.forEach((quality, index) => {
      const weight = index + 1; // More recent values have higher weights
      weightedQualitySum += quality * weight;
      weightSum += weight;
    });
    
    const avgQuality = weightSum > 0 ? weightedQualitySum / weightSum : 0;
    
    // Lower threshold for establishing detection, higher threshold for maintaining detection
    // This creates hysteresis to prevent finger detection from rapidly toggling
    const detectionThreshold = lastSignal?.fingerDetected ? 0.30 : 0.40;
    
    // Count positive detections in history
    const trueCount = fingerDetectedHistoryRef.current.filter(detected => detected).length;
    const detectionRatio = fingerDetectedHistoryRef.current.length > 0 ? 
      trueCount / fingerDetectedHistoryRef.current.length : 0;
    
    // Robust detection with hysteresis
    const robustFingerDetected = detectionRatio >= detectionThreshold;
    
    // Slight enhancement of quality for better UI experience
    const enhancedQuality = Math.min(100, avgQuality * 1.1);
    
    // Add a precise timestamp using performance.now() for better temporal resolution
    const enhancedSignal = {
      ...signal,
      fingerDetected: robustFingerDetected,
      quality: enhancedQuality,
      preciseTimestamp: performance.now()
    };
    
    return enhancedSignal;
  }, [lastSignal]);

  useEffect(() => {
    console.log("useSignalProcessor: Configurando callbacks", {
      timestamp: new Date().toISOString(),
      processorExists: !!processor
    });
    
    processor.onSignalReady = (signal: ProcessedSignal) => {
      // Apply robust finger detection with hysteresis
      const modifiedSignal = processRobustFingerDetection(signal);
      
      // Add high-precision timestamp for better synchronization
      const preciseSignal = {
        ...modifiedSignal,
        preciseTimestamp: performance.now()
      };
      
      setLastSignal(preciseSignal);
      setError(null);
      setFramesProcessed(prev => prev + 1);
      
      signalBufferRef.current.push(preciseSignal);
      if (signalBufferRef.current.length > MAX_BUFFER_SIZE) {
        signalBufferRef.current.shift();
      }
      
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
  }, [processor, processRobustFingerDetection, framesProcessed, lastSignal]);

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
    
    // Clear historical data for a fresh start
    qualityHistoryRef.current = [];
    fingerDetectedHistoryRef.current = [];
    signalBufferRef.current = [];
    
    // Start the processor and recalibrate for better detection
    processor.start();
    processor.calibrate().catch(err => {
      console.error("Error during calibration:", err);
    });
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
      
      // Reset history after calibration
      qualityHistoryRef.current = [];
      fingerDetectedHistoryRef.current = [];
      
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
    processFrame,
    getRecentSignals: () => [...signalBufferRef.current]
  };
};
