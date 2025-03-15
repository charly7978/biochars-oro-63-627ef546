
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
  
  const qualityHistoryRef = useRef<number[]>([]);
  const fingerDetectedHistoryRef = useRef<boolean[]>([]);
  const redGreenRatioHistoryRef = useRef<number[]>([]);
  const pulsatilityHistoryRef = useRef<number[]>([]);
  const HISTORY_SIZE = 5;
  
  const MIN_RED_GREEN_RATIO = 1.10; // Reduced from 1.15
  const MIN_PULSATILITY = 0.15; // Reduced from 0.2
  const MAX_PULSATILITY = 2.0;

  const processRobustFingerDetection = useCallback((signal: ProcessedSignal): ProcessedSignal => {
    qualityHistoryRef.current.push(signal.quality);
    if (qualityHistoryRef.current.length > HISTORY_SIZE) {
      qualityHistoryRef.current.shift();
    }
    
    fingerDetectedHistoryRef.current.push(signal.fingerDetected);
    if (fingerDetectedHistoryRef.current.length > HISTORY_SIZE) {
      fingerDetectedHistoryRef.current.shift();
    }
    
    if (signal.redGreenRatio !== undefined) {
      redGreenRatioHistoryRef.current.push(signal.redGreenRatio);
      if (redGreenRatioHistoryRef.current.length > HISTORY_SIZE) {
        redGreenRatioHistoryRef.current.shift();
      }
    }
    
    if (signal.pulsatility !== undefined) {
      pulsatilityHistoryRef.current.push(signal.pulsatility);
      if (pulsatilityHistoryRef.current.length > HISTORY_SIZE) {
        pulsatilityHistoryRef.current.shift();
      }
    }
    
    let weightedQualitySum = 0;
    let weightSum = 0;
    qualityHistoryRef.current.forEach((quality, index) => {
      const weight = index + 1;
      weightedQualitySum += quality * weight;
      weightSum += weight;
    });
    
    const avgQuality = weightSum > 0 ? weightedQualitySum / weightSum : 0;
    
    const trueCount = fingerDetectedHistoryRef.current.filter(detected => detected).length;
    const detectionRatio = fingerDetectedHistoryRef.current.length > 0 ? 
      trueCount / fingerDetectedHistoryRef.current.length : 0;
    
    const avgRedGreenRatio = redGreenRatioHistoryRef.current.length > 0 ?
      redGreenRatioHistoryRef.current.reduce((sum, val) => sum + val, 0) / redGreenRatioHistoryRef.current.length : 0;
    
    const avgPulsatility = pulsatilityHistoryRef.current.length > 0 ?
      pulsatilityHistoryRef.current.reduce((sum, val) => sum + val, 0) / pulsatilityHistoryRef.current.length : 0;
    
    let isTissueLike = false;
    if (redGreenRatioHistoryRef.current.length >= 2 && pulsatilityHistoryRef.current.length >= 2) { // Reduced from 3
      const hasValidRGRatio = avgRedGreenRatio >= MIN_RED_GREEN_RATIO;
      const hasValidPulsatility = avgPulsatility >= MIN_PULSATILITY && avgPulsatility <= MAX_PULSATILITY;
      
      const rgRatioStability = calculateStability(redGreenRatioHistoryRef.current);
      const pulsatilityStability = calculateStability(pulsatilityHistoryRef.current);
      
      isTissueLike = hasValidRGRatio && hasValidPulsatility && 
                    rgRatioStability > 0.5 && pulsatilityStability > 0.3; // Reduced from 0.6 and 0.4
                    
      console.log("useSignalProcessor: Análisis fisiológico", {
        avgRedGreenRatio: avgRedGreenRatio.toFixed(2),
        minRequired: MIN_RED_GREEN_RATIO,
        hasValidRGRatio,
        avgPulsatility: avgPulsatility.toFixed(2),
        pulsRange: `${MIN_PULSATILITY}-${MAX_PULSATILITY}`,
        hasValidPulsatility,
        rgStability: rgRatioStability.toFixed(2),
        pulsStability: pulsatilityStability.toFixed(2),
        isTissueLike
      });
    }
    
    // Make detection more sensitive
    const robustFingerDetected = signal.fingerDetected || 
                               (isTissueLike && (detectionRatio >= 0.5 || avgQuality >= 65)); // Reduced from 0.6 and 75
    
    // Boost quality a bit to help with detection
    const enhancedQuality = robustFingerDetected ? Math.min(100, avgQuality * 1.15) : avgQuality;
    
    console.log("useSignalProcessor: Detección robusta", {
      original: signal.fingerDetected,
      robust: robustFingerDetected,
      isTissueLike,
      detectionRatio,
      avgQuality: avgQuality.toFixed(1),
      enhancedQuality: enhancedQuality.toFixed(1),
      rawValue: signal.rawValue.toFixed(2),
      filteredValue: signal.filteredValue.toFixed(2)
    });
    
    return {
      ...signal,
      fingerDetected: robustFingerDetected,
      quality: enhancedQuality
    };
  }, []);

  const calculateStability = (values: number[]): number => {
    if (values.length < 3) return 0;
    
    const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
    const diffs = values.map(val => Math.abs(val - avg) / Math.max(0.1, avg));
    const avgDiff = diffs.reduce((sum, diff) => sum + diff, 0) / diffs.length;
    
    return Math.max(0, Math.min(1, 1 - avgDiff));
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
    redGreenRatioHistoryRef.current = [];
    pulsatilityHistoryRef.current = [];
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
